import { EventEmitter } from 'events';

/**
 * 애플리케이션 라우팅 관리 클래스
 * 페이지 전환, 브레드크럼, 히스토리 관리를 담당
 */
export class Router extends EventEmitter {
  constructor() {
    super();
    
    // 현재 라우트 상태
    this.currentRoute = {
      page: 'landing',
      params: {},
      query: {}
    };
    
    // 페이지 요소들
    this.pages = {
      landing: document.getElementById('landing-page'),
      dashboard: document.getElementById('dashboard-page'),
      editor: document.getElementById('editor-page')
    };
    
    // 페이지 요소들이 제대로 찾아졌는지 확인
    console.log('📝 Page elements check:');
    Object.entries(this.pages).forEach(([name, element]) => {
      console.log(`  - ${name}:`, element ? '✅' : '❌', element ? 'found' : 'not found');
    });
    
    // 라우트 히스토리
    this.history = [];
    this.currentHistoryIndex = -1;
    
    // 페이지 애니메이션 설정
    this.animationDuration = 300;
    
    this.init();
  }

  /**
   * 라우터 초기화
   */
  init() {
    // 브라우저 히스토리 이벤트 리스너
    window.addEventListener('popstate', (event) => {
      this.handlePopState(event);
    });
    
    // 초기 라우트 설정
    this.setInitialRoute();
    
    console.log('🚀 Router initialized');
  }

  /**
   * 초기 라우트 설정
   */
  setInitialRoute() {
    const hash = window.location.hash;
    const params = this.parseHashParams(hash);
    
    if (params.page) {
      this.currentRoute = {
        page: params.page,
        params: params.params || {},
        query: params.query || {}
      };
    }
    
    this.emit('routeInitialized', this.currentRoute);
  }

  /**
   * 페이지 이동
   */
  async navigateTo(page, params = {}, options = {}) {
    try {
      console.log(`🔄 Navigating to ${page}`, params);
      console.log(`📍 Current route:`, this.currentRoute);
      
      const previousRoute = { ...this.currentRoute };
      const newRoute = {
        page,
        params,
        query: options.query || {}
      };
      
      console.log(`🔄 Route transition:`, previousRoute.page, '→', newRoute.page);
      
      // 라우트 변경 전 이벤트 발생
      const canNavigate = await this.emitWithResponse('beforeNavigate', {
        from: previousRoute,
        to: newRoute,
        options
      });
      
      if (canNavigate === false) {
        console.log('❌ Navigation cancelled by beforeNavigate handler');
        return false;
      }
      
      // 현재 페이지 숨기기
      await this.hidePage(previousRoute.page);
      
      // 새 페이지 표시
      await this.showPage(page, params, options);
      
      // 라우트 상태 업데이트
      this.currentRoute = newRoute;
      
      // 히스토리 업데이트
      if (!options.replaceHistory) {
        this.addToHistory(newRoute);
      }
      
      // URL 업데이트
      if (!options.skipUrlUpdate) {
        this.updateUrl(newRoute);
      }
      
      // 라우트 변경 완료 이벤트
      this.emit('routeChanged', {
        from: previousRoute,
        to: newRoute,
        options
      });
      
      console.log(`✅ Navigation to ${page} completed`);
      return true;
      
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      this.emit('navigationError', { page, params, options, error });
      return false;
    }
  }

  /**
   * 페이지 표시
   */
  async showPage(page, params = {}, options = {}) {
    console.log(`📺 Showing page: ${page}`);
    const pageElement = this.pages[page];
    console.log(`📺 Page element found:`, !!pageElement);
    
    if (!pageElement) {
      throw new Error(`Page not found: ${page}`);
    }
    
    // 페이지별 전처리
    console.log(`🔄 Preparing page for display: ${page}`);
    await this.preparePageForDisplay(page, params, options);
    
    // 애니메이션과 함께 표시
    console.log(`🎨 Animating page: ${page}`);
    console.log(`🎨 Page element visibility before show:`, pageElement.offsetWidth > 0 && pageElement.offsetHeight > 0);
    
    // 다른 페이지들 숨기기
    Object.entries(this.pages).forEach(([name, element]) => {
      if (name !== page && element) {
        element.style.display = 'none';
      }
    });
    
    // 현재 페이지 표시
    pageElement.style.display = 'block';
    
    console.log(`🎨 Page element visibility after show:`, pageElement.offsetWidth > 0 && pageElement.offsetHeight > 0);
    
    // 페이지 표시 완료 이벤트
    this.emit('pageShown', { page, params, options });
    console.log(`✅ Page shown: ${page}`);
  }

  /**
   * 페이지 숨기기
   */
  async hidePage(page, options = {}) {
    console.log(`🙈 Hiding page: ${page}`);
    const pageElement = this.pages[page];
    if (!pageElement) {
      console.log(`⚠️ No page element to hide: ${page}`);
      return;
    }
    
    // 페이지별 후처리
    await this.cleanupPageAfterHide(page, options);
    
    // 페이지 숨김
    pageElement.style.display = 'none';
    
    // 페이지 숨김 완료 이벤트
    this.emit('pageHidden', { page, options });
    console.log(`✅ Page hidden: ${page}`);
  }

  /**
   * 페이지 표시 전 전처리
   */
  async preparePageForDisplay(page, params, options) {
    switch (page) {
      case 'landing':
        this.emit('prepareLanding', { params, options });
        break;
      case 'dashboard':
        this.emit('prepareDashboard', { params, options });
        break;
      case 'editor':
        this.emit('prepareEditor', { params, options });
        break;
    }
  }

