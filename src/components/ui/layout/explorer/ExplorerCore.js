import { EventEmitter } from 'events';
import { TreeDataProvider } from '../tree-data/index.js';

/**
 * Explorer 핵심 렌더링 및 트리 관리 클래스
 * 트리 구조 렌더링, DOM 업데이트, 기본 레이아웃 관리를 담당
 */
export class ExplorerCore extends EventEmitter {
  constructor(container) {
    super();
    
    this.container = container;
    this.dataProvider = new TreeDataProvider();
    this.virtualScrolling = false;
    this.selectedItems = new Set();
    this.focusedItem = null;
    
    // 렌더링 상태
    this.isRendering = false;
    this.renderQueue = [];
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupDataProvider();
    this.render();
    this.refreshTree();
  }

  /**
   * 데이터 프로바이더 설정
   */
  setupDataProvider() {
    this.dataProvider.setOnDidChangeTreeData((element) => {
      this.refreshTree(element);
      this.emit('treeDataChanged', element);
    });
  }

  /**
   * 프로젝트 이름 가져오기
   */
  getProjectName() {
    try {
      const appManager = window.appManager;
      if (appManager && appManager.currentProject && appManager.currentProject.name) {
        return appManager.currentProject.name;
      }
      return null;
    } catch (error) {
      console.warn('Could not get project name:', error);
      return null;
    }
  }

  /**
   * 기본 Explorer 구조 렌더링
   */
  render() {
    const projectName = this.getProjectName();
    
    this.container.innerHTML = `
      <div class="explorer-panel" style="height: 100%; display: flex; flex-direction: column; background-color: #252526; color: #cccccc;">
        <div class="explorer-header" style="padding: 8px 16px; border-bottom: 1px solid #3e3e3e; background-color: #252526;">
          <div class="explorer-title" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column;">
              <h3 style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #cccccc; letter-spacing: 1px;">탐색기</h3>
              ${projectName ? `<span style="font-size: 12px; color: #999999; margin-top: 2px; font-weight: 400;">${projectName}</span>` : ''}
            </div>
            <div class="explorer-actions" style="display: flex; gap: 4px;">
              <button class="action-button" title="새 다이어그램 (BPMN 파일)" data-action="new-file" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                📄
              </button>
              <button class="action-button" title="새 폴더" data-action="new-folder" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                📁
              </button>
              <button class="action-button" title="새로 고침" data-action="refresh" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                🔄
              </button>
              <button class="action-button" title="모두 축소" data-action="collapse-all" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                ⬇️
              </button>
            </div>
          </div>
          <div class="explorer-search" style="display: none; margin-top: 8px;">
            <input type="text" 
                   class="search-input" 
                   placeholder="파일 검색..."
                   autocomplete="off"
                   spellcheck="false"
                   style="width: 100%; padding: 4px 8px; background-color: #3c3c3c; border: 1px solid #3e3e3e; color: #cccccc; border-radius: 3px;">
            <button class="search-clear" title="검색 지우기" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: none; color: #cccccc; cursor: pointer;">
              ×
            </button>
          </div>
        </div>
        <div class="explorer-content" style="flex: 1; overflow: auto; position: relative;">
          <div class="tree-view" 
               role="tree" 
               tabindex="0" 
               style="padding: 4px 0; min-height: 100%; outline: none;">
            <!-- Tree items will be rendered here -->
          </div>
        </div>
      </div>
    `;

    this.emit('rendered');
  }

  /**
   * 트리 렌더링
   */
  renderTree() {
    const root = this.dataProvider.root;
    
    if (!root) {
      return '<div style="padding: 16px; color: #999999;">데이터를 로드하는 중...</div>';
    }
    
    // 루트의 자식들부터 시작, 정렬된 순서대로
    const visibleNodes = [];
    if (root.children && root.children.length > 0) {
      // 루트 자식들을 sort_order로 정렬 (데이터베이스 순서 준수)
      const sortedChildren = [...root.children].sort((a, b) => {
        const aOrder = a.sort_order || 0;
        const bOrder = b.sort_order || 0;
        return aOrder - bOrder;
      });
      
      for (const child of sortedChildren) {
        visibleNodes.push(child);
        if (child.isExpanded && child.children && child.children.length > 0) {
          this.addChildrenToVisible(child, visibleNodes);
        }
      }
    }
    
    if (visibleNodes.length === 0) {
      return `
        <div style="padding: 16px; color: #999999; text-align: center;">
          <div style="margin-bottom: 12px;">
            <i class="codicon codicon-folder" style="font-size: 32px; color: #666;"></i>
          </div>
          <div style="margin-bottom: 8px; font-weight: 500;">파일이 없습니다</div>
          <div style="font-size: 12px; line-height: 1.4; margin-bottom: 12px;">
            새 폴더나 다이어그램을 만들어보세요
          </div>
          <div style="font-size: 11px; color: #666;">
            • 📄 새 다이어그램: 헤더의 + 버튼 클릭<br>
            • 📁 새 폴더: 헤더의 폴더 버튼 클릭
          </div>
        </div>
      `;
    }
    
    const html = visibleNodes.map(node => {
      return this.renderTreeItem(node);
    }).join('');
    return html;
  }

