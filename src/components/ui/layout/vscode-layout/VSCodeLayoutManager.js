import { EventEmitter } from 'events';

/**
 * VS Code 스타일 레이아웃 관리 클래스
 * 기본 레이아웃 구조, 사이드바 크기 조정, 상태 관리를 담당
 */
export class VSCodeLayoutManager extends EventEmitter {
  constructor(container) {
    super();
    
    this.container = container;
    
    // 레이아웃 상태
    this.currentView = 'explorer';
    this.isCollapsed = false;
    this.sidebarWidth = 240;
    this.minSidebarWidth = 120;
    this.maxSidebarWidth = 600;
    
    // DOM 요소 참조
    this.elements = {
      layout: null,
      activityBarContainer: null,
      sidebarContainer: null,
      sidebarContent: null,
      resizeHandle: null,
      editorContainer: null,
      editorHeaderContainer: null,
      editorContent: null
    };
    
    this.createLayout();
    this.setupSidebarResize();
    this.setupWelcomeActions();
    this.loadLayoutState();
  }

  /**
   * 기본 레이아웃 구조 생성
   */
  createLayout() {
    this.container.innerHTML = `
      <div class="vscode-layout" style="display: flex; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; background-color: #252526; color: #cccccc;">
        <div class="activity-bar-container" style="width: 48px; background-color: #2c2c2c; border-right: 1px solid #3e3e3e;"></div>
        <div class="sidebar-container" style="display: flex; width: 280px; min-width: 200px; max-width: 400px; background-color: #252526; border-right: 1px solid #3e3e3e; position: relative;">
          <div class="sidebar-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <div class="explorer-container" data-view="explorer" style="flex: 1; overflow: auto;"></div>
            <div class="search-container" data-view="search" style="display: none;">
              <div class="view-placeholder" style="padding: 20px; text-align: center;">
                <h3 style="color: #cccccc; margin-bottom: 10px;">검색</h3>
                <p style="color: #999999;">검색 기능이 여기에 표시됩니다.</p>
              </div>
            </div>
            <div class="source-control-container" data-view="source-control" style="display: none;">
              <div class="view-placeholder" style="padding: 20px; text-align: center;">
                <h3 style="color: #cccccc; margin-bottom: 10px;">소스 제어</h3>
                <p style="color: #999999;">Git 소스 제어 기능이 여기에 표시됩니다.</p>
              </div>
            </div>
            <div class="run-debug-container" data-view="run-debug" style="display: none;">
              <div class="view-placeholder" style="padding: 20px; text-align: center;">
                <h3 style="color: #cccccc; margin-bottom: 10px;">실행 및 디버그</h3>
                <p style="color: #999999;">디버그 기능이 여기에 표시됩니다.</p>
              </div>
            </div>
            <div class="extensions-container" data-view="extensions" style="display: none;">
              <div class="view-placeholder" style="padding: 20px; text-align: center;">
                <h3 style="color: #cccccc; margin-bottom: 10px;">확장</h3>
                <p style="color: #999999;">확장 프로그램이 여기에 표시됩니다.</p>
              </div>
            </div>
          </div>
          <div class="sidebar-resize-handle" style="width: 4px; background-color: transparent; cursor: col-resize; position: absolute; right: 0; top: 0; bottom: 0; z-index: 10;"></div>
        </div>
        <div class="editor-container" style="flex: 1; display: flex; flex-direction: column; background-color: #1e1e1e; overflow: hidden; min-height: 0;">
          <!-- Editor Header will be inserted here -->
          <div class="editor-header-container" style="display: none;"></div>
          <div class="editor-content" style="flex: 1; position: relative; min-height: 0; display: flex; overflow: hidden;">
            <div class="editor-welcome-message" style="flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #cccccc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif; background-color: #1e1e1e;">
              <div style="text-align: center; max-width: 400px;">
                <div style="font-size: 48px; margin-bottom: 24px; opacity: 0.6;">📄</div>
                <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 300; color: #ffffff;">BPMN 다이어그램을 선택하세요</h2>
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #999999;">
                  왼쪽 탐색기에서 BPMN 다이어그램을 클릭하여 편집을 시작하세요.
                </p>
                <div style="display: flex; gap: 24px; justify-content: center; align-items: center; margin-top: 32px;">
                  <div class="welcome-action-btn" data-action="create-folder" style="text-align: center; font-size: 14px; color: #888888; cursor: pointer; padding: 16px; border-radius: 8px; transition: all 0.2s; border: 1px solid transparent;">
                    <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
                    <span>새 폴더 만들기</span>
                  </div>
                  <div class="welcome-action-btn" data-action="create-diagram" style="text-align: center; font-size: 14px; color: #888888; cursor: pointer; padding: 16px; border-radius: 8px; transition: all 0.2s; border: 1px solid transparent;">
                    <div style="font-size: 28px; margin-bottom: 8px;">📄</div>
                    <span>새 다이어그램 만들기</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- BPMN Editor will be inserted here -->
          </div>
        </div>
      </div>
    `;

    // DOM 요소 참조 캐시
    this.cacheElements();
  }

