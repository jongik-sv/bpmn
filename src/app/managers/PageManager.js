import { EventEmitter } from 'events';
import $ from 'jquery';

/**
 * 페이지 전환 및 네비게이션 관리 전담 클래스
 * 랜딩, 대시보드, 에디터 페이지 간의 전환과 UI 상태 관리
 */
export class PageManager extends EventEmitter {
  constructor() {
    super();
    
    // 현재 페이지 상태
    this.currentPage = 'landing';
    
    // 페이지 요소들
    this.landingPage = $('#landing-page');
    this.dashboardPage = $('#dashboard-page');
    this.editorPage = $('#editor-page');
    
    // 페이지 히스토리
    this.pageHistory = [];
    this.maxHistoryLength = 10;
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupPageEventListeners();
    this.setupNavigationButtons();
    this.emit('pageManagerInitialized');
  }

  /**
   * 페이지 이벤트 리스너 설정
   */
  setupPageEventListeners() {
    // 랜딩 페이지 이벤트
    $('#login-btn').on('click', () => {
      this.emit('loginRequested');
    });

    $('#signup-btn').on('click', () => {
      this.emit('signupRequested');
    });

    // 대시보드 이벤트
    $('#create-project-btn').on('click', () => {
      this.emit('createProjectRequested');
    });

    $('#invite-users-btn').on('click', () => {
      this.emit('inviteUsersRequested');
    });

    $('#user-menu-btn').on('click', () => {
      this.emit('userMenuRequested');
    });

    // 에디터 페이지 이벤트
    $('#back-to-dashboard').on('click', () => {
      this.showDashboard();
    });

    // 프로젝트 카드 클릭 (동적)
    $(document).on('click', '.project-card:not(.create-project-card)', (e) => {
      const projectId = $(e.currentTarget).data('project-id');
      this.emit('projectOpenRequested', projectId);
    });

    $(document).on('click', '.create-project-card', () => {
      this.emit('createProjectRequested');
    });

    this.emit('pageEventListenersSetup');
  }

