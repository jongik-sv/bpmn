/**
 * VS Code Style Explorer Panel - 모듈형 리팩토링 버전
 * 5개의 전문화된 모듈을 조합하여 완전한 탐색기 기능 제공
 */

import { ExplorerCore } from './ui/layout/explorer/ExplorerCore.js';
import { ExplorerEventHandler } from './ui/layout/explorer/ExplorerEventHandler.js';
import { ExplorerSearch } from './ui/layout/explorer/ExplorerSearch.js';
import { ExplorerActions } from './ui/layout/explorer/ExplorerActions.js';
import { ExplorerAccessibility } from './ui/layout/explorer/ExplorerAccessibility.js';

import { TreeDataProvider } from './ui/interactions/tree-data/index.js';
import { ContextMenu } from './ui/interactions/context-menu/index.js';

class Explorer {
  constructor(container) {
    this.container = container;
    
    // 핵심 모듈들 초기화
    this.core = new ExplorerCore(container);
    this.dataProvider = this.core.getDataProvider();
    
    this.eventHandler = new ExplorerEventHandler(this.core, this.dataProvider);
    this.search = new ExplorerSearch(this.core, this.dataProvider);
    this.actions = new ExplorerActions(this.core, this.dataProvider);
    this.accessibility = new ExplorerAccessibility(this.core, this.dataProvider);
    
    // 컨텍스트 메뉴 (기존 구현 유지)
    this.contextMenu = new ContextMenu();
    
    // 레거시 호환성을 위한 상태들
    this.selectedItem = null;
    this.focusedItem = null;
    this.draggedItem = null;
    this.searchTerm = '';
    this.filterMode = false;
    
    // 이벤트 콜백들 (하위 호환성)
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
    try {
      // 모듈 간 이벤트 연결 설정
      this.setupModuleIntegration();
      
      // 컨텍스트 메뉴 설정
      this.setupContextMenu();
      
      // 레거시 상태 동기화 설정
      this.setupLegacyStateSync();
      
      console.log('✅ Explorer initialized with modular architecture');
      
    } catch (error) {
      console.error('❌ Explorer initialization failed:', error);
      throw error;
    }
  }

  /**
   * 모듈 간 통합 설정
   */
  setupModuleIntegration() {
    // 이벤트 핸들러 → 액션 연결
    this.eventHandler.on('newFileRequested', (parentItem) => {
      this.actions.createNewFile(parentItem);
    });
    
    this.eventHandler.on('newFolderRequested', (parentItem) => {
      this.actions.createNewFolder(parentItem);
    });
    
    this.eventHandler.on('refreshRequested', () => {
      this.actions.refreshProjectData();
    });
    
    this.eventHandler.on('renameRequested', (item) => {
      this.actions.renameItem(item);
    });
    
    this.eventHandler.on('deleteRequested', (item) => {
      this.actions.deleteItem(item);
    });
    
    this.eventHandler.on('contextMenuRequested', ({ item, x, y }) => {
      this.contextMenu.show(item, x, y);
    });
    
    this.eventHandler.on('dropRequested', ({ draggedItem, targetItem, dropPosition }) => {
      this.actions.handleDrop(draggedItem, targetItem, dropPosition);
    });

    // 이벤트 핸들러 → 검색 연결
    this.eventHandler.on('searchToggleRequested', () => {
      this.search.toggleSearch();
    });
    
    this.eventHandler.on('globalSearchRequested', () => {
      this.search.toggleGlobalSearch();
    });

    // 검색 → 접근성 연결
    this.search.on('searchCompleted', ({ searchTerm, results, isGlobal }) => {
      const message = isGlobal 
        ? `전체 검색 완료: ${results.length}개 결과 찾음`
        : `검색 완료: ${results.length}개 결과 찾음`;
      this.accessibility.announce(message);
    });
    
    this.search.on('searchCleared', () => {
      this.accessibility.announce('검색이 지워졌습니다');
    });

    // 액션 → 접근성 연결
    this.actions.on('fileCreated', (file) => {
      this.accessibility.announce(`새 다이어그램 "${file.name}"이 생성되었습니다`);
    });
    
    this.actions.on('folderCreated', (folder) => {
      this.accessibility.announce(`새 폴더 "${folder.name}"이 생성되었습니다`);
    });
    
    this.actions.on('itemRenamed', ({ item, newName }) => {
      this.accessibility.announce(`"${item.label}"이 "${newName}"으로 이름이 변경되었습니다`);
    });
    
    this.actions.on('itemDeleted', ({ item }) => {
      this.accessibility.announce(`"${item.label}"이 삭제되었습니다`);
    });
    
    this.actions.on('itemMoved', ({ item, newParent }) => {
      const target = newParent.label || '루트 폴더';
      this.accessibility.announce(`"${item.label}"이 "${target}"로 이동되었습니다`);
    });

    // 에러 처리
    [this.eventHandler, this.search, this.actions, this.accessibility].forEach(module => {
      module.on('error', (error) => {
        console.error('Explorer module error:', error);
        this.accessibility.announce('작업 중 오류가 발생했습니다');
      });
    });
  }