  /**
   * DOM 요소 참조 캐시
   */
  cacheElements() {
    this.elements = {
      layout: this.container.querySelector('.vscode-layout'),
      activityBarContainer: this.container.querySelector('.activity-bar-container'),
      sidebarContainer: this.container.querySelector('.sidebar-container'),
      sidebarContent: this.container.querySelector('.sidebar-content'),
      resizeHandle: this.container.querySelector('.sidebar-resize-handle'),
      editorContainer: this.container.querySelector('.editor-container'),
      editorHeaderContainer: this.container.querySelector('.editor-header-container'),
      editorContent: this.container.querySelector('.editor-content')
    };
    
    // 캐시된 요소들 유효성 검사
    for (const [key, element] of Object.entries(this.elements)) {
      if (!element) {
        console.warn(`Layout element not found: ${key}`);
      }
    }
  }

  /**
   * Welcome 메시지 액션 설정
   */
  setupWelcomeActions() {
    // Welcome 액션 버튼에 이벤트 리스너 추가
    const actionButtons = this.container.querySelectorAll('.welcome-action-btn');
    actionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleWelcomeAction(action);
      });
      
      // 호버 효과
      button.addEventListener('mouseenter', (e) => {
        e.currentTarget.style.backgroundColor = '#333333';
        e.currentTarget.style.borderColor = '#555555';
        e.currentTarget.style.color = '#ffffff';
      });
      
      button.addEventListener('mouseleave', (e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.color = '#888888';
      });
    });
  }

  /**
   * Welcome 액션 처리
   */
  handleWelcomeAction(action) {
    switch (action) {
      case 'create-folder':
        if (window.appManager) {
          window.appManager.createNewFolder();
        }
        break;
      case 'create-diagram':
        if (window.appManager) {
          window.appManager.createNewDiagram();
        }
        break;
    }
  }

  /**
   * 사이드바 리사이즈 기능 설정
   */
  setupSidebarResize() {
    if (!this.elements.resizeHandle || !this.elements.sidebarContainer) {
      console.warn('Resize elements not found');
      return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const handleMouseMove = (event) => {
      if (!isResizing) return;

      const deltaX = event.clientX - startX;
      const newWidth = Math.max(
        this.minSidebarWidth,
        Math.min(this.maxSidebarWidth, startWidth + deltaX)
      );

      this.setSidebarWidth(newWidth);
      this.emit('sidebarResized', newWidth);
    };

    const handleMouseUp = () => {
      if (!isResizing) return;

      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      this.saveLayoutState();
      this.emit('sidebarResizeEnd', this.sidebarWidth);
    };

    this.elements.resizeHandle.addEventListener('mousedown', (event) => {
      isResizing = true;
      startX = event.clientX;
      startWidth = parseInt(window.getComputedStyle(this.elements.sidebarContainer).width, 10);

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      this.emit('sidebarResizeStart', startWidth);
    });
  }

  /**
   * 뷰 컨테이너 요소 반환
   */
  getViewContainer(viewId) {
    return this.container.querySelector(`[data-view="${viewId}"]`);
  }

  /**
   * 모든 뷰 컨테이너 숨김
   */
  hideAllViews() {
    const viewContainers = this.container.querySelectorAll('[data-view]');
    viewContainers.forEach(container => {
      container.style.display = 'none';
    });
  }

  /**
   * 특정 뷰 표시
   */
  showView(viewId) {
    this.hideAllViews();
    const viewContainer = this.getViewContainer(viewId);
    if (viewContainer) {
      viewContainer.style.display = 'flex';
      this.currentView = viewId;
      this.emit('viewChanged', viewId);
    }
  }

  /**
   * 사이드바 토글
   */
  toggleSidebar() {
    if (!this.elements.sidebarContainer) return;

    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.elements.sidebarContainer.style.width = '0px';
      this.elements.sidebarContainer.style.minWidth = '0px';
      this.elements.sidebarContainer.style.overflow = 'hidden';
    } else {
      this.elements.sidebarContainer.style.width = `${this.sidebarWidth}px`;
      this.elements.sidebarContainer.style.minWidth = `${this.minSidebarWidth}px`;
      this.elements.sidebarContainer.style.overflow = 'visible';
    }

    this.saveLayoutState();
    this.emit('sidebarToggled', this.isCollapsed);
  }

  /**
   * 사이드바 너비 설정
   */
  setSidebarWidth(width) {
    const clampedWidth = Math.max(
      this.minSidebarWidth,
      Math.min(this.maxSidebarWidth, width)
    );

    this.sidebarWidth = clampedWidth;
    
    if (this.elements.sidebarContainer && !this.isCollapsed) {
      this.elements.sidebarContainer.style.width = `${clampedWidth}px`;
    }
  }

  /**
   * 사이드바 너비 반환
   */
  getSidebarWidth() {
    return this.sidebarWidth;
  }

  /**
   * 현재 뷰 반환
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * 사이드바 접힌 상태 반환
   */
  isSidebarCollapsed() {
    return this.isCollapsed;
  }

  /**
   * 레이아웃 상태 저장
   */
  saveLayoutState() {
    try {
      const layoutState = {
        currentView: this.currentView,
        isCollapsed: this.isCollapsed,
        sidebarWidth: this.sidebarWidth
      };
      localStorage.setItem('vscode-layout-state', JSON.stringify(layoutState));
      this.emit('stateSaved', layoutState);
    } catch (error) {
      console.warn('Failed to save layout state:', error);
    }
  }

  /**
   * 레이아웃 상태 로드
   */
  loadLayoutState() {
    try {
      const stored = localStorage.getItem('vscode-layout-state');
      if (stored) {
        const layoutState = JSON.parse(stored);
        
        this.currentView = layoutState.currentView || 'explorer';
        this.isCollapsed = layoutState.isCollapsed || false;
        this.sidebarWidth = layoutState.sidebarWidth || 240;
        
        // 상태 적용
        this.showView(this.currentView);
        if (this.isCollapsed) {
          this.toggleSidebar();
        } else {
          this.setSidebarWidth(this.sidebarWidth);
        }
        
        this.emit('stateLoaded', layoutState);
      }
    } catch (error) {
      console.warn('Failed to load layout state:', error);
    }
  }

  /**
   * 윈도우 리사이즈 처리
   */
  handleWindowResize() {
    // 사이드바 크기 재조정
    if (this.elements.sidebarContainer && !this.isCollapsed) {
      const containerWidth = this.container.clientWidth;
      const maxAllowedWidth = Math.min(this.maxSidebarWidth, containerWidth * 0.5);
      
      if (this.sidebarWidth > maxAllowedWidth) {
        this.setSidebarWidth(maxAllowedWidth);
      }
    }
    
    this.emit('windowResized');
  }

  /**
   * DOM 요소 접근자들
   */
  getContainer() {
    return this.container;
  }

  getElement(elementKey) {
    return this.elements[elementKey];
  }

  getActivityBarContainer() {
    return this.elements.activityBarContainer;
  }

  getExplorerContainer() {
    return this.getViewContainer('explorer');
  }

  getEditorContainer() {
    return this.elements.editorContainer;
  }

  getEditorContent() {
    return this.elements.editorContent;
  }

  getEditorHeaderContainer() {
    return this.elements.editorHeaderContainer;
  }

  /**
   * Welcome 메시지 표시
   */
  showWelcomeMessage() {
    const welcomeMessage = this.container.querySelector('.editor-welcome-message');
    if (welcomeMessage) {
      welcomeMessage.style.display = 'flex';
    }
    
    // BPMN 에디터 숨기기
    const bpmnEditor = this.container.querySelector('#bpmn-editor-container');
    if (bpmnEditor) {
      bpmnEditor.style.display = 'none';
    }
    
    // 에디터 헤더 숨기기
    if (this.elements.editorHeaderContainer) {
      this.elements.editorHeaderContainer.style.display = 'none';
    }
  }

  /**
   * BPMN 에디터 표시
   */
  showBPMNEditor() {
    const welcomeMessage = this.container.querySelector('.editor-welcome-message');
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
    
    // BPMN 에디터 표시
    const bpmnEditor = this.container.querySelector('#bpmn-editor-container');
    if (bpmnEditor) {
      bpmnEditor.style.display = 'flex';
    }
    
    // 에디터 헤더 표시
    if (this.elements.editorHeaderContainer) {
      this.elements.editorHeaderContainer.style.display = 'block';
    }
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.removeAllListeners();
    
    // DOM 이벤트 리스너 정리
    if (this.elements.resizeHandle) {
      this.elements.resizeHandle.replaceWith(this.elements.resizeHandle.cloneNode(true));
    }
    
    // 참조 정리
    this.elements = {};
    this.container = null;
    
    console.log('🗑️ VSCodeLayoutManager destroyed');
  }
}