  /**
   * 네비게이션 버튼 설정
   */
  setupNavigationButtons() {
    // 브라우저 뒤로가기/앞으로가기 지원
    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.page) {
        this.showPage(event.state.page, false);
      }
    });

    // 키보드 단축키
    $(document).on('keydown', (e) => {
      // Escape 키로 이전 페이지로 이동
      if (e.key === 'Escape' && this.canGoBack()) {
        this.goBack();
      }
    });
  }

  /**
   * 랜딩 페이지 표시
   */
  showLanding(addToHistory = true) {
    this.showPage('landing', addToHistory);
    this.emit('landingPageShown');
  }

  /**
   * 대시보드 페이지 표시
   */
  async showDashboard(addToHistory = true) {
    this.showPage('dashboard', addToHistory);
    
    // 대시보드 전용 이벤트들
    this.emit('dashboardPageShown');
    
    // 협업 세션 해제 요청
    this.emit('collaborationDisconnectRequested');
    
    // 사용자 이름 표시 요청
    this.emit('userDisplayUpdateRequested');
    
    // 프로젝트 목록 로드 요청
    this.emit('projectsLoadRequested');
  }

  /**
   * 에디터 페이지 표시
   */
  async showEditor(project, addToHistory = true) {
    this.showPage('editor', addToHistory);
    
    // 프로젝트 이름 표시
    $('#current-project-name').text(project.name);
    
    // 에디터 초기화 이벤트들
    this.emit('editorPageShown', project);
    this.emit('vscodeLayoutInitRequested');
    this.emit('bpmnEditorResetRequested');
    this.emit('projectDataLoadRequested', project);
  }

  /**
   * 기본 페이지 전환 로직
   */
  showPage(pageName, addToHistory = true) {
    const previousPage = this.currentPage;
    this.currentPage = pageName;
    
    // 모든 페이지 숨기기
    this.landingPage.hide();
    this.dashboardPage.hide();
    this.editorPage.hide();
    
    // 해당 페이지 표시
    switch (pageName) {
      case 'landing':
        this.landingPage.show();
        break;
      case 'dashboard':
        this.dashboardPage.show();
        break;
      case 'editor':
        this.editorPage.show();
        break;
      default:
        console.warn('Unknown page:', pageName);
        this.landingPage.show();
        this.currentPage = 'landing';
    }
    
    // 히스토리 관리
    if (addToHistory) {
      this.addToHistory(previousPage);
      this.updateBrowserHistory(pageName);
    }
    
    // 페이지 전환 완료 이벤트
    this.emit('pageChanged', {
      from: previousPage,
      to: this.currentPage,
      timestamp: Date.now()
    });
    
    console.log(`📄 Page changed: ${previousPage} → ${this.currentPage}`);
  }

  /**
   * 히스토리에 페이지 추가
   */
  addToHistory(page) {
    if (page && page !== this.currentPage) {
      this.pageHistory.push({
        page: page,
        timestamp: Date.now()
      });
      
      // 히스토리 길이 제한
      if (this.pageHistory.length > this.maxHistoryLength) {
        this.pageHistory = this.pageHistory.slice(-this.maxHistoryLength);
      }
    }
  }

  /**
   * 브라우저 히스토리 업데이트
   */
  updateBrowserHistory(page) {
    const state = { page: page };
    const url = this.getPageUrl(page);
    
    try {
      window.history.pushState(state, '', url);
    } catch (error) {
      console.warn('Failed to update browser history:', error);
    }
  }

  /**
   * 페이지별 URL 반환
   */
  getPageUrl(page) {
    switch (page) {
      case 'landing':
        return '/';
      case 'dashboard':
        return '/dashboard';
      case 'editor':
        return '/editor';
      default:
        return '/';
    }
  }

  /**
   * 이전 페이지로 이동
   */
  goBack() {
    if (this.pageHistory.length > 0) {
      const previousEntry = this.pageHistory.pop();
      this.showPage(previousEntry.page, false);
      this.emit('pageBackNavigated', previousEntry.page);
      return true;
    }
    return false;
  }

  /**
   * 뒤로 가기 가능 여부
   */
  canGoBack() {
    return this.pageHistory.length > 0;
  }

  /**
   * 특정 페이지로 강제 이동
   */
  navigateTo(page, data = null) {
    switch (page) {
      case 'landing':
        this.showLanding();
        break;
      case 'dashboard':
        this.showDashboard();
        break;
      case 'editor':
        if (data && data.project) {
          this.showEditor(data.project);
        } else {
          console.warn('Editor navigation requires project data');
        }
        break;
      default:
        console.warn('Unknown navigation target:', page);
        this.showLanding();
    }
  }

  /**
   * 페이지 전환 애니메이션 (향후 확장용)
   */
  async animatePageTransition(fromPage, toPage) {
    // TODO: 페이지 전환 애니메이션 구현
    // 현재는 즉시 전환
    return Promise.resolve();
  }

  /**
   * 에러 페이지 표시
   */
  showErrorPage(error, canGoBack = true) {
    const errorHtml = `
      <div class="error-page" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background-color: #1e1e1e;
        color: #cccccc;
        text-align: center;
        padding: 20px;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h1 style="margin-bottom: 10px;">오류가 발생했습니다</h1>
        <p style="margin-bottom: 20px; color: #999;">${error.message || '알 수 없는 오류'}</p>
        ${canGoBack ? '<button onclick="window.appManager.pageManager.goBack()" style="padding: 10px 20px; background-color: #007ACC; color: white; border: none; border-radius: 4px; cursor: pointer;">이전 페이지로</button>' : ''}
      </div>
    `;
    
    $('body').append(errorHtml);
    this.emit('errorPageShown', error);
  }

  /**
   * 로딩 오버레이 표시/숨김
   */
  showLoadingOverlay(message = '로딩 중...') {
    const overlay = `
      <div id="page-loading-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
      ">
        <div style="text-align: center;">
          <div class="spinner" style="
            width: 40px;
            height: 40px;
            border: 4px solid #333;
            border-top: 4px solid #007ACC;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
          "></div>
          <div>${message}</div>
        </div>
      </div>
    `;
    
    $('#page-loading-overlay').remove();
    $('body').append(overlay);
    
    // CSS 애니메이션 추가
    if (!document.getElementById('spinner-styles')) {
      const style = document.createElement('style');
      style.id = 'spinner-styles';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  hideLoadingOverlay() {
    $('#page-loading-overlay').remove();
  }

  /**
   * 현재 페이지 반환
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * 페이지 히스토리 반환
   */
  getPageHistory() {
    return [...this.pageHistory];
  }

  /**
   * 특정 페이지가 현재 페이지인지 확인
   */
  isCurrentPage(page) {
    return this.currentPage === page;
  }

  /**
   * 페이지 유효성 검사
   */
  isValidPage(page) {
    return ['landing', 'dashboard', 'editor'].includes(page);
  }

  /**
   * 페이지 상태 정보 반환
   */
  getPageStatus() {
    return {
      currentPage: this.currentPage,
      historyLength: this.pageHistory.length,
      canGoBack: this.canGoBack(),
      isValidPage: this.isValidPage(this.currentPage),
      lastPageChange: this.pageHistory[this.pageHistory.length - 1]?.timestamp || null
    };
  }

  /**
   * 페이지 전환 시 정리 작업
   */
  cleanup() {
    // 오버레이 제거
    this.hideLoadingOverlay();
    $('.error-page').remove();
    $('.user-menu-dropdown').remove();
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 정리
    $('#login-btn, #signup-btn, #create-project-btn, #invite-users-btn, #user-menu-btn, #back-to-dashboard').off('click');
    $(document).off('click', '.project-card, .create-project-card');
    $(document).off('keydown');
    
    // 브라우저 이벤트 정리
    window.removeEventListener('popstate', this.handlePopState);
    
    // 상태 초기화
    this.currentPage = 'landing';
    this.pageHistory = [];
    
    // 정리 작업
    this.cleanup();
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 페이지 요소 참조 정리
    this.landingPage = null;
    this.dashboardPage = null;
    this.editorPage = null;
    
    console.log('🗑️ PageManager destroyed');
  }
}