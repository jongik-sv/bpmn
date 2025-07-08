import { EventEmitter } from 'events';

/**
 * VS Code 뷰 관리 클래스
 * 뷰 전환, 포커스 관리, 네비게이션을 담당
 */
export class VSCodeViewManager extends EventEmitter {
  constructor(layoutManager) {
    super();
    
    this.layoutManager = layoutManager;
    this.currentView = 'explorer';
    this.viewHistory = ['explorer'];
    this.maxHistoryLength = 10;
    
    // 뷰 표시 이름 매핑
    this.viewDisplayNames = {
      'explorer': '탐색기',
      'search': '검색',
      'source-control': '소스 제어',
      'run-debug': '실행 및 디버그',
      'extensions': '확장'
    };
    
    // 레이아웃 매니저 이벤트 구독
    this.setupLayoutEvents();
  }

  /**
   * 레이아웃 매니저 이벤트 설정
   */
  setupLayoutEvents() {
    this.layoutManager.on('viewChanged', (viewId) => {
      this.currentView = viewId;
      this.addToHistory(viewId);
      this.emit('viewChanged', viewId);
    });
  }

  /**
   * 뷰 전환
   */
  switchView(viewId) {
    if (!this.isValidView(viewId)) {
      console.warn(`Invalid view ID: ${viewId}`);
      return false;
    }

    if (this.currentView === viewId) {
      // 이미 활성화된 뷰인 경우 포커스만 이동
      this.focusCurrentView();
      return true;
    }

    const previousView = this.currentView;
    
    // 레이아웃 매니저를 통해 뷰 전환
    this.layoutManager.showView(viewId);
    
    // 뷰 전환 후 포커스 설정
    setTimeout(() => {
      this.focusCurrentView();
    }, 50);

    this.emit('viewSwitched', {
      from: previousView,
      to: viewId,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * 이전 뷰로 전환
   */
  switchToPreviousView() {
    if (this.viewHistory.length < 2) {
      return false;
    }

    // 현재 뷰를 제외한 이전 뷰
    const previousView = this.viewHistory[this.viewHistory.length - 2];
    return this.switchView(previousView);
  }

  /**
   * 사이드바 토글
   */
  toggleSidebar() {
    this.layoutManager.toggleSidebar();
    
    const isCollapsed = this.layoutManager.isSidebarCollapsed();
    this.emit('sidebarToggled', isCollapsed);
    
    if (!isCollapsed) {
      // 사이드바가 열렸을 때 현재 뷰에 포커스
      setTimeout(() => {
        this.focusCurrentView();
      }, 100);
    }
    
    return !isCollapsed;
  }

  /**
   * 현재 뷰에 포커스
   */
  focusCurrentView() {
    switch (this.currentView) {
      case 'explorer':
        return this.focusExplorer();
      case 'search':
        return this.focusSearch();
      case 'source-control':
        return this.focusSourceControl();
      case 'run-debug':
        return this.focusRunDebug();
      case 'extensions':
        return this.focusExtensions();
      default:
        return this.focusGenericView(this.currentView);
    }
  }

  /**
   * 액티비티 바에 포커스
   */
  focusActivityBar() {
    const container = this.layoutManager.getContainer();
    const activeItem = container.querySelector('.activity-bar-item.active');
    
    if (activeItem) {
      activeItem.focus();
      this.emit('focusChanged', { area: 'activityBar', element: activeItem });
      return true;
    }
    
    // 활성 아이템이 없으면 첫 번째 아이템에 포커스
    const firstItem = container.querySelector('.activity-bar-item');
    if (firstItem) {
      firstItem.focus();
      this.emit('focusChanged', { area: 'activityBar', element: firstItem });
      return true;
    }
    
    return false;
  }

  /**
   * 사이드바에 포커스
   */
  focusSidebar() {
    if (this.layoutManager.isSidebarCollapsed()) {
      // 사이드바가 접혀있으면 먼저 열기
      this.toggleSidebar();
      return false;
    }
    
    return this.focusCurrentView();
  }

  /**
   * 에디터에 포커스
   */
  focusEditor() {
    const editorContent = this.layoutManager.getEditorContent();
    
    if (!editorContent) {
      return false;
    }

    // BPMN 에디터가 있는지 확인
    const bpmnEditor = editorContent.querySelector('#bpmn-editor-container, .bpmn-js-container');
    if (bpmnEditor) {
      bpmnEditor.focus();
      this.emit('focusChanged', { area: 'editor', element: bpmnEditor, type: 'bpmn' });
      return true;
    }

    // 일반 포커스 가능한 요소 찾기
    const focusable = editorContent.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusable) {
      focusable.focus();
      this.emit('focusChanged', { area: 'editor', element: focusable, type: 'generic' });
      return true;
    }

    // 마지막으로 에디터 컨테이너 자체에 포커스
    editorContent.focus();
    this.emit('focusChanged', { area: 'editor', element: editorContent, type: 'container' });
    return true;
  }

  /**
   * 탐색기 뷰에 포커스
   */
  focusExplorer() {
    const container = this.layoutManager.getContainer();
    const explorerContainer = container.querySelector('.explorer-container');
    
    if (!explorerContainer || explorerContainer.style.display === 'none') {
      return false;
    }

    // 트리 뷰에 포커스
    const treeView = explorerContainer.querySelector('.tree-view');
    if (treeView) {
      const firstItem = treeView.querySelector('.tree-item[tabindex="0"]');
      if (firstItem) {
        firstItem.focus();
        this.emit('focusChanged', { area: 'explorer', element: firstItem, type: 'treeItem' });
        return true;
      }
      
      treeView.focus();
      this.emit('focusChanged', { area: 'explorer', element: treeView, type: 'treeView' });
      return true;
    }

    explorerContainer.focus();
    this.emit('focusChanged', { area: 'explorer', element: explorerContainer, type: 'container' });
    return true;
  }

  /**
   * 검색 뷰에 포커스
   */
  focusSearch() {
    return this.focusGenericView('search');
  }

  /**
   * 소스 제어 뷰에 포커스
   */
  focusSourceControl() {
    return this.focusGenericView('source-control');
  }

  /**
   * 실행 및 디버그 뷰에 포커스
   */
  focusRunDebug() {
    return this.focusGenericView('run-debug');
  }

  /**
   * 확장 뷰에 포커스
   */
  focusExtensions() {
    return this.focusGenericView('extensions');
  }

  /**
   * 일반 뷰에 포커스
   */
  focusGenericView(viewId) {
    const container = this.layoutManager.getContainer();
    const viewContainer = container.querySelector(`[data-view="${viewId}"]`);
    
    if (!viewContainer || viewContainer.style.display === 'none') {
      return false;
    }

    // 포커스 가능한 요소 찾기
    const focusable = viewContainer.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusable) {
      focusable.focus();
      this.emit('focusChanged', { area: viewId, element: focusable, type: 'focusable' });
      return true;
    }

    viewContainer.focus();
    this.emit('focusChanged', { area: viewId, element: viewContainer, type: 'container' });
    return true;
  }

  /**
   * 뷰 표시 이름 반환
   */
  getViewDisplayName(viewId) {
    return this.viewDisplayNames[viewId] || viewId;
  }

  /**
   * 현재 뷰 반환
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * 뷰 히스토리 반환
   */
  getViewHistory() {
    return [...this.viewHistory];
  }

  /**
   * 유효한 뷰인지 확인
   */
  isValidView(viewId) {
    return Object.keys(this.viewDisplayNames).includes(viewId);
  }

  /**
   * 뷰 히스토리에 추가
   */
  addToHistory(viewId) {
    // 중복 제거
    const index = this.viewHistory.indexOf(viewId);
    if (index > -1) {
      this.viewHistory.splice(index, 1);
    }
    
    // 현재 뷰를 히스토리 끝에 추가
    this.viewHistory.push(viewId);
    
    // 최대 길이 제한
    if (this.viewHistory.length > this.maxHistoryLength) {
      this.viewHistory.shift();
    }
    
    this.emit('historyUpdated', this.viewHistory);
  }

  /**
   * 뷰 히스토리 초기화
   */
  clearHistory() {
    this.viewHistory = [this.currentView];
    this.emit('historyCleared');
  }

  /**
   * 뷰 상태 정보 반환
   */
  getViewState() {
    return {
      currentView: this.currentView,
      displayName: this.getViewDisplayName(this.currentView),
      isSidebarCollapsed: this.layoutManager.isSidebarCollapsed(),
      sidebarWidth: this.layoutManager.getSidebarWidth(),
      history: this.getViewHistory()
    };
  }

  /**
   * 모든 뷰 숨김
   */
  hideAllViews() {
    this.layoutManager.hideAllViews();
    this.emit('allViewsHidden');
  }

  /**
   * 뷰 가시성 확인
   */
  isViewVisible(viewId) {
    const container = this.layoutManager.getContainer();
    const viewContainer = container.querySelector(`[data-view="${viewId}"]`);
    
    if (!viewContainer) {
      return false;
    }
    
    return viewContainer.style.display !== 'none' && 
           !this.layoutManager.isSidebarCollapsed();
  }

  /**
   * 다음 뷰로 순환
   */
  cycleToNextView() {
    const views = Object.keys(this.viewDisplayNames);
    const currentIndex = views.indexOf(this.currentView);
    const nextIndex = (currentIndex + 1) % views.length;
    const nextView = views[nextIndex];
    
    return this.switchView(nextView);
  }

  /**
   * 이전 뷰로 순환
   */
  cycleToPreviousView() {
    const views = Object.keys(this.viewDisplayNames);
    const currentIndex = views.indexOf(this.currentView);
    const previousIndex = currentIndex === 0 ? views.length - 1 : currentIndex - 1;
    const previousView = views[previousIndex];
    
    return this.switchView(previousView);
  }

  /**
   * 뷰 매니저 상태 반환
   */
  getStatus() {
    return {
      currentView: this.currentView,
      isInitialized: true,
      availableViews: Object.keys(this.viewDisplayNames),
      historyLength: this.viewHistory.length,
      isSidebarCollapsed: this.layoutManager.isSidebarCollapsed()
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 레이아웃 매니저 이벤트 구독 해제
    this.layoutManager.removeAllListeners('viewChanged');
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 참조 정리
    this.layoutManager = null;
    this.viewHistory = [];
    
    console.log('🗑️ VSCodeViewManager destroyed');
  }
}