  /**
   * 컨텍스트 메뉴 설정
   */
  setupContextMenu() {
    console.log('📍 Setting up context menu...');
    
    // 컨텍스트 메뉴 액션 핸들러 설정
    this.contextMenu.setOnAction((action, item) => {
      this.actions.handleContextMenuAction(action, item);
    });
    
    console.log('✅ Context menu setup complete');
  }

  /**
   * 레거시 상태 동기화 설정
   */
  setupLegacyStateSync() {
    // 포커스 상태 동기화
    this.core.on('focusChanged', (item) => {
      this.focusedItem = item;
      this.accessibility.updateAriaActivedescendant(item);
    });
    
    // 선택 상태 동기화
    this.core.on('selectionChanged', (selectedIds) => {
      this.selectedItem = selectedIds.length > 0 ? 
        this.dataProvider.findNodeById(selectedIds[0]) : null;
    });
    
    // 드래그 상태 동기화
    this.eventHandler.on('dragStarted', (item) => {
      this.draggedItem = item;
    });
    
    this.eventHandler.on('dragEnded', () => {
      this.draggedItem = null;
    });
    
    // 검색 상태 동기화
    this.search.on('searchCompleted', ({ searchTerm, isGlobal }) => {
      this.searchTerm = searchTerm;
      this.filterMode = true;
    });
    
    this.search.on('searchCleared', () => {
      this.searchTerm = '';
      this.filterMode = false;
    });
  }

  // =============== 공개 API (하위 호환성 유지) ===============

  /**
   * 데이터 프로바이더 반환
   */
  getDataProvider() {
    return this.dataProvider;
  }

  /**
   * 트리 새로고침
   */
  refreshTree(element = null) {
    return this.core.refreshTree(element);
  }

  /**
   * 프로젝트 데이터 새로고침
   */
  async refreshProjectData() {
    return this.actions.refreshProjectData();
  }

  /**
   * 검색 토글
   */
  toggleSearch() {
    return this.search.toggleSearch();
  }

  /**
   * 검색 수행
   */
  performSearch(searchTerm = null) {
    return this.search.performSearch(searchTerm);
  }

  /**
   * 검색 지우기
   */
  clearSearch() {
    return this.search.clearSearch();
  }

  /**
   * 새 파일 생성
   */
  async createNewFile(parentFolder = null) {
    return this.actions.createNewFile(parentFolder);
  }

  /**
   * 새 폴더 생성
   */
  async createNewFolder(parentFolder = null) {
    return this.actions.createNewFolder(parentFolder);
  }

  /**
   * 아이템 이름 변경
   */
  async renameItem(item) {
    return this.actions.renameItem(item);
  }

  /**
   * 아이템 삭제
   */
  async deleteItem(item) {
    return this.actions.deleteItem(item);
  }

  /**
   * 모든 노드 축소
   */
  collapseAll() {
    return this.core.collapseAll();
  }

  /**
   * 모든 노드 확장
   */
  expandAll() {
    return this.core.expandAll();
  }

  /**
   * 아이템 선택
   */
  selectItem(item, multiSelect = false) {
    return this.core.selectItem(item, multiSelect);
  }

  /**
   * 포커스된 아이템 설정
   */
  setFocusedItem(item) {
    return this.core.setFocusedItem(item);
  }

  /**
   * 선택된 아이템들 반환
   */
  getSelectedItems() {
    return this.core.getSelectedItems();
  }

  /**
   * 포커스된 아이템 반환
   */
  getFocusedItem() {
    return this.core.getFocusedItem();
  }

  /**
   * 아이템 선택 상태 확인
   */
  isItemSelected(item) {
    return this.core.isItemSelected(item);
  }

  // =============== 이벤트 콜백 설정 (하위 호환성) ===============

  /**
   * 아이템 클릭 콜백 설정
   */
  setOnItemClick(callback) {
    this.onItemClick = callback;
    this.eventHandler.setOnItemClick(callback);
  }

  /**
   * 아이템 더블클릭 콜백 설정
   */
  setOnItemDoubleClick(callback) {
    this.onItemDoubleClick = callback;
    this.eventHandler.setOnItemDoubleClick(callback);
  }

  /**
   * 선택 변경 콜백 설정
   */
  setOnSelectionChange(callback) {
    this.onSelectionChange = callback;
    this.eventHandler.setOnSelectionChange(callback);
  }

  /**
   * 컨텍스트 메뉴 콜백 설정
   */
  setOnContextMenu(callback) {
    this.onContextMenu = callback;
    this.eventHandler.setOnContextMenu(callback);
  }

  // =============== 고급 기능 접근 ===============

  /**
   * 검색 모듈 반환
   */
  getSearchModule() {
    return this.search;
  }

  /**
   * 액션 모듈 반환
   */
  getActionsModule() {
    return this.actions;
  }

