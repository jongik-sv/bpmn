import { EventEmitter } from 'events';
import { AuthModalCore } from './AuthModalCore.js';
import { AuthHandler } from './AuthHandler.js';

/**
 * Supabase 인증 모달의 메인 오케스트레이터 클래스
 * AuthModalCore(UI)와 AuthHandler(인증 로직)를 조합하여 완전한 인증 기능 제공
 */
export class SupabaseLoginModal extends EventEmitter {
  constructor() {
    super();
    
    // 핵심 컴포넌트들
    this.modalCore = new AuthModalCore();
    this.authHandler = new AuthHandler();
    
    // 상태 관리
    this.isVisible = false;
    this.callback = null;
    this.mode = 'login';
    
    this.init();
  }
  
  /**
   * 초기화 - 컴포넌트 간 이벤트 연결
   */
  init() {
    console.log('🔧 SupabaseLoginModal initialized');
    
    // 컴포넌트 간 이벤트 연결
    this.setupComponentIntegration();
    
    this.emit('modalInitialized');
  }
  
  /**
   * 컴포넌트 간 이벤트 연결 설정
   */
  setupComponentIntegration() {
    // === AuthModalCore 이벤트 처리 ===
    
    // 모달 상태 변경 이벤트
    this.modalCore.on('modalShown', ({ mode }) => {
      this.isVisible = true;
      this.mode = mode;
      this.emit('modalShown', { mode });
    });
    
    this.modalCore.on('modalHidden', () => {
      this.isVisible = false;
      this.emit('modalHidden');
    });
    
    this.modalCore.on('modeChanged', ({ newMode, oldMode }) => {
      this.mode = newMode;
      this.emit('modeChanged', { newMode, oldMode });
    });
    
    // 사용자 인증 요청 이벤트
    this.modalCore.on('authSubmit', async (formData) => {
      await this.handleAuthSubmit(formData);
    });
    
    this.modalCore.on('googleLoginRequested', async () => {
      await this.handleGoogleAuth();
    });
    
    this.modalCore.on('magicLinkRequested', async (email) => {
      await this.handleMagicLinkAuth(email);
    });
    
    // === AuthHandler 이벤트 처리 ===
    
    // 인증 프로세스 상태 이벤트
    this.authHandler.on('authStart', ({ mode }) => {
      this.modalCore.setLoading(true);
      this.modalCore.clearMessages();
      this.emit('authStart', { mode });
    });
    
    this.authHandler.on('authComplete', ({ user, session, mode }) => {
      this.modalCore.setLoading(false);
      this.modalCore.showSuccess(mode === 'signup' ? '회원가입이 완료되었습니다!' : '로그인이 완료되었습니다!');
      
      // 성공 시 모달 닫기
      setTimeout(() => {
        this.hide();
        if (this.callback) {
          this.callback(user);
        }
      }, 1500);
      
      this.emit('authComplete', { user, session, mode });
    });
    
    this.authHandler.on('authError', ({ error, originalError }) => {
      this.modalCore.setLoading(false);
      this.modalCore.showError(error);
      this.emit('authError', { error, originalError });
    });
    
    // 특수 상황 이벤트
    this.authHandler.on('emailConfirmationRequired', () => {
      this.modalCore.setLoading(false);
      this.modalCore.showSuccess('회원가입이 완료되었습니다! 이메일함을 확인하여 계정을 활성화해주세요.');
      this.emit('emailConfirmationRequired');
    });
    
    this.authHandler.on('googleAuthRedirect', () => {
      this.modalCore.showSuccess('Google 로그인 페이지로 이동 중...');
      this.emit('googleAuthRedirect');
    });
    
    this.authHandler.on('magicLinkSent', ({ email }) => {
      this.modalCore.setLoading(false);
      this.modalCore.showSuccess('로그인 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요.');
      this.emit('magicLinkSent', { email });
    });
    
    // 인증 상태 변경 이벤트
    this.authHandler.on('authSuccess', ({ user, session }) => {
      if (this.isVisible) {
        this.modalCore.showSuccess('로그인이 완료되었습니다!');
        setTimeout(() => {
          this.hide();
          if (this.callback) {
            this.callback(user);
          }
        }, 1500);
      }
      this.emit('authSuccess', { user, session });
    });
    
    this.authHandler.on('authSignOut', () => {
      this.emit('authSignOut');
    });
    
    // 프로필 관련 이벤트
    this.authHandler.on('profileUpserted', ({ user }) => {
      this.emit('profileUpserted', { user });
    });
    
    this.authHandler.on('profileUpsertWarning', ({ error }) => {
      console.warn('Profile upsert warning:', error);
    });
    
    console.log('🔗 Component integration setup complete');
  }
  
  /**
   * 모달 표시
   */
  show(mode = 'login', callback = null) {
    if (this.isVisible) {
      console.log('Modal already visible, ignoring request');
      return;
    }
    
    this.mode = mode;
    this.callback = callback;
    
    // 인증 리스너 설정
    this.authHandler.setupAuthListener();
    
    // 모달 표시
    this.modalCore.show(mode, callback);
    
    console.log(`📱 Modal shown in ${mode} mode`);
  }
  