  /**
   * 페이지 숨김 후 후처리
   */
  async cleanupPageAfterHide(page, options) {
    switch (page) {
      case 'landing':
        this.emit('cleanupLanding', { options });
        break;
      case 'dashboard':
        this.emit('cleanupDashboard', { options });
        break;
      case 'editor':
        this.emit('cleanupEditor', { options });
        break;
    }
  }

  /**
   * 뒤로 가기
   */
  async goBack() {
    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      const previousRoute = this.history[this.currentHistoryIndex];
      
      await this.navigateTo(
        previousRoute.page,
        previousRoute.params,
        {
          ...previousRoute.query,
          skipUrlUpdate: false,
          replaceHistory: true,
          isBackNavigation: true
        }
      );
      
      return true;
    }
    return false;
  }

  /**
   * 앞으로 가기
   */
  async goForward() {
    if (this.currentHistoryIndex < this.history.length - 1) {
      this.currentHistoryIndex++;
      const nextRoute = this.history[this.currentHistoryIndex];
      
      await this.navigateTo(
        nextRoute.page,
        nextRoute.params,
        {
          ...nextRoute.query,
          skipUrlUpdate: false,
          replaceHistory: true,
          isForwardNavigation: true
        }
      );
      
      return true;
    }
    return false;
  }

  /**
   * 히스토리에 라우트 추가
   */
  addToHistory(route) {
    // 현재 위치 이후의 히스토리 제거 (새로운 경로로 분기)
    this.history = this.history.slice(0, this.currentHistoryIndex + 1);
    
    // 새 라우트 추가
    this.history.push({ ...route });
    this.currentHistoryIndex = this.history.length - 1;
    
    // 히스토리 크기 제한 (최대 50개)
    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
      this.currentHistoryIndex = this.history.length - 1;
    }
  }

  /**
   * URL 업데이트
   */
  updateUrl(route) {
    const hash = this.routeToHash(route);
    
    if (window.location.hash !== hash) {
      window.history.pushState(
        { route },
        `${route.page} - BPMN Editor`,
        `${window.location.pathname}${hash}`
      );
    }
  }

  /**
   * 라우트를 해시로 변환
   */
  routeToHash(route) {
    let hash = `#${route.page}`;
    
    // 파라미터 추가
    const allParams = { ...route.params, ...route.query };
    const paramString = Object.keys(allParams)
      .filter(key => allParams[key] !== undefined && allParams[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');
    
    if (paramString) {
      hash += `?${paramString}`;
    }
    
    return hash;
  }

  /**
   * 해시에서 파라미터 파싱
   */
  parseHashParams(hash) {
    if (!hash || hash === '#') {
      return { page: 'landing', params: {}, query: {} };
    }
    
    // # 제거
    hash = hash.substring(1);
    
    // 페이지와 쿼리 분리
    const [page, queryString] = hash.split('?');
    const params = {};
    const query = {};
    
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          const decodedKey = decodeURIComponent(key);
          const decodedValue = decodeURIComponent(value);
          
          // 특정 파라미터는 params에, 나머지는 query에
          if (['projectId', 'diagramId', 'folderId'].includes(decodedKey)) {
            params[decodedKey] = decodedValue;
          } else {
            query[decodedKey] = decodedValue;
          }
        }
      });
    }
    
    return { page: page || 'landing', params, query };
  }

  /**
   * 브라우저 히스토리 이벤트 처리
   */
  handlePopState(event) {
    const hash = window.location.hash;
    const routeData = this.parseHashParams(hash);
    
    this.navigateTo(
      routeData.page,
      routeData.params,
      {
        query: routeData.query,
        skipUrlUpdate: true,
        replaceHistory: true,
        isBrowserNavigation: true
      }
    );
  }

  /**
   * 응답이 있는 이벤트 발생
   */
  async emitWithResponse(eventName, data) {
    return new Promise((resolve) => {
      let responded = false;
      
      const respondOnce = (response) => {
        if (!responded) {
          responded = true;
          resolve(response);
        }
      };
      
      this.emit(eventName, data, respondOnce);
      
      // 1초 후 타임아웃 (기본적으로 허용)
      setTimeout(() => {
        respondOnce(true);
      }, 1000);
    });
  }

  /**
   * 현재 라우트 정보 반환
   */
  getCurrentRoute() {
    return { ...this.currentRoute };
  }

  /**
   * 특정 페이지인지 확인
   */
  isCurrentPage(page) {
    return this.currentRoute.page === page;
  }

  /**
   * 라우트 파라미터 가져오기
   */
  getParam(key) {
    return this.currentRoute.params[key];
  }

  /**
   * 쿼리 파라미터 가져오기
   */
  getQuery(key) {
    return this.currentRoute.query[key];
  }

  /**
   * 히스토리 정보 반환
   */
  getHistory() {
    return {
      history: [...this.history],
      currentIndex: this.currentHistoryIndex,
      canGoBack: this.currentHistoryIndex > 0,
      canGoForward: this.currentHistoryIndex < this.history.length - 1
    };
  }

  /**
   * 라우터 상태 정보 반환
   */
  getStatus() {
    return {
      currentRoute: this.getCurrentRoute(),
      history: this.getHistory(),
      pages: Object.keys(this.pages)
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 제거
    window.removeEventListener('popstate', this.handlePopState);
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 상태 초기화
    this.currentRoute = null;
    this.history = [];
    this.currentHistoryIndex = -1;
    this.pages = {};
    
    console.log('🗑️ Router destroyed');
  }
}

export default Router;