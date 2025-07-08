import { EventEmitter } from 'events';

/**
 * Explorer 접근성 관리 전담 클래스
 * ARIA 속성, 키보드 네비게이션, 스크린 리더 지원 등 접근성 기능 관리
 */
export class ExplorerAccessibility extends EventEmitter {
  constructor(explorerCore, dataProvider) {
    super();
    
    this.explorerCore = explorerCore;
    this.dataProvider = dataProvider;
    this.container = explorerCore.getContainer();
    
    // 접근성 상태
    this.announcer = null;
    this.focusIndicator = null;
    this.isHighContrastMode = false;
    this.reducedMotion = false;
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupAccessibilityStructure();
    this.setupAnnouncer();
    this.setupFocusManagement();
    this.setupKeyboardNavigation();
    this.detectUserPreferences();
    this.attachAccessibilityEventListeners();
  }

  /**
   * 접근성 구조 설정
   */
  setupAccessibilityStructure() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    // 기본 ARIA 속성 설정
    treeView.setAttribute('role', 'tree');
    treeView.setAttribute('aria-label', '파일 탐색기');
    treeView.setAttribute('aria-multiselectable', 'true');
    treeView.setAttribute('aria-activedescendant', '');
    
    // 키보드 포커스 가능하도록 설정
    if (!treeView.hasAttribute('tabindex')) {
      treeView.setAttribute('tabindex', '0');
    }
    
