/**
 * Accessibility Module - 모듈형 Accessibility 컴포넌트
 * 접근성 관리 기능을 모듈화하여 제공
 */

export { AccessibilityCore } from './AccessibilityCore.js';
export { default as AccessibilityManager } from './AccessibilityManagerNew.js';

// 하위 호환성을 위한 기본 export
export { default } from './AccessibilityManagerNew.js';