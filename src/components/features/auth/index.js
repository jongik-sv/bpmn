/**
 * Auth Module - 모듈형 Authentication 컴포넌트
 * 인증 관련 기능을 모듈화하여 제공
 */

export { AuthHandler } from './AuthHandler.js';
export { AuthModalCore } from './AuthModalCore.js';
export { default as SupabaseLoginModal } from './SupabaseLoginModal.js';

// 하위 호환성을 위한 기본 export
export { default } from './SupabaseLoginModal.js';