  /**
   * 모달 숨기기
   */
  hide() {
    if (!this.isVisible) return;
    
    this.modalCore.hide();
    this.authHandler.removeAuthListener();
    
    console.log('📱 Modal hidden');
  }
  
  /**
   * 이메일/비밀번호 인증 처리
   */
  async handleAuthSubmit(formData) {
    console.log('🔐 Processing auth submission:', { mode: formData.mode, email: formData.email });
    
    const result = await this.authHandler.handleEmailAuth(formData);
    
    if (result.success && result.requiresConfirmation) {
      // 이메일 확인 대기 상태 - 모달 유지
      return;
    }
    
    return result;
  }
  
  /**
   * Google 인증 처리
   */
  async handleGoogleAuth() {
    console.log('🔐 Processing Google authentication');
    
    return await this.authHandler.handleGoogleAuth();
  }
  
  /**
   * 매직 링크 인증 처리
   */
  async handleMagicLinkAuth(email) {
    console.log('🔐 Processing magic link authentication:', email);
    
    return await this.authHandler.handleMagicLinkAuth(email);
  }
  
  /**
   * 모드 전환 (로그인 ↔ 회원가입)
   */
  switchMode() {
    this.modalCore.switchMode();
  }
  
  /**
   * 현재 상태 정보 반환
   */
  getState() {
    return {
      isVisible: this.isVisible,
      mode: this.mode,
      hasCallback: !!this.callback,
      modalState: this.modalCore.getState(),
      authStats: this.authHandler.getAuthStats()
    };
  }
  
  /**
   * 로딩 상태 강제 설정
   */
  setLoading(loading) {
    this.modalCore.setLoading(loading);
  }
  
  /**
   * 메시지 표시
   */
  showMessage(message, type = 'info') {
    this.modalCore.showMessage(message, type);
  }
  
  /**
   * 에러 메시지 표시
   */
  showError(message) {
    this.modalCore.showError(message);
  }
  
  /**
   * 성공 메시지 표시
   */
  showSuccess(message) {
    this.modalCore.showSuccess(message);
  }
  
  /**
   * 메시지 제거
   */
  clearMessages() {
    this.modalCore.clearMessages();
  }
  
  /**
   * 인증 진행 중 여부 확인
   */
  isAuthInProgress() {
    return this.authHandler.isAuthInProgress() || this.modalCore.isLoading;
  }
  
  /**
   * 디버그 정보 반환
   */
  getDebugInfo() {
    return {
      modal: this.getState(),
      core: this.modalCore.getState(),
      auth: this.authHandler.getAuthStats(),
      integration: {
        coreListeners: this.modalCore.listenerCount('authSubmit'),
        authListeners: this.authHandler.listenerCount('authComplete')
      }
    };
  }
  
  /**
   * 완전한 정리
   */
  destroy() {
    console.log('🗑️ Destroying SupabaseLoginModal...');
    
    // 모달 숨기기
    this.hide();
    
    // 컴포넌트들 정리
    this.modalCore?.destroy();
    this.authHandler?.destroy();
    
    // 상태 초기화
    this.isVisible = false;
    this.callback = null;
    this.mode = 'login';
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    console.log('✅ SupabaseLoginModal destroyed');
  }
}

// 전역 인스턴스
let globalSupabaseLoginModal = null;

/**
 * Supabase 로그인 모달 표시
 */
export function showSupabaseLoginModal(mode = 'login', callback) {
  // 기존 모달이 표시 중이면 무시
  if (globalSupabaseLoginModal && globalSupabaseLoginModal.isVisible) {
    console.log('Modal already visible, ignoring request');
    return;
  }
  
  if (!globalSupabaseLoginModal) {
    globalSupabaseLoginModal = new SupabaseLoginModal();
  }
  
  globalSupabaseLoginModal.show(mode, callback);
}

/**
 * Supabase 로그인 모달 숨기기
 */
export function hideSupabaseLoginModal() {
  if (globalSupabaseLoginModal) {
    globalSupabaseLoginModal.hide();
  }
}

/**
 * 전역 인스턴스 가져오기
 */
export function getSupabaseLoginModalInstance() {
  return globalSupabaseLoginModal;
}

// 기본 export
export default SupabaseLoginModal;

// 개발자 도구용 전역 함수
window.debugAuthModal = () => {
  if (globalSupabaseLoginModal) {
    const debugInfo = globalSupabaseLoginModal.getDebugInfo();
    console.log('=== AUTH MODAL DEBUG INFO ===');
    console.log('Modal State:', debugInfo.modal);
    console.log('Core State:', debugInfo.core);
    console.log('Auth Stats:', debugInfo.auth);
    console.log('Integration:', debugInfo.integration);
    console.log('==============================');
  } else {
    console.log('No modal instance found');
  }
};