  /**
   * 보이는 노드에 자식들 추가
   */
  addChildrenToVisible(parent, visibleNodes) {
    // 자식들을 sort_order로 정렬 (데이터베이스 순서 준수)
    const sortedChildren = [...parent.children].sort((a, b) => {
      const aOrder = a.sort_order || 0;
      const bOrder = b.sort_order || 0;
      return aOrder - bOrder;
    });
    
    for (const child of sortedChildren) {
      visibleNodes.push(child);
      if (child.isExpanded && child.children && child.children.length > 0) {
        this.addChildrenToVisible(child, visibleNodes);
      }
    }
  }

  /**
   * 트리 아이템 렌더링
   */
  renderTreeItem(item) {
    const depth = item.getDepth();
    const isSelected = this.isItemSelected(item);
    const isFocused = this.focusedItem === item;
    const hasChildren = item.children && item.children.length > 0;
    const canExpand = item.collapsibleState !== 0; // TreeItemCollapsibleState.None
    
    const classes = [
      'tree-item',
      item.type === 'folder' ? 'folder' : 'file',
      isSelected ? 'selected' : '',
      isFocused ? 'focused' : '',
      item.isExpanded ? 'expanded' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${classes}" 
           data-item-id="${item.id}"
           data-item-type="${item.type}"
           data-depth="${depth}"
           role="treeitem"
           aria-level="${depth + 1}"
           aria-expanded="${canExpand ? item.isExpanded : undefined}"
           aria-selected="${isSelected}"
           tabindex="-1"
           style="display: flex; align-items: center; height: 22px; padding-left: ${depth * 16 + 8}px; cursor: pointer; color: #cccccc; user-select: none; position: relative; ${isSelected ? 'background-color: #37373d;' : ''}"
           draggable="true">
        
        <div class="tree-item-content" style="display: flex; align-items: center; flex: 1; min-width: 0;">
          ${canExpand ? `
            <div class="tree-item-expand" role="button" aria-label="${item.isExpanded ? '축소' : '확장'}" style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #cccccc; font-size: 12px;">
              ${item.isExpanded ? '▼' : '▶'}
            </div>
          ` : '<div class="tree-item-expand-placeholder" style="width: 16px; height: 16px;"></div>'}
          
          <div class="tree-item-icon" style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; margin-right: 6px;">
            ${this.getItemIcon(item)}
          </div>
          
          <div class="tree-item-label" title="${item.tooltip || item.label}" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span class="tree-item-name" style="font-size: 13px; color: #cccccc;">${this.highlightSearchTerm(item.label)}</span>
            ${item.description ? `<span class="tree-item-description" style="font-size: 12px; color: #999999; margin-left: 6px;">${item.description}</span>` : ''}
          </div>
          
          <div class="tree-item-actions" style="display: none; margin-left: 6px;">
            ${this.renderItemActions(item)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 아이템 아이콘 반환
   */
  getItemIcon(item) {
    if (item.type === 'folder') {
      return item.isExpanded ? '📂' : '📁';
    }
    
    // 확장자별 파일 아이콘
    const ext = item.extension?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return '📄';
      case 'css':
      case 'scss':
      case 'less':
        return '🎨';
      case 'html':
      case 'htm':
        return '🌐';
      case 'md':
        return '📝';
      case 'json':
        return '⚙️';
      case 'bpmn':
        return '🔗';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return '🖼️';
      default:
        return '📄';
    }
  }

  /**
   * 아이템 액션 버튼 렌더링
   */
  renderItemActions(item) {
    if (item.type === 'folder') {
      return `
        <button class="tree-action-button" data-action="new-file" title="새 파일" style="width: 16px; height: 16px; border: none; background: none; color: #cccccc; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;">
          📄
        </button>
        <button class="tree-action-button" data-action="new-folder" title="새 폴더" style="width: 16px; height: 16px; border: none; background: none; color: #cccccc; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;">
          📁
        </button>
      `;
    }
    return '';
  }

  /**
   * 검색어 하이라이팅
   */
  highlightSearchTerm(text) {
    // 검색 기능은 ExplorerSearch 모듈에서 처리
    return text;
  }

  /**
   * 트리 새로고침
   */
  refreshTree(element = null) {
    if (this.isRendering) {
      this.renderQueue.push(element);
      return;
    }

    this.isRendering = true;

    try {
      const treeView = this.container.querySelector('.tree-view');
      if (!treeView) {
        console.warn('Tree view not found for refresh');
        return;
      }

      const html = this.renderTree();
      treeView.innerHTML = html;

      // 프로젝트 이름 업데이트
      this.updateProjectNameDisplay();

      this.emit('treeRefreshed', element);

    } catch (error) {
      console.error('Error refreshing tree:', error);
      this.emit('refreshError', error);
    } finally {
      this.isRendering = false;

      // 대기열에 있는 렌더링 처리
      if (this.renderQueue.length > 0) {
        const nextElement = this.renderQueue.shift();
        setTimeout(() => this.refreshTree(nextElement), 0);
      }
    }
  }

  /**
   * 프로젝트 이름 표시 업데이트
   */
  updateProjectNameDisplay() {
    const projectName = this.getProjectName();
    const titleContainer = this.container.querySelector('.explorer-title > div');
    
    if (titleContainer) {
      titleContainer.innerHTML = `
        <h3 style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #cccccc; letter-spacing: 1px;">탐색기</h3>
        ${projectName ? `<span style="font-size: 12px; color: #999999; margin-top: 2px; font-weight: 400;">${projectName}</span>` : ''}
      `;
    }
  }

  /**
   * 모든 노드 축소
   */
  collapseAll() {
    const root = this.dataProvider.root;
    if (root && root.children) {
      this.collapseAllRecursive(root.children);
      this.refreshTree();
      this.emit('allCollapsed');
    }
  }

  /**
   * 재귀적으로 모든 노드 축소
   */
  collapseAllRecursive(nodes) {
    for (const node of nodes) {
      if (node.collapsibleState !== 0) { // TreeItemCollapsibleState.None
        node.isExpanded = false;
        if (node.children) {
          this.collapseAllRecursive(node.children);
        }
      }
    }
  }

  /**
   * 모든 노드 확장
   */
  expandAll() {
    const root = this.dataProvider.root;
    if (root && root.children) {
      this.expandAllRecursive(root.children);
      this.refreshTree();
      this.emit('allExpanded');
    }
  }

  /**
   * 재귀적으로 모든 노드 확장
   */
  expandAllRecursive(nodes) {
    for (const node of nodes) {
      if (node.collapsibleState !== 0) { // TreeItemCollapsibleState.None
        node.isExpanded = true;
        if (node.children) {
          this.expandAllRecursive(node.children);
        }
      }
    }
  }

  /**
   * 아이템 선택 상태 확인
   */
  isItemSelected(item) {
    return this.selectedItems.has(item.id);
  }

  /**
   * 아이템 선택
   */
  selectItem(item, multiSelect = false) {
    if (!multiSelect) {
      this.selectedItems.clear();
    }

    if (this.selectedItems.has(item.id)) {
      this.selectedItems.delete(item.id);
    } else {
      this.selectedItems.add(item.id);
    }

    this.emit('selectionChanged', Array.from(this.selectedItems));
  }

  /**
   * 포커스된 아이템 설정
   */
  setFocusedItem(item) {
    this.focusedItem = item;
    this.emit('focusChanged', item);
  }

  /**
   * 선택된 아이템들 반환
   */
  getSelectedItems() {
    return Array.from(this.selectedItems).map(id => 
      this.dataProvider.findNodeById(id)
    ).filter(Boolean);
  }

  /**
   * 포커스된 아이템 반환
   */
  getFocusedItem() {
    return this.focusedItem;
  }

  /**
   * 데이터 프로바이더 반환
   */
  getDataProvider() {
    return this.dataProvider;
  }

  /**
   * 컨테이너 반환
   */
  getContainer() {
    return this.container;
  }

  /**
   * 트리 뷰 DOM 요소 반환
   */
  getTreeView() {
    return this.container.querySelector('.tree-view');
  }

  /**
   * 핵심 상태 정보 반환
   */
  getStatus() {
    return {
      isRendering: this.isRendering,
      selectedItemsCount: this.selectedItems.size,
      hasFocusedItem: !!this.focusedItem,
      hasData: !!(this.dataProvider.root && this.dataProvider.root.children),
      renderQueueLength: this.renderQueue.length
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 렌더링 대기열 클리어
    this.renderQueue = [];
    this.isRendering = false;

    // 상태 클리어
    this.selectedItems.clear();
    this.focusedItem = null;

    // 이벤트 에미터 정리
    this.removeAllListeners();

    // 데이터 프로바이더 정리
    if (this.dataProvider && this.dataProvider.destroy) {
      this.dataProvider.destroy();
    }

    this.container = null;
    this.dataProvider = null;

    console.log('🗑️ ExplorerCore destroyed');
  }
}