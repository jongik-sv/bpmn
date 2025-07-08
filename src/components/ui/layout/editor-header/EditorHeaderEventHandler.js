/**
 * Editor Header Event Handler - 이벤트 처리 전담
 * 브레드크럼 클릭, 버튼 클릭 등의 이벤트를 관리
 */

class EditorHeaderEventHandler {
    constructor(core) {
        this.core = core;
        this.onDashboardClick = null;
        this.onBreadcrumbClick = null;
        this.eventListeners = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 대시보드 버튼 클릭 이벤트
        const dashboardBtn = this.core.getDashboardButton();
        if (dashboardBtn) {
            const dashboardClickHandler = (e) => this.handleDashboardClick(e);
            dashboardBtn.addEventListener('click', dashboardClickHandler);
            this.eventListeners.push({ element: dashboardBtn, type: 'click', handler: dashboardClickHandler });
        }

        // 브레드크럼 클릭 이벤트 (이벤트 위임 사용)
        const breadcrumbList = this.core.getBreadcrumbList();
        if (breadcrumbList) {
            const breadcrumbClickHandler = (e) => this.handleBreadcrumbClick(e);
            breadcrumbList.addEventListener('click', breadcrumbClickHandler);
            this.eventListeners.push({ element: breadcrumbList, type: 'click', handler: breadcrumbClickHandler });
        }
    }

    /**
     * 대시보드 버튼 클릭 처리
     */
    handleDashboardClick(event) {
        event.preventDefault();
        
        if (this.onDashboardClick) {
            this.onDashboardClick();
        }
    }

    /**
     * 브레드크럼 클릭 처리
     */
    handleBreadcrumbClick(event) {
        const link = event.target.closest('.breadcrumb-link');
        if (!link) return;

        event.preventDefault();
        
        const action = link.dataset.action;
        const id = link.dataset.id;
        
        if (action === 'home') {
            this.triggerBreadcrumbClick('home');
        } else if (action === 'navigate' && id) {
            this.triggerBreadcrumbClick(id);
        }
    }

    /**
     * 브레드크럼 클릭 이벤트 트리거
     */
    triggerBreadcrumbClick(id) {
        if (this.onBreadcrumbClick) {
            this.onBreadcrumbClick(id);
        }
    }

    /**
     * 브레드크럼 업데이트 후 이벤트 리스너 재설정
     */
    refreshBreadcrumbListeners() {
        // 기존 브레드크럼 리스너 제거
        const existingListeners = this.eventListeners.filter(listener => 
            listener.element === this.core.getBreadcrumbList()
        );
        
        existingListeners.forEach(listener => {
            listener.element.removeEventListener(listener.type, listener.handler);
        });
        
        // 새 리스너 추가
        const breadcrumbList = this.core.getBreadcrumbList();
        if (breadcrumbList) {
            const breadcrumbClickHandler = (e) => this.handleBreadcrumbClick(e);
            breadcrumbList.addEventListener('click', breadcrumbClickHandler);
            
            // 기존 리스너를 새 리스너로 교체
            this.eventListeners = this.eventListeners.filter(listener => 
                listener.element !== breadcrumbList
            );
            this.eventListeners.push({ element: breadcrumbList, type: 'click', handler: breadcrumbClickHandler });
        }
    }

    /**
     * 대시보드 클릭 콜백 설정
     */
    setOnDashboardClick(callback) {
        this.onDashboardClick = callback;
    }

    /**
     * 브레드크럼 클릭 콜백 설정
     */
    setOnBreadcrumbClick(callback) {
        this.onBreadcrumbClick = callback;
    }

    /**
     * 이벤트 핸들러 일괄 설정
     */
    setEventHandlers({ onDashboardClick, onBreadcrumbClick }) {
        this.onDashboardClick = onDashboardClick;
        this.onBreadcrumbClick = onBreadcrumbClick;
    }

    /**
     * 키보드 접근성 지원
     */
    setupKeyboardAccessibility() {
        const container = this.core.getContainer();
        if (!container) return;

        // 브레드크럼 링크들에 키보드 이벤트 추가
        const breadcrumbLinks = container.querySelectorAll('.breadcrumb-link');
        breadcrumbLinks.forEach(link => {
            const keydownHandler = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    link.click();
                }
            };
            
            link.addEventListener('keydown', keydownHandler);
            this.eventListeners.push({ element: link, type: 'keydown', handler: keydownHandler });
        });

        // 대시보드 버튼 키보드 이벤트
        const dashboardBtn = this.core.getDashboardButton();
        if (dashboardBtn) {
            const keydownHandler = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dashboardBtn.click();
                }
            };
            
            dashboardBtn.addEventListener('keydown', keydownHandler);
            this.eventListeners.push({ element: dashboardBtn, type: 'keydown', handler: keydownHandler });
        }
    }

    /**
     * 상태 정보 반환
     */
    getStatus() {
        return {
            hasListeners: this.eventListeners.length > 0,
            listenerCount: this.eventListeners.length,
            hasDashboardCallback: !!this.onDashboardClick,
            hasBreadcrumbCallback: !!this.onBreadcrumbClick
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        // 모든 이벤트 리스너 제거
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
        
        // 콜백 정리
        this.onDashboardClick = null;
        this.onBreadcrumbClick = null;
    }
}

export { EditorHeaderEventHandler };