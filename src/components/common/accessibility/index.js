/**
 * Accessibility Module - 모듈형 Accessibility 컴포넌트
 * 접근성 관리 기능을 모듈화하여 제공
 */

export { AccessibilityCore } from './AccessibilityCore.js';
export { AccessibilityManager } from './AccessibilityManager.js';

// 하위 호환성을 위한 기본 export
export { AccessibilityManager as default } from './AccessibilityManager.js';