  /**
   * 접근성 모듈 반환
   */
  getAccessibilityModule() {
    return this.accessibility;
  }

  /**
   * 이벤트 핸들러 모듈 반환
   */
  getEventHandlerModule() {
    return this.eventHandler;
  }

  /**
   * 코어 모듈 반환
   */
  getCoreModule() {
    return this.core;
  }

  // =============== 상태 정보 ===============

  /**
   * 전체 상태 정보 반환
   */
  getStatus() {
    return {
      core: this.core ? this.core.getStatus() : null,
      eventHandler: this.eventHandler ? this.eventHandler.getStatus() : null,
      search: this.search ? this.search.getSearchStatus() : null,
      actions: this.actions ? this.actions.getStatus() : null,
      accessibility: this.accessibility ? this.accessibility.getAccessibilityStatus() : null,
      legacy: {
        selectedItem: this.selectedItem,
        focusedItem: this.focusedItem,
        draggedItem: this.draggedItem,
        searchTerm: this.searchTerm,
        filterMode: this.filterMode
      }
    };
  }

  /**
   * 진단 정보 실행
   */
  runDiagnostics() {
    const diagnostics = {
      moduleHealth: {
        core: !!this.core,
        eventHandler: !!this.eventHandler,
        search: !!this.search,
        actions: !!this.actions,
        accessibility: !!this.accessibility
      },
      accessibility: this.accessibility ? this.accessibility.runAccessibilityDiagnostics() : null,
      performance: {
        treeItemsCount: this.container.querySelectorAll('.tree-item').length,
        memoryUsage: this.getMemoryUsage()
      }
    };
    
    console.log('🔍 Explorer Diagnostics:', diagnostics);
    return diagnostics;
  }

  /**
   * 메모리 사용량 추정
   */
  getMemoryUsage() {
    if (performance && performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB'
      };
    }
    return { used: 'N/A', total: 'N/A' };
  }

  // =============== 레거시 메서드들 (하위 호환성) ===============

  /**
   * 아이템 이동 (하위 호환성)
   */
  async moveItem(item, newParent) {
    return this.actions.moveItem(item, newParent);
  }

  /**
   * 검색어 하이라이팅 (하위 호환성)
   */
  highlightSearchTerm(text) {
    return this.search.highlightSearchTerm(text);
  }

  /**
   * 중복 이름 확인 (하위 호환성)
   */
  checkDuplicateName(name, type, parentItem) {
    return this.actions.checkDuplicateName(name, type, parentItem);
  }

  /**
   * 폴더 내 다이어그램 목록 (하위 호환성)
   */
  getDiagramsInFolder(folderId) {
    return this.actions.getDiagramsInFolder(folderId);
  }

  /**
   * 아이템 잘라내기 (하위 호환성)
   */
  cutItem(item) {
    return this.actions.cutItem(item);
  }

  /**
   * 아이템 복사 (하위 호환성)
   */
  copyItem(item) {
    return this.actions.copyItem(item);
  }

  /**
   * 아이템 붙여넣기 (하위 호환성)
   */
  async pasteItem(targetItem) {
    return this.actions.pasteItem(targetItem);
  }

  /**
   * 아이템 내보내기 (하위 호환성)
   */
  async exportItem(item) {
    return this.actions.exportItem(item);
  }

  /**
   * 속성 표시 (하위 호환성)
   */
  showProperties(item) {
    return this.actions.showProperties(item);
  }

  /**
   * 접근성 알림 (하위 호환성)
   */
  announce(message) {
    return this.accessibility.announce(message);
  }

  /**
   * 리소스 정리
   */
  destroy() {
    console.log('🗑️ Destroying Explorer with all modules...');
    
    // 모듈들 정리
    if (this.accessibility) {
      this.accessibility.destroy();
    }
    
    if (this.actions) {
      this.actions.destroy();
    }
    
    if (this.search) {
      this.search.destroy();
    }
    
    if (this.eventHandler) {
      this.eventHandler.destroy();
    }
    
    if (this.core) {
      this.core.destroy();
    }
    
    // 컨텍스트 메뉴 정리
    if (this.contextMenu && this.contextMenu.destroy) {
      this.contextMenu.destroy();
    }
    
    // 레거시 상태 정리
    this.selectedItem = null;
    this.focusedItem = null;
    this.draggedItem = null;
    this.searchTerm = '';
    this.filterMode = false;
    
    // 콜백 정리
    this.onItemClick = null;
    this.onItemDoubleClick = null;
    this.onSelectionChange = null;
    this.onContextMenu = null;
    
    // 참조 정리
    this.container = null;
    this.dataProvider = null;
    this.contextMenu = null;
    
    // 모듈 참조 정리
    this.core = null;
    this.eventHandler = null;
    this.search = null;
    this.actions = null;
    this.accessibility = null;
    
    console.log('✅ Explorer destroyed successfully');
  }
}

export default Explorer;