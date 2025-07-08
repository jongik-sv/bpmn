/**
 * Activity Bar - 모듈형 리팩토링 버전
 * 코어 렌더링과 이벤트 처리를 분리하여 완전한 Activity Bar 기능 제공
 */

import { ActivityBarCore } from './ActivityBarCore.js';
import { ActivityBarEventHandler } from './ActivityBarEventHandler.js';

class ActivityBar {
    constructor(container) {
        this.container = container;
        
        // 핵심 모듈들 초기화
        this.core = new ActivityBarCore(container);
        this.eventHandler = new ActivityBarEventHandler(this.core);
        
        // 레거시 호환성을 위한 상태들
        this.activeView = 'explorer';
        this.onViewChange = null;
        
        this.init();
    }

    init() {
        try {
            // 모듈 간 이벤트 연결 설정
            this.setupModuleIntegration();
            
            console.log('✅ ActivityBar initialized with modular architecture');
            
        } catch (error) {
            console.error('❌ ActivityBar initialization failed:', error);
            throw error;
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 이벤트 핸들러 → 상태 동기화
        this.eventHandler.setOnViewChangeCallback((viewId, previousViewId) => {
            this.activeView = viewId;
            
            // 외부 콜백 호출
            if (this.onViewChange) {
                this.onViewChange(viewId, previousViewId);
            }
        });
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 활성 뷰 반환
     */
    getActiveView() {
        return this.core.getActiveView();
    }

    /**
     * 활성 뷰 설정
     */
    setActiveView(viewId) {
        this.core.setActiveView(viewId);
        this.activeView = viewId;
    }

    /**
     * 뷰 변경 콜백 설정
     */
    setOnViewChangeCallback(callback) {
        this.onViewChange = callback;
    }

    /**
     * 배지 설정
     */
    setBadge(activityId, count) {
        this.core.setBadge(activityId, count);
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

    // =============== 상태 정보 ===============

    /**
     * 전체 상태 정보 반환
     */
    getStatus() {
        return {
            activeView: this.activeView,
            activities: this.core.getActivities(),
            hasCallback: !!this.onViewChange
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ Destroying ActivityBar with all modules...');
        
        // 모듈들 정리
        if (this.eventHandler) {
            this.eventHandler.destroy();
        }
        
        if (this.core) {
            this.core.destroy();
        }
        
        // 레거시 상태 정리
        this.activeView = null;
        this.onViewChange = null;
        
        // 참조 정리
        this.container = null;
        this.core = null;
        this.eventHandler = null;
        
        console.log('✅ ActivityBar destroyed successfully');
    }
}

export { ActivityBar };
export default ActivityBar;