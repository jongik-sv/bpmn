/**
 * Context Menu - 모듈형 리팩토링 버전
 * 코어 렌더링과 이벤트 처리를 분리하여 완전한 컨텍스트 메뉴 기능 제공
 */

import { ContextMenuCore } from './ContextMenuCore.js';
import { ContextMenuEventHandler } from './ContextMenuEventHandler.js';

class ContextMenu {
    constructor() {
        // 핵심 모듈들 초기화
        this.core = new ContextMenuCore();
        this.eventHandler = new ContextMenuEventHandler(this.core);
        
        // 레거시 호환성을 위한 상태들
        this.onAction = null;
        this.currentItem = null;
        
        this.init();
    }

    init() {
        try {
            // 모듈 간 이벤트 연결 설정
            this.setupModuleIntegration();
            
            console.log('✅ ContextMenu initialized with modular architecture');
            
        } catch (error) {
            console.error('❌ ContextMenu initialization failed:', error);
            throw error;
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 이벤트 핸들러 → 상태 동기화
        this.eventHandler.setOnAction((action, item, clipboardContent) => {
            this.currentItem = item;
            
            // 외부 콜백 호출
            if (this.onAction) {
                this.onAction(action, item, clipboardContent);
            }
        });
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 컨텍스트 메뉴 표시
     */
    show(item, x, y) {
        this.currentItem = item;
        this.core.show(item, x, y);
    }

    /**
     * 컨텍스트 메뉴 숨김
     */
    hide() {
        this.core.hide();
        this.currentItem = null;
    }

    /**
     * 액션 콜백 설정
     */
    setOnAction(callback) {
        this.onAction = callback;
    }

    /**
     * 현재 선택된 아이템 반환
     */
    getCurrentItem() {
        return this.core.getCurrentItem();
    }

    /**
     * 메뉴 표시 상태 확인
     */
    isVisible() {
        return this.core.isVisible();
    }

    /**
     * 클립보드 콘텐츠 설정
     */
    setClipboardContent(content) {
        this.core.setClipboardContent(content);
    }

    /**
     * 클립보드 콘텐츠 반환
     */
    getClipboardContent() {
        return this.core.getClipboardContent();
    }

    /**
     * 클립보드 콘텐츠 지우기
     */
    clearClipboardContent() {
        this.core.clearClipboardContent();
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
            isVisible: this.core.isVisible(),
            currentItem: this.currentItem,
            hasClipboardContent: this.core.hasClipboardContent(),
            hasCallback: !!this.onAction
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ Destroying ContextMenu with all modules...');
        
        // 모듈들 정리
        if (this.eventHandler) {
            this.eventHandler.destroy();
        }
        
        if (this.core) {
            this.core.destroy();
        }
        
        // 레거시 상태 정리
        this.onAction = null;
        this.currentItem = null;
        
        // 참조 정리
        this.core = null;
        this.eventHandler = null;
        
        console.log('✅ ContextMenu destroyed successfully');
    }
}

export { ContextMenu };
export default ContextMenu;