// 이 파일은 새로운 모듈 구조로 마이그레이션되었습니다
// 새로운 모듈을 사용하세요: ./auth/SupabaseLoginModal.js

import { 
  SupabaseLoginModal, 
  showSupabaseLoginModal, 
  hideSupabaseLoginModal,
  getSupabaseLoginModalInstance
} from '../features/auth/SupabaseLoginModal.js';

// 래거시 호환성을 위한 export
export { SupabaseLoginModal as default } from '../features/auth/SupabaseLoginModal.js';
export { SupabaseLoginModal } from '../features/auth/SupabaseLoginModal.js';

// 레거시 호환성을 위한 편의 함수들
export { showSupabaseLoginModal, hideSupabaseLoginModal, getSupabaseLoginModalInstance } from '../features/auth/SupabaseLoginModal.js';

