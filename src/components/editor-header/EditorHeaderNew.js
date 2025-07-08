/**
 * Editor Header - 모듈형 리팩토링 버전
 * 헤더 렌더링과 이벤트 처리를 분리하여 완전한 에디터 헤더 기능 제공
 */

import { EditorHeaderCore } from './EditorHeaderCore.js';
import { EditorHeaderEventHandler } from './EditorHeaderEventHandler.js';

class EditorHeader {
    constructor() {
        // 핵심 모듈들 초기화
        this.core = new EditorHeaderCore();
        this.eventHandler = new EditorHeaderEventHandler(this.core);
        
        // 레거시 호환성을 위한 상태들
        this.container = null;
        this.breadcrumbData = [];
        this.connectedUsers = [];
        this.onDashboardClick = null;
        this.onBreadcrumbClick = null;
        
        this.init();
    }

    init() {
        try {
            // 모듈 간 이벤트 연결 설정
            this.setupModuleIntegration();
            
            // 레거시 호환성 설정
            this.setupLegacyCompatibility();
            
            console.log('✅ EditorHeader initialized with modular architecture');
            
        } catch (error) {
            console.error('❌ EditorHeader initialization failed:', error);
            throw error;
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 이벤트 핸들러 → 상태 동기화
        this.eventHandler.setEventHandlers({
            onDashboardClick: () => {
                if (this.onDashboardClick) {
                    this.onDashboardClick();
                }
            },
            onBreadcrumbClick: (id) => {
                if (this.onBreadcrumbClick) {
                    this.onBreadcrumbClick(id);
                }
            }
        });
    }

    /**
     * 레거시 호환성 설정
     */
    setupLegacyCompatibility() {
        // 컨테이너 참조 동기화
        this.container = this.core.getContainer();
        this.breadcrumbData = this.core.getBreadcrumbData();
        this.connectedUsers = this.core.getConnectedUsers();
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 브레드크럼 데이터 업데이트
     */
    updateBreadcrumb(breadcrumbData) {
        this.breadcrumbData = breadcrumbData;
        this.core.updateBreadcrumb(breadcrumbData);
        
        // 이벤트 리스너 재설정 (브레드크럼 변경 시 필요)
        this.eventHandler.refreshBreadcrumbListeners();
    }

    /**
     * 접속자 정보 업데이트
     */
    updateConnectedUsers(users) {
        this.connectedUsers = users;
        this.core.updateConnectedUsers(users);
    }

    /**
     * 헤더 컨테이너 반환
     */
    getContainer() {
        return this.core.getContainer();
    }

    /**
     * 이벤트 핸들러 설정
     */
    setEventHandlers({ onDashboardClick, onBreadcrumbClick }) {
        this.onDashboardClick = onDashboardClick;
        this.onBreadcrumbClick = onBreadcrumbClick;
        
        // 모듈에 전달
        this.eventHandler.setEventHandlers({
            onDashboardClick: this.onDashboardClick,
            onBreadcrumbClick: this.onBreadcrumbClick
        });
    }

    /**
     * 헤더 표시/숨김
     */
    setVisible(visible) {
        this.core.setVisible(visible);
    }

    /**
     * 표시 상태 확인
     */
    isVisible() {
        return this.core.getVisible();
    }

    // =============== 고급 기능 접근 ===============

    /**
     * 코어 모듈 반환
     */
    getCoreModule() {
        return this.core;
    }

    /**
     * 이벤트 핸들러 모듈 반환
     */
    getEventHandlerModule() {
        return this.eventHandler;
    }

    /**
     * 키보드 접근성 설정
     */
    setupKeyboardAccessibility() {
        return this.eventHandler.setupKeyboardAccessibility();
    }

    // =============== 상태 정보 ===============

    /**
     * 전체 상태 정보 반환
     */
    getStatus() {
        return {
            core: {
                isVisible: this.core.getVisible(),
                breadcrumbCount: this.core.getBreadcrumbData().length,
                connectedUsersCount: this.core.getConnectedUsers().length
            },
            eventHandler: this.eventHandler.getStatus(),
            legacy: {
                hasContainer: !!this.container,
                breadcrumbData: this.breadcrumbData,
                connectedUsers: this.connectedUsers,
                hasDashboardCallback: !!this.onDashboardClick,
                hasBreadcrumbCallback: !!this.onBreadcrumbClick
            }
        };
    }

    // =============== 레거시 메서드들 (하위 호환성) ===============

    /**
     * HTML 이스케이프 처리 (하위 호환성)
     */
    escapeHtml(text) {
        return this.core.escapeHtml(text);
    }

    /**
     * 브레드크럼 렌더링 (하위 호환성)
     */
    renderBreadcrumb() {
        return this.core.renderBreadcrumb();
    }

    /**
     * 접속자 렌더링 (하위 호환성)
     */
    renderConnectedUsers() {
        return this.core.renderConnectedUsers();
    }

    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ Destroying EditorHeader with all modules...');
        
        // 모듈들 정리
        if (this.eventHandler) {
            this.eventHandler.destroy();
        }
        
        if (this.core) {
            this.core.destroy();
        }
        
        // 레거시 상태 정리
        this.container = null;
        this.breadcrumbData = null;
        this.connectedUsers = null;
        this.onDashboardClick = null;
        this.onBreadcrumbClick = null;
        
        // 참조 정리
        this.core = null;
        this.eventHandler = null;
        
        console.log('✅ EditorHeader destroyed successfully');
    }
}

export default EditorHeader;