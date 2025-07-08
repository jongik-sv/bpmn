/**
 * Accessibility Manager - 모듈형 리팩토링 버전
 * 접근성 핵심 기능을 모듈화하여 완전한 접근성 관리 기능 제공
 */

import { AccessibilityCore } from './AccessibilityCore.js';

class AccessibilityManager {
    constructor() {
        // 핵심 모듈 초기화
        this.core = new AccessibilityCore();
        
        // 레거시 호환성을 위한 상태들
        this.announceRegion = null;
        this.keyboardNavigation = null;
        this.focusManager = null;
        this.ariaManager = null;
        
        this.init();
    }

    init() {
        try {
            // 모듈 간 이벤트 연결 설정
            this.setupModuleIntegration();
            
            // 레거시 호환성 설정
            this.setupLegacyCompatibility();
            
            console.log('✅ AccessibilityManager initialized with modular architecture');
            
        } catch (error) {
            console.error('❌ AccessibilityManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 현재는 단일 코어 모듈만 사용
        // 향후 확장 시 여러 모듈 간 통합 로직 추가 가능
    }

    /**
     * 레거시 호환성 설정
     */
    setupLegacyCompatibility() {
        // 기존 API와의 호환성을 위한 참조 설정
        this.keyboardNavigation = this.core.getKeyboardNavigation();
        this.focusManager = this.core.getFocusManager();
        this.ariaManager = this.core.getAriaManager();
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 스크린 리더에 메시지 알림
     */
    announce(message, priority = 'polite') {
        return this.core.announce(message, priority);
    }

    /**
     * 키보드 네비게이션 반환
     */
    getKeyboardNavigation() {
        return this.core.getKeyboardNavigation();
    }

    /**
     * 포커스 관리자 반환
     */
    getFocusManager() {
        return this.core.getFocusManager();
    }

    /**
     * ARIA 관리자 반환
     */
    getAriaManager() {
        return this.core.getAriaManager();
    }

    /**
     * 접근성 진단 실행
     */
    runAccessibilityDiagnostics() {
        return this.core.runAccessibilityDiagnostics();
    }

    /**
     * 접근성 상태 반환
     */
    getAccessibilityStatus() {
        return this.core.getAccessibilityStatus();
    }

    // =============== 편의 메서드들 ===============

    /**
     * 트리 뷰 접근성 설정
     */
    setupTreeView(container) {
        return this.ariaManager.setupTreeView(container);
    }

    /**
     * 포커스 트랩 설정
     */
    trapFocus(container) {
        return this.focusManager.trapFocus(container);
    }

    /**
     * 포커스 저장
     */
    saveFocus() {
        return this.focusManager.saveFocus();
    }

    /**
     * 포커스 복원
     */
    restoreFocus() {
        return this.focusManager.restoreFocus();
    }

    /**
     * ARIA 라벨 업데이트
     */
    updateAriaLabel(element, label) {
        return this.ariaManager.updateAriaLabel(element, label);
    }

    /**
     * ARIA 확장 상태 업데이트
     */
    updateAriaExpanded(element, expanded) {
        return this.ariaManager.updateAriaExpanded(element, expanded);
    }

    /**
     * ARIA 선택 상태 업데이트
     */
    updateAriaSelected(element, selected) {
        return this.ariaManager.updateAriaSelected(element, selected);
    }

    /**
     * ARIA 활성 후손 업데이트
     */
    updateAriaActivedescendant(container, descendant) {
        return this.ariaManager.updateAriaActivedescendant(container, descendant);
    }

    /**
     * 역할 설정
     */
    setRole(element, role) {
        return this.ariaManager.setRole(element, role);
    }

    // =============== 고급 기능 접근 ===============

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
            core: this.core.getAccessibilityStatus(),
            diagnostics: this.core.runAccessibilityDiagnostics(),
            legacy: {
                hasKeyboardNavigation: !!this.keyboardNavigation,
                hasFocusManager: !!this.focusManager,
                hasAriaManager: !!this.ariaManager
            }
        };
    }

    // =============== 레거시 메서드들 (하위 호환성) ===============

    /**
     * 키보드 네비게이션 설정 (하위 호환성)
     */
    setupKeyboardNavigation() {
        return this.keyboardNavigation;
    }

    /**
     * 트리 네비게이션 설정 (하위 호환성)
     */
    setupTreeNavigation(treeElement) {
        return this.keyboardNavigation.setupTreeNavigation(treeElement);
    }

    /**
     * 다음 요소로 포커스 이동 (하위 호환성)
     */
    focusNext() {
        return this.keyboardNavigation.focusNext();
    }

    /**
     * 이전 요소로 포커스 이동 (하위 호환성)
     */
    focusPrevious() {
        return this.keyboardNavigation.focusPrevious();
    }

    /**
     * 리소스 정리
     */
    destroy() {
        console.log('🗑️ Destroying AccessibilityManager with all modules...');
        
        // 모듈 정리
        if (this.core) {
            this.core.destroy();
        }
        
        // 레거시 상태 정리
        this.announceRegion = null;
        this.keyboardNavigation = null;
        this.focusManager = null;
        this.ariaManager = null;
        
        // 참조 정리
        this.core = null;
        
        console.log('✅ AccessibilityManager destroyed successfully');
    }
}

export default AccessibilityManager;