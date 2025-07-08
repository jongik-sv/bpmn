import { EventEmitter } from 'events';

/**
 * Explorer 이벤트 처리 전담 클래스
 * 클릭, 키보드, 드래그앤드롭, 컨텍스트 메뉴 이벤트 관리
 */
export class ExplorerEventHandler extends EventEmitter {
  constructor(explorerCore, dataProvider) {
    super();
    
    this.explorerCore = explorerCore;
    this.dataProvider = dataProvider;
    this.container = explorerCore.getContainer();
    
    // 드래그앤드롭 상태
    this.draggedItem = null;
    this.lastDropPosition = null;
    
    // 이벤트 콜백들
    this.onItemClick = null;
    this.onItemDoubleClick = null;
    this.onSelectionChange = null;
    this.onContextMenu = null;
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.attachEventListeners();
    this.setupDragAndDrop();
    this.setupAccessibilityEvents();
  }

  /**
   * 이벤트 리스너 연결
   */
  attachEventListeners() {
    const treeView = this.container.querySelector('.tree-view');
    const explorerActions = this.container.querySelector('.explorer-actions');
    
    if (treeView) {
      // 트리 이벤트들
      treeView.addEventListener('click', (e) => this.handleTreeClick(e));
      treeView.addEventListener('dblclick', (e) => this.handleTreeDoubleClick(e));
      treeView.addEventListener('keydown', (e) => this.handleKeyDown(e));
      treeView.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
      
      // 포커스 관리
      treeView.addEventListener('focus', () => {
        if (!this.explorerCore.getFocusedItem()) {
          const firstItem = this.dataProvider.getFirstVisibleNode();
          if (firstItem) {
            this.explorerCore.setFocusedItem(firstItem);
          }
        }
      });
    }

    if (explorerActions) {
      // 액션 버튼 이벤트
      explorerActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-button');
        if (button) {
          this.handleActionClick(e, button);
        }
      });
    }

    // 전역 키보드 이벤트
    document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
    
    this.emit('eventListenersAttached');
  }

  /**
   * 트리 클릭 처리
   */
  handleTreeClick(event) {
    const treeItem = event.target.closest('.tree-item');
    if (!treeItem) return;

    const itemId = treeItem.dataset.itemId;
    const item = this.dataProvider.findNodeById(itemId);
    if (!item) return;

    // 확장/축소 버튼 클릭 처리
    const expandButton = event.target.closest('.tree-item-expand');
    if (expandButton) {
      this.dataProvider.toggleNode(item);
      this.explorerCore.refreshTree();
      return;
    }

    // 아이템 선택
    const multiSelect = event.ctrlKey || event.metaKey;
    this.explorerCore.selectItem(item, multiSelect);
    this.explorerCore.setFocusedItem(item);

    // 콜백 호출
    if (this.onItemClick) {
      this.onItemClick(item, event);
    }

    this.emit('itemClicked', { item, event });
  }

  /**
   * 트리 더블클릭 처리
   */
  handleTreeDoubleClick(event) {
    const treeItem = event.target.closest('.tree-item');
    if (!treeItem) return;

    const itemId = treeItem.dataset.itemId;
    const item = this.dataProvider.findNodeById(itemId);
    if (!item) return;

    // 폴더인 경우 확장/축소
    if (item.type === 'folder') {
      this.dataProvider.toggleNode(item);
      this.explorerCore.refreshTree();
    }

    // 콜백 호출
    if (this.onItemDoubleClick) {
      this.onItemDoubleClick(item, event);
    }

    this.emit('itemDoubleClicked', { item, event });
  }

  /**
   * 키보드 입력 처리
   */
  handleKeyDown(event) {
    const focusedItem = this.explorerCore.getFocusedItem();
    if (!focusedItem) return;

    const { key, ctrlKey, shiftKey, metaKey } = event;
    let handled = true;

    switch (key) {
      case 'ArrowDown':
        this.moveFocus('down', shiftKey);
        break;
      case 'ArrowUp':
        this.moveFocus('up', shiftKey);
        break;
      case 'ArrowRight':
        if (focusedItem.type === 'folder' && !focusedItem.isExpanded) {
          this.dataProvider.expandNode(focusedItem);
          this.explorerCore.refreshTree();
        } else {
          this.moveFocus('down', shiftKey);
        }
        break;
      case 'ArrowLeft':
        if (focusedItem.type === 'folder' && focusedItem.isExpanded) {
          this.dataProvider.collapseNode(focusedItem);
          this.explorerCore.refreshTree();
        } else if (focusedItem.parent) {
          this.explorerCore.setFocusedItem(focusedItem.parent);
        }
        break;
      case 'Enter':
      case ' ':
        if (focusedItem.type === 'folder') {
          this.dataProvider.toggleNode(focusedItem);
          this.explorerCore.refreshTree();
        } else if (this.onItemDoubleClick) {
          this.onItemDoubleClick(focusedItem, event);
        }
        break;
      case 'F2':
        this.handleItemAction('rename', focusedItem);
        break;
      case 'Delete':
        this.handleItemAction('delete', focusedItem);
        break;
      case 'a':
        if (ctrlKey || metaKey) {
          this.selectAll();
        } else {
          handled = false;
        }
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.emit('keyPressed', { key, item: focusedItem, handled });
  }

  /**
   * 전역 키보드 이벤트 처리
   */
  handleGlobalKeyDown(event) {
    const { key, ctrlKey, shiftKey } = event;
    
    // 검색 단축키
    if (ctrlKey && key === 'f') {
      event.preventDefault();
      this.emit('searchToggleRequested');
    }
    
    // 전역 검색 단축키
    if (ctrlKey && shiftKey && key === 'F') {
      event.preventDefault();
      this.emit('globalSearchRequested');
    }
  }

  /**
   * 포커스 이동
   */
  moveFocus(direction, multiSelect = false) {
    const focusedItem = this.explorerCore.getFocusedItem();
    if (!focusedItem) return;

    const visibleNodes = this.dataProvider.getVisibleNodes(this.dataProvider.root, true);
    const currentIndex = visibleNodes.indexOf(focusedItem);
    
    let newIndex;
    if (direction === 'down') {
      newIndex = Math.min(currentIndex + 1, visibleNodes.length - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, 0);
    }
    
    const newItem = visibleNodes[newIndex];
    if (newItem) {
      this.explorerCore.setFocusedItem(newItem);
      
      if (multiSelect) {
        this.explorerCore.selectItem(newItem, true);
      } else {
        this.explorerCore.selectItem(newItem, false);
      }

      this.emit('focusMoved', { direction, item: newItem, multiSelect });
    }
  }

  /**
   * 모든 항목 선택
   */
  selectAll() {
    const visibleNodes = this.dataProvider.getVisibleNodes(this.dataProvider.root, true);
    visibleNodes.forEach(item => {
      this.explorerCore.selectItem(item, true);
    });
    
    this.emit('allSelected', visibleNodes);
  }

  /**
   * 컨텍스트 메뉴 처리
   */
  handleContextMenu(event) {
    event.preventDefault();
    
    const treeItem = event.target.closest('.tree-item');
    if (!treeItem) return;

    const itemId = treeItem.dataset.itemId;
    const item = this.dataProvider.findNodeById(itemId);
    if (!item) return;

    // 아이템 선택
    this.explorerCore.selectItem(item, false);
    this.explorerCore.setFocusedItem(item);

    // 콜백 호출
    if (this.onContextMenu) {
      this.onContextMenu(item, event);
    }

    this.emit('contextMenuRequested', { item, x: event.clientX, y: event.clientY });
  }

  /**
   * 액션 버튼 클릭 처리
   */
  handleActionClick(event, button) {
    const action = button.dataset.action;
    
    switch (action) {
      case 'new-file':
        this.emit('newFileRequested');
        break;
      case 'new-folder':
        this.emit('newFolderRequested');
        break;
      case 'refresh':
        this.emit('refreshRequested');
        break;
      case 'collapse-all':
        this.explorerCore.collapseAll();
        this.emit('collapseAllRequested');
        break;
    }

    this.emit('actionClicked', { action, button });
  }

  /**
   * 아이템 액션 처리
   */
  handleItemAction(action, item) {
    this.emit('itemActionRequested', { action, item });
    
    switch (action) {
      case 'new-file':
        this.emit('newFileRequested', item);
        break;
      case 'new-folder':
        this.emit('newFolderRequested', item);
        break;
      case 'rename':
        this.emit('renameRequested', item);
        break;
      case 'delete':
        this.emit('deleteRequested', item);
        break;
    }
  }

  /**
   * 드래그앤드롭 설정
   */
  setupDragAndDrop() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    // 드래그 시작
    treeView.addEventListener('dragstart', (e) => {
      console.log('🚀 Drag start event triggered');
      const treeItem = e.target.closest('.tree-item');
      if (treeItem) {
        const itemId = treeItem.dataset.itemId;
        const item = this.dataProvider.findNodeById(itemId);
        if (item) {
          this.draggedItem = item;
          e.dataTransfer.setData('text/plain', item.id);
          e.dataTransfer.effectAllowed = 'move';
          treeItem.classList.add('dragging');
          console.log('✅ Drag initialized for:', item.label);
          this.emit('dragStarted', item);
        } else {
          console.log('❌ Could not find item for ID:', itemId);
        }
      } else {
        console.log('❌ No tree item found for drag start');
      }
    });

    // 드래그 종료
    treeView.addEventListener('dragend', (e) => {
      const treeItem = e.target.closest('.tree-item');
      if (treeItem) {
        treeItem.classList.remove('dragging');
      }
      
      this.clearDragOverStyles();
      
      const draggedItem = this.draggedItem;
      this.draggedItem = null;
      this.lastDropPosition = null;
      
      this.emit('dragEnded', draggedItem);
    });

    // 드래그 진입
    treeView.addEventListener('dragenter', (e) => {
      const treeItem = e.target.closest('.tree-item');
      if (treeItem) {
        const itemId = treeItem.dataset.itemId;
        const item = this.dataProvider.findNodeById(itemId);
        
        if (item && (item.type === 'folder' || item.type === 'file' || item.type === 'diagram')) {
          this.updateDropIndicators(e);
        }
      }
    });

    // 드래그 오버
    treeView.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const treeItem = e.target.closest('.tree-item');
      if (treeItem && this.draggedItem) {
        this.updateDropIndicators(e);
      }
      
      // 빈 영역에 대한 드래그오버 효과
      if (!treeItem && e.target === treeView) {
        treeView.classList.add('drag-over-root');
      } else {
        treeView.classList.remove('drag-over-root');
      }
    });

    // 드래그 떠남
    treeView.addEventListener('dragleave', (e) => {
      const treeItem = e.target.closest('.tree-item');
      if (treeItem) {
        treeItem.classList.remove('drag-over');
      }
    });

    // 드롭
    treeView.addEventListener('drop', (e) => {
      console.log('🎯 Drop event triggered');
      e.preventDefault();
      
      const treeItem = e.target.closest('.tree-item');
      console.log('🎯 Drop target item:', treeItem?.dataset?.itemId);
      console.log('🎯 Dragged item:', this.draggedItem?.label);
      
      if (this.draggedItem) {
        if (!treeItem) {
          // 빈 영역에 드롭 (루트로 이동)
          console.log('📁 Moving to root folder (last position)');
          this.emit('dropRequested', {
            draggedItem: this.draggedItem,
            targetItem: null,
            dropPosition: 'root'
          });
          treeView.classList.remove('drag-over-root');
        } else {
          const targetItemId = treeItem.dataset.itemId;
          const targetItem = this.dataProvider.findNodeById(targetItemId);
          console.log('🎯 Target item found:', targetItem?.label);
          
          if (targetItem && targetItem !== this.draggedItem) {
            const dropPosition = this.getDropPosition(treeItem);
            console.log('📍 Drop position:', dropPosition, 'on item:', targetItem.label);
            
            this.emit('dropRequested', {
              draggedItem: this.draggedItem,
              targetItem: targetItem,
              dropPosition: dropPosition
            });
          } else if (targetItem === this.draggedItem) {
            console.log('❌ Cannot drop item on itself');
          } else {
            console.log('❌ No valid target item found');
          }
        }
      } else {
        console.log('❌ No dragged item');
      }
      
      this.clearDragOverStyles();
    });
    
    this.emit('dragDropSetup');
  }

  /**
   * 드롭 위치 확인
   */
  getDropPosition(treeItem) {
    const rect = treeItem.getBoundingClientRect();
    const itemHeight = rect.height;
    const relativeY = event.clientY - rect.top;
    
    // 드롭 존 계산 (상단 25%, 중간 50%, 하단 25%)
    if (relativeY < itemHeight * 0.25) {
      return 'before';
    } else if (relativeY > itemHeight * 0.75) {
      return 'after';
    } else {
      const itemId = treeItem.dataset.itemId;
      const item = this.dataProvider.findNodeById(itemId);
      return (item && item.type === 'folder') ? 'into' : 'after';
    }
  }

  /**
   * 드롭 인디케이터 업데이트
   */
  updateDropIndicators(event) {
    // 기존 인디케이터 제거
    this.clearDragOverStyles();
    
    const treeItem = event.target.closest('.tree-item');
    if (!treeItem || !this.draggedItem) return;

    const dropPosition = this.getDropPosition(treeItem);
    this.lastDropPosition = dropPosition;
    
    // 드롭 위치에 따른 스타일 적용
    switch (dropPosition) {
      case 'before':
        treeItem.classList.add('drag-over-before');
        break;
      case 'after':
        treeItem.classList.add('drag-over-after');
        break;
      case 'into':
        treeItem.classList.add('drag-over');
        break;
    }
  }

  /**
   * 드래그 오버 스타일 정리
   */
  clearDragOverStyles() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    // 모든 드래그 오버 스타일 제거
    const dragOverItems = treeView.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after');
    dragOverItems.forEach(item => {
      item.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    });
    
    treeView.classList.remove('drag-over-root');
  }

  /**
   * 접근성 이벤트 설정
   */
  setupAccessibilityEvents() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    // ARIA 속성 설정
    treeView.setAttribute('aria-multiselectable', 'true');
    treeView.setAttribute('aria-activedescendant', '');
    
    // 포커스 변경 시 ARIA 업데이트
    this.on('focusMoved', ({ item }) => {
      this.updateAriaProperties(item);
    });
    
    this.emit('accessibilitySetup');
  }

  /**
   * ARIA 속성 업데이트
   */
  updateAriaProperties(focusedItem = null) {
    const treeItems = this.container.querySelectorAll('.tree-item');
    treeItems.forEach((element, index) => {
      element.setAttribute('aria-setsize', treeItems.length);
      element.setAttribute('aria-posinset', index + 1);
    });
    
    const treeView = this.container.querySelector('.tree-view');
    if (focusedItem && treeView) {
      treeView.setAttribute('aria-activedescendant', focusedItem.id);
    }
  }

  // =============== 콜백 설정 메서드들 ===============

  /**
   * 아이템 클릭 콜백 설정
   */
  setOnItemClick(callback) {
    this.onItemClick = callback;
  }

  /**
   * 아이템 더블클릭 콜백 설정
   */
  setOnItemDoubleClick(callback) {
    this.onItemDoubleClick = callback;
  }

  /**
   * 선택 변경 콜백 설정
   */
  setOnSelectionChange(callback) {
    this.onSelectionChange = callback;
  }

  /**
   * 컨텍스트 메뉴 콜백 설정
   */
  setOnContextMenu(callback) {
    this.onContextMenu = callback;
  }

  // =============== 상태 관리 ===============

  /**
   * 드래그 상태 정보 반환
   */
  getDragState() {
    return {
      isDragging: !!this.draggedItem,
      draggedItem: this.draggedItem,
      lastDropPosition: this.lastDropPosition
    };
  }

  /**
   * 이벤트 핸들러 상태 정보 반환
   */
  getStatus() {
    return {
      hasEventListeners: true,
      dragState: this.getDragState(),
      hasCallbacks: {
        onItemClick: !!this.onItemClick,
        onItemDoubleClick: !!this.onItemDoubleClick,
        onSelectionChange: !!this.onSelectionChange,
        onContextMenu: !!this.onContextMenu
      }
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 드래그 상태 정리
    this.draggedItem = null;
    this.lastDropPosition = null;
    
    // 콜백 정리
    this.onItemClick = null;
    this.onItemDoubleClick = null;
    this.onSelectionChange = null;
    this.onContextMenu = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 참조 정리
    this.explorerCore = null;
    this.dataProvider = null;
    this.container = null;
    
    console.log('🗑️ ExplorerEventHandler destroyed');
  }
}