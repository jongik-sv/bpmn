import { EventEmitter } from 'events';
import { signIn, signUp, signInWithGoogle, signInWithMagicLink, onAuthStateChange } from '../../../lib/supabase.js';
import { dbManager } from '../../../lib/database.js';

/**
 * 인증 로직 처리 전담 클래스
 * 실제 인증 API 호출, 에러 처리, 프로필 관리를 담당
 */
export class AuthHandler extends EventEmitter {
  constructor() {
    super();
    
    // 인증 상태
    this.authListener = null;
    this.isProcessing = false;
    
    // 에러 메시지 맵핑
    this.errorMessages = {
      'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 이메일함을 확인해주세요.',
      'User already registered': '이미 등록된 이메일입니다. 로그인을 시도해보세요.',
      'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
      'Invalid email': '유효하지 않은 이메일 형식입니다.',
      'Signup disabled': '회원가입이 비활성화되었습니다. 관리자에게 문의하세요.',
      'Email rate limit exceeded': '이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      'Invalid request': '잘못된 요청입니다. 입력 정보를 확인해주세요.'
    };
  }

  /**
   * 인증 상태 리스너 설정
   */
  setupAuthListener() {
    // 기존 리스너 제거
    this.removeAuthListener();
    
    // 새 리스너 설정
    this.authListener = onAuthStateChange((event, session) => {
      console.log('Auth state change in handler:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        this.emit('authSuccess', {
          user: session.user,
          session: session
        });
      } else if (event === 'SIGNED_OUT') {
        this.emit('authSignOut');
      }
    });
    
    this.emit('authListenerSetup');
  }

  /**
   * 인증 상태 리스너 제거
   */
  removeAuthListener() {
    if (this.authListener) {
      this.authListener.subscription?.unsubscribe();
      this.authListener = null;
    }
  }

  /**
   * 이메일/비밀번호 인증 처리
   */
  async handleEmailAuth({ mode, email, password, displayName }) {
    if (this.isProcessing) {
      console.warn('Auth already in progress');
      return { success: false, error: '이미 처리 중입니다.' };
    }

    this.isProcessing = true;
    this.emit('authStart', { mode });

    try {
      let result;
      
      if (mode === 'signup') {
        result = await signUp(email, password, {
          display_name: displayName || email.split('@')[0]
        });
      } else {
        result = await signIn(email, password);
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (!result.data) {
        throw new Error('Authentication failed - no data returned');
      }

      // 회원가입의 경우 이메일 확인 처리
      if (mode === 'signup') {
        if (!result.data.session) {
          // 이메일 확인 대기 중
          this.emit('emailConfirmationRequired');
          return { 
            success: true, 
            requiresConfirmation: true,
            message: '회원가입이 완료되었습니다! 이메일함을 확인하여 계정을 활성화해주세요.'
          };
        } else {
          this.emit('signupComplete');
        }
      }

      // 프로필 생성/업데이트
      if (result.data.user) {
        await this.handleProfileUpsert(result.data.user, displayName);
      }

      this.emit('authComplete', {
        user: result.data.user,
        session: result.data.session,
        mode
      });

      return { 
        success: true, 
        user: result.data.user, 
        session: result.data.session 
      };

    } catch (error) {
      console.error('Email auth error:', error);
      const errorMessage = this.getErrorMessage(error.message);
      
      this.emit('authError', { error: errorMessage, originalError: error });
      return { success: false, error: errorMessage };
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Google 인증 처리
   */
  async handleGoogleAuth() {
    if (this.isProcessing) {
      console.warn('Auth already in progress');
      return { success: false, error: '이미 처리 중입니다.' };
    }

    this.isProcessing = true;
    this.emit('googleAuthStart');

    try {
      const { data, error } = await signInWithGoogle();

      if (error) {
        throw new Error(error.message);
      }

      // Google 로그인은 리다이렉트되므로 여기서는 성공 신호만 보냄
      this.emit('googleAuthRedirect');
      
      return { 
        success: true, 
        message: 'Google 로그인 페이지로 이동 중...' 
      };

    } catch (error) {
      console.error('Google auth error:', error);
      const errorMessage = 'Google 로그인을 사용할 수 없습니다. 이메일/비밀번호로 로그인해주세요.';
      
      this.emit('authError', { error: errorMessage, originalError: error });
      return { success: false, error: errorMessage };
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 매직 링크 인증 처리
   */
  async handleMagicLinkAuth(email) {
    if (!email) {
      const error = '이메일을 입력해주세요.';
      this.emit('authError', { error });
      return { success: false, error };
    }

    if (this.isProcessing) {
      console.warn('Auth already in progress');
      return { success: false, error: '이미 처리 중입니다.' };
    }

    this.isProcessing = true;
    this.emit('magicLinkStart');

    try {
      const { data, error } = await signInWithMagicLink(email);

      if (error) {
        throw new Error(error.message);
      }

      this.emit('magicLinkSent', { email });
      
      return { 
        success: true, 
        message: '로그인 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요.' 
      };

    } catch (error) {
      console.error('Magic link auth error:', error);
      const errorMessage = this.getErrorMessage(error.message);
      
      this.emit('authError', { error: errorMessage, originalError: error });
      return { success: false, error: errorMessage };
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 프로필 업서트 처리
   */
  async handleProfileUpsert(user, displayName) {
    try {
      await dbManager.upsertProfile({
        id: user.id,
        email: user.email,
        display_name: displayName || user.user_metadata?.display_name || user.email.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url
      });
      
      this.emit('profileUpserted', { user });
      
    } catch (error) {
      console.warn('Profile upsert failed (database not ready):', error);
      // 개발 환경에서는 프로필 업데이트 실패를 무시하고 계속 진행
      this.emit('profileUpsertWarning', { error });
    }
  }

  /**
   * 에러 메시지 변환
   */
  getErrorMessage(errorMessage) {
    return this.errorMessages[errorMessage] || `오류: ${errorMessage}`;
  }

  /**
   * 현재 처리 상태 확인
   */
  isAuthInProgress() {
    return this.isProcessing;
  }

  /**
   * 인증 통계 정보 반환
   */
  getAuthStats() {
    return {
      isProcessing: this.isProcessing,
      hasAuthListener: !!this.authListener,
      supportedMethods: ['email', 'google', 'magicLink']
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.removeAuthListener();
    this.isProcessing = false;
    this.removeAllListeners();
    
    console.log('🗑️ AuthHandler destroyed');
  }
}