// 이 파일은 새로운 모듈 구조로 마이그레이션되었습니다
// 새로운 모듈을 사용하세요: ./auth/SupabaseLoginModalNew.js

import { 
  SupabaseLoginModalNew, 
  showSupabaseLoginModalNew, 
  hideSupabaseLoginModalNew,
  getSupabaseLoginModalInstance
} from '../features/auth/SupabaseLoginModalNew.js';

/**
 * @deprecated 레거시 호환성을 위한 래퍼 클래스
 * 새로운 코드는 SupabaseLoginModalNew를 직접 사용하세요
 */
export class SupabaseLoginModal extends SupabaseLoginModalNew {
  constructor() {
    super();
    console.warn('⚠️  SupabaseLoginModal is deprecated. Use SupabaseLoginModalNew instead.');
  }
}

// 레거시 호환성을 위한 편의 함수들
/**
 * @deprecated showSupabaseLoginModalNew를 사용하세요
 */
export function showSupabaseLoginModal(mode = 'login', callback) {
  console.warn('⚠️  showSupabaseLoginModal is deprecated. Use showSupabaseLoginModalNew instead.');
  return showSupabaseLoginModalNew(mode, callback);
}

/**
 * @deprecated hideSupabaseLoginModalNew를 사용하세요
 */
export function hideSupabaseLoginModal() {
  console.warn('⚠️  hideSupabaseLoginModal is deprecated. Use hideSupabaseLoginModalNew instead.');
  return hideSupabaseLoginModalNew();
}

// 전역 인스턴스 접근용 (레거시 호환성)
let globalSupabaseLoginModal = null;

/**
 * 전역 인스턴스 getter (레거시 호환성)
 */
export function getGlobalSupabaseLoginModal() {
  console.warn('⚠️  getGlobalSupabaseLoginModal is deprecated. Use getSupabaseLoginModalInstance instead.');
  return getSupabaseLoginModalInstance();
}

// 레거시 호환성을 위한 기본 export
export default SupabaseLoginModal;