    this.emit('accessibilityStructureSetup');
  }

  /**
   * 스크린 리더 알림 시스템 설정
   */
  setupAnnouncer() {
    // 기존 알림 영역이 있는지 확인
    this.announcer = document.getElementById('explorer-announcer');
    
    if (!this.announcer) {
      this.announcer = document.createElement('div');
      this.announcer.id = 'explorer-announcer';
      this.announcer.setAttribute('aria-live', 'polite');
      this.announcer.setAttribute('aria-atomic', 'true');
      this.announcer.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(this.announcer);
    }
    
    this.emit('announcerSetup');
  }

  /**
   * 포커스 관리 설정
   */
  setupFocusManagement() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    // 포커스 인디케이터 스타일 추가
    if (!document.getElementById('explorer-focus-styles')) {
      const style = document.createElement('style');
      style.id = 'explorer-focus-styles';
      style.textContent = `
        .tree-item.focused {
          outline: 2px solid #007ACC;
          outline-offset: -2px;
        }
        
        .tree-item:focus-visible {
          outline: 2px solid #007ACC;
          outline-offset: -2px;
        }
        
        /* 고대비 모드 지원 */
        @media (prefers-contrast: high) {
          .tree-item.focused,
          .tree-item:focus-visible {
            outline: 3px solid currentColor;
            background-color: highlight;
            color: highlighttext;
          }
        }
        
        /* 애니메이션 감소 설정 */
        @media (prefers-reduced-motion: reduce) {
          .tree-item,
          .tree-item-expand {
            transition: none !important;
            animation: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    this.emit('focusManagementSetup');
  }

  /**
   * 키보드 네비게이션 설정
   */
  setupKeyboardNavigation() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    // 트리뷰에 키보드 이벤트 추가 (이미 ExplorerEventHandler에서 처리되지만 접근성 관련 추가 처리)
    treeView.addEventListener('keydown', (e) => {
      this.handleAccessibilityKeyDown(e);
    });
    
    this.emit('keyboardNavigationSetup');
  }

  /**
   * 사용자 접근성 설정 감지
   */
  detectUserPreferences() {
    // 고대비 모드 감지
    if (window.matchMedia) {
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
      this.isHighContrastMode = highContrastQuery.matches;
      
      highContrastQuery.addEventListener('change', (e) => {
        this.isHighContrastMode = e.matches;
        this.updateContrastMode();
      });
      
      // 애니메이션 감소 설정 감지
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = reducedMotionQuery.matches;
      
      reducedMotionQuery.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
        this.updateMotionPreferences();
      });
    }
    
    this.emit('userPreferencesDetected', {
      highContrast: this.isHighContrastMode,
      reducedMotion: this.reducedMotion
    });
  }

  /**
   * 접근성 이벤트 리스너 연결
   */
  attachAccessibilityEventListeners() {
    // 포커스 변경 감지
    this.explorerCore.on('focusChanged', (item) => {
      this.updateAriaActivedescendant(item);
      this.announceCurrentItem(item);
    });
    
    // 선택 변경 감지
    this.explorerCore.on('selectionChanged', (selectedIds) => {
      this.announceSelectionChange(selectedIds);
    });
    
    // 트리 새로고침 감지
    this.explorerCore.on('treeRefreshed', () => {
      this.updateAllAriaProperties();
    });
    
    this.emit('accessibilityEventListenersAttached');
  }

  /**
   * 접근성 키보드 이벤트 처리
   */
  handleAccessibilityKeyDown(event) {
    const { key, ctrlKey, shiftKey } = event;
    
    // 스크린 리더 전용 단축키
    switch (key) {
      case 'Home':
        if (ctrlKey) {
          this.focusFirstItem();
          event.preventDefault();
        }
        break;
      case 'End':
        if (ctrlKey) {
          this.focusLastItem();
          event.preventDefault();
        }
        break;
      case '*':
        // 숫자패드 * - 모든 하위 항목 확장
        this.expandAllUnderFocus();
        event.preventDefault();
        break;
      case '+':
        // 숫자패드 + - 현재 폴더 확장
        this.expandCurrentFolder();
        event.preventDefault();
        break;
      case '-':
        // 숫자패드 - - 현재 폴더 축소
        this.collapseCurrentFolder();
        event.preventDefault();
        break;
    }
    
    this.emit('accessibilityKeyPressed', { key, ctrlKey, shiftKey });
  }

  /**
   * 첫 번째 항목으로 포커스 이동
   */
  focusFirstItem() {
    const firstItem = this.dataProvider.getFirstVisibleNode();
    if (firstItem) {
      this.explorerCore.setFocusedItem(firstItem);
      this.announce('첫 번째 항목으로 이동했습니다');
    }
  }

  /**
   * 마지막 항목으로 포커스 이동
   */
  focusLastItem() {
    const visibleNodes = this.dataProvider.getVisibleNodes(this.dataProvider.root, true);
    const lastItem = visibleNodes[visibleNodes.length - 1];
    if (lastItem) {
      this.explorerCore.setFocusedItem(lastItem);
      this.announce('마지막 항목으로 이동했습니다');
    }
  }

  /**
   * 포커스된 항목 하위 모든 폴더 확장
   */
  expandAllUnderFocus() {
    const focusedItem = this.explorerCore.getFocusedItem();
    if (focusedItem && focusedItem.type === 'folder') {
      this.expandAllRecursive(focusedItem);
      this.explorerCore.refreshTree();
      this.announce(`${focusedItem.label} 폴더의 모든 하위 항목을 확장했습니다`);
    }
  }

  /**
   * 현재 폴더 확장
   */
  expandCurrentFolder() {
    const focusedItem = this.explorerCore.getFocusedItem();
    if (focusedItem && focusedItem.type === 'folder' && !focusedItem.isExpanded) {
      this.dataProvider.expandNode(focusedItem);
      this.explorerCore.refreshTree();
      this.announce(`${focusedItem.label} 폴더를 확장했습니다`);
    }
  }

  /**
   * 현재 폴더 축소
   */
  collapseCurrentFolder() {
    const focusedItem = this.explorerCore.getFocusedItem();
    if (focusedItem && focusedItem.type === 'folder' && focusedItem.isExpanded) {
      this.dataProvider.collapseNode(focusedItem);
      this.explorerCore.refreshTree();
      this.announce(`${focusedItem.label} 폴더를 축소했습니다`);
    }
  }

  /**
   * 재귀적으로 모든 하위 폴더 확장
   */
  expandAllRecursive(folder) {
    if (folder.type === 'folder' && !folder.isExpanded) {
      this.dataProvider.expandNode(folder);
    }
    
    if (folder.children) {
      folder.children.forEach(child => {
        if (child.type === 'folder') {
          this.expandAllRecursive(child);
        }
      });
    }
  }

  /**
   * ARIA activedescendant 업데이트
   */
  updateAriaActivedescendant(item) {
    const treeView = this.container.querySelector('.tree-view');
    if (treeView && item) {
      treeView.setAttribute('aria-activedescendant', item.id);
    } else if (treeView) {
      treeView.removeAttribute('aria-activedescendant');
    }
  }

  /**
   * 모든 ARIA 속성 업데이트
   */
  updateAllAriaProperties() {
    const treeItems = this.container.querySelectorAll('.tree-item');
    
    treeItems.forEach((element, index) => {
      const itemId = element.dataset.itemId;
      const item = this.dataProvider.findNodeById(itemId);
      
      if (item) {
        // 기본 ARIA 속성
        element.setAttribute('role', 'treeitem');
        element.setAttribute('aria-level', (item.getDepth() + 1).toString());
        element.setAttribute('aria-setsize', treeItems.length.toString());
        element.setAttribute('aria-posinset', (index + 1).toString());
        
        // 확장 가능한 항목인 경우
        if (item.type === 'folder' && item.children && item.children.length > 0) {
          element.setAttribute('aria-expanded', item.isExpanded.toString());
        } else {
          element.removeAttribute('aria-expanded');
        }
        
        // 선택 상태
        const isSelected = this.explorerCore.isItemSelected(item);
        element.setAttribute('aria-selected', isSelected.toString());
        
        // 설명 추가
        const description = this.generateItemDescription(item);
        if (description) {
          element.setAttribute('aria-describedby', `${item.id}-desc`);
          this.ensureDescriptionElement(item.id, description);
        }
      }
    });
    
    this.emit('ariaPropertiesUpdated');
  }

  /**
   * 항목 설명 생성
   */
  generateItemDescription(item) {
    let description = '';
    
    if (item.type === 'folder') {
      const childCount = item.children ? item.children.length : 0;
      description = `폴더, ${childCount}개 항목`;
      if (item.isExpanded) {
        description += ', 확장됨';
      } else {
        description += ', 축소됨';
      }
    } else if (item.type === 'diagram') {
      description = '다이어그램 파일';
      if (item.updated_at) {
        const date = new Date(item.updated_at);
        description += `, 마지막 수정: ${date.toLocaleDateString()}`;
      }
    }
    
    return description;
  }

  /**
   * 설명 요소 생성/업데이트
   */
  ensureDescriptionElement(itemId, description) {
    const descId = `${itemId}-desc`;
    let descElement = document.getElementById(descId);
    
    if (!descElement) {
      descElement = document.createElement('div');
      descElement.id = descId;
      descElement.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(descElement);
    }
    
    descElement.textContent = description;
  }

  /**
   * 현재 항목 알림
   */
  announceCurrentItem(item) {
    if (!item) return;
    
    const description = this.generateItemDescription(item);
    const message = `${item.label}, ${description}`;
    this.announce(message);
  }

  /**
   * 선택 변경 알림
   */
  announceSelectionChange(selectedIds) {
    if (selectedIds.length === 0) {
      this.announce('선택 해제됨');
    } else if (selectedIds.length === 1) {
      const item = this.dataProvider.findNodeById(selectedIds[0]);
      if (item) {
        this.announce(`${item.label} 선택됨`);
      }
    } else {
      this.announce(`${selectedIds.length}개 항목 선택됨`);
    }
  }

  /**
   * 스크린 리더 알림
   */
  announce(message) {
    if (!this.announcer || !message) return;
    
    // 이전 메시지 지우고 새 메시지 설정
    this.announcer.textContent = '';
    
    // 짧은 지연 후 메시지 설정 (스크린 리더가 변경을 감지하도록)
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = message;
      }
    }, 100);
    
    this.emit('announced', message);
  }

  /**
   * 고대비 모드 업데이트
   */
  updateContrastMode() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    if (this.isHighContrastMode) {
      treeView.classList.add('high-contrast');
      this.announce('고대비 모드가 활성화되었습니다');
    } else {
      treeView.classList.remove('high-contrast');
    }
    
    this.emit('contrastModeUpdated', this.isHighContrastMode);
  }

  /**
   * 애니메이션 설정 업데이트
   */
  updateMotionPreferences() {
    const treeView = this.container.querySelector('.tree-view');
    if (!treeView) return;
    
    if (this.reducedMotion) {
      treeView.classList.add('reduced-motion');
    } else {
      treeView.classList.remove('reduced-motion');
    }
    
    this.emit('motionPreferencesUpdated', this.reducedMotion);
  }

  /**
   * 포커스 트래핑 (모달 등에서 사용)
   */
  trapFocus(container) {
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    
    container.addEventListener('keydown', handleTabKey);
    firstElement.focus();
    
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }

  /**
   * 키보드 사용 감지
   */
  detectKeyboardUsage() {
    let isUsingKeyboard = false;
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        isUsingKeyboard = true;
        document.body.classList.add('using-keyboard');
      }
    });
    
    document.addEventListener('mousedown', () => {
      isUsingKeyboard = false;
      document.body.classList.remove('using-keyboard');
    });
    
    return () => isUsingKeyboard;
  }

  /**
   * 접근성 상태 정보 반환
   */
  getAccessibilityStatus() {
    return {
      hasAnnouncer: !!this.announcer,
      isHighContrastMode: this.isHighContrastMode,
      reducedMotion: this.reducedMotion,
      ariaPropertiesSet: this.container.querySelector('.tree-view')?.hasAttribute('aria-label') || false
    };
  }

  /**
   * 접근성 진단 실행
   */
  runAccessibilityDiagnostics() {
    const diagnostics = {
      treeViewHasRole: false,
      treeViewHasLabel: false,
      itemsHaveRole: 0,
      itemsHaveLevel: 0,
      itemsHaveSelection: 0,
      expandableItemsHaveExpanded: 0,
      hasAnnouncer: !!this.announcer
    };
    
    const treeView = this.container.querySelector('.tree-view');
    if (treeView) {
      diagnostics.treeViewHasRole = treeView.getAttribute('role') === 'tree';
      diagnostics.treeViewHasLabel = treeView.hasAttribute('aria-label');
    }
    
    const treeItems = this.container.querySelectorAll('.tree-item');
    treeItems.forEach(item => {
      if (item.getAttribute('role') === 'treeitem') {
        diagnostics.itemsHaveRole++;
      }
      if (item.hasAttribute('aria-level')) {
        diagnostics.itemsHaveLevel++;
      }
      if (item.hasAttribute('aria-selected')) {
        diagnostics.itemsHaveSelection++;
      }
      if (item.hasAttribute('aria-expanded')) {
        diagnostics.expandableItemsHaveExpanded++;
      }
    });
    
    this.emit('accessibilityDiagnosticsComplete', diagnostics);
    return diagnostics;
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 알림 요소 제거
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer);
    }
    
    // 설명 요소들 제거
    const descElements = document.querySelectorAll('[id$="-desc"]');
    descElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    // 스타일 제거
    const focusStyles = document.getElementById('explorer-focus-styles');
    if (focusStyles && focusStyles.parentNode) {
      focusStyles.parentNode.removeChild(focusStyles);
    }
    
    // 상태 초기화
    this.announcer = null;
    this.focusIndicator = null;
    this.isHighContrastMode = false;
    this.reducedMotion = false;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 참조 정리
    this.explorerCore = null;
    this.dataProvider = null;
    this.container = null;
    
    console.log('🗑️ ExplorerAccessibility destroyed');
  }
}