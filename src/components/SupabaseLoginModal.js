import $ from 'jquery';
import { signIn, signUp, signInWithGoogle, signInWithMagicLink, onAuthStateChange } from '../lib/supabase.js';
import { dbManager } from '../lib/database.js';

/**
 * Supabase 인증 모달 컴포넌트
 */
export class SupabaseLoginModal {
  constructor() {
    this.modal = null;
    this.isVisible = false;
    this.callback = null;
    this.mode = 'login'; // 'login' 또는 'signup'
    this.authListener = null;
  }

  /**
   * 모달을 표시합니다.
   * @param {string} mode - 'login' 또는 'signup'
   * @param {Function} callback - 로그인 성공 시 콜백 함수
   */
  show(mode = 'login', callback = null) {
    // 이미 모달이 표시 중이면 무시
    if (this.isVisible) {
      return;
    }
    
    this.mode = mode;
    this.callback = callback;
    
    // 기존 모달이 있으면 제거
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    
    this.createModal();
    this.showModal();
    this.setupAuthListener();
  }

  /**
   * 모달을 숨깁니다.
   */
  hide() {
    if (this.modal && this.isVisible) {
      this.isVisible = false;
      this.modal.fadeOut(300, () => {
        if (this.modal) {
          this.modal.remove();
          this.modal = null;
        }
      });
    }
  }

  /**
   * 모달 HTML을 생성합니다.
   */
  createModal() {
    const isSignup = this.mode === 'signup';
    const title = isSignup ? '회원가입' : '로그인';
    const submitText = isSignup ? '회원가입' : '로그인';
    const switchText = isSignup ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
    const switchLink = isSignup ? '로그인' : '회원가입';

    const modalHtml = `
      <div class="login-modal-overlay">
        <div class="login-modal">
          <div class="login-modal-header">
            <h2>BPMN 협업 에디터 ${title}</h2>
            <button class="close-btn" type="button">&times;</button>
          </div>
          <div class="login-modal-body">
            <form class="login-form">
              <div class="form-group">
                <label for="email">이메일</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  placeholder="이메일을 입력하세요"
                  required
                  autocomplete="email"
                />
              </div>
              <div class="form-group">
                <label for="password">비밀번호</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password" 
                  placeholder="비밀번호를 입력하세요"
                  required
                  autocomplete="${isSignup ? 'new-password' : 'current-password'}"
                  minlength="6"
                />
              </div>
              ${isSignup ? `
              <div class="form-group">
                <label for="displayName">표시 이름 (선택사항)</label>
                <input 
                  type="text" 
                  id="displayName" 
                  name="displayName" 
                  placeholder="표시할 이름을 입력하세요"
                  autocomplete="name"
                />
              </div>
              ` : ''}
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">${submitText}</button>
                <button type="button" class="btn btn-secondary cancel-btn">취소</button>
              </div>
            </form>
            
            <div class="divider">
              <span>또는</span>
            </div>
            
            <div class="social-login">
              <button type="button" class="btn btn-google">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google로 ${title}
              </button>
            </div>
            
            ${!isSignup ? `
            <div class="social-login">
              <button type="button" class="btn btn-magic">
                📧 이메일 링크로 로그인
              </button>
            </div>
            
            <div class="divider">
              <span>또는</span>
            </div>
            ` : ''}
            
            <div class="auth-switch">
              <p>${switchText} <a href="#" class="switch-mode">${switchLink}</a></p>
            </div>
            
            ${!isSignup ? `
            <div class="login-info">
              <p><strong>협업 기능 안내:</strong></p>
              <ul>
                <li>실시간으로 다른 사용자와 함께 BPMN 다이어그램을 편집할 수 있습니다</li>
                <li>변경사항은 자동으로 동기화됩니다</li>
                <li>프로젝트별 권한 관리를 지원합니다</li>
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    try {
      this.modal = $(modalHtml);
      $('body').append(this.modal);

      // 이벤트 리스너 설정
      this.setupEventListeners();
    } catch (error) {
      console.error('Error creating modal:', error);
    }
  }

  /**
   * 이벤트 리스너를 설정합니다.
   */
  setupEventListeners() {
    // 폼 제출 처리
    this.modal.find('.login-form').on('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleAuth();
      return false;
    });

    // 닫기 버튼 처리
    this.modal.find('.close-btn, .cancel-btn').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      return false;
    });

    // Google 로그인
    this.modal.find('.btn-google').on('click', () => {
      this.handleGoogleAuth();
    });

    // 매직 링크 로그인
    this.modal.find('.btn-magic').on('click', () => {
      this.handleMagicLinkAuth();
    });

    // 모드 전환
    this.modal.find('.switch-mode').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 현재 모드 저장
      const newMode = this.mode === 'login' ? 'signup' : 'login';
      const currentCallback = this.callback;
      
      // 즉시 모드 전환 (애니메이션 없이)
      this.modal.remove();
      this.modal = null;
      this.isVisible = false;
      
      // 새 모드로 바로 모달 생성
      this.mode = newMode;
      this.callback = currentCallback;
      this.createModal();
      this.showModal();
      
      return false;
    });

    // 오버레이 클릭 시 닫기
    this.modal.find('.login-modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return false;
      }
    });

    // ESC 키 처리
    $(document).on('keydown.supabaseLoginModal', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 엔터 키 처리 - 폼 submit으로 처리하도록 변경
    this.modal.find('input').on('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // form submit 이벤트 트리거
        this.modal.find('.login-form').trigger('submit');
        return false;
      }
    });
  }

  /**
   * 인증 처리 (로그인/회원가입)
   */
  async handleAuth() {
    const emailEl = this.modal.find('#email');
    const passwordEl = this.modal.find('#password');
    const displayNameEl = this.modal.find('#displayName');
    
    console.log('Input elements found:', {
      email: emailEl.length,
      password: passwordEl.length,
      displayName: displayNameEl.length
    });
    
    // jQuery .val()이 실패할 경우 DOM에서 직접 가져오기
    let email, password, displayName;
    
    try {
      email = (emailEl.val() || '').trim();
      password = (passwordEl.val() || '').trim();
      displayName = (displayNameEl.val() || '').trim();
    } catch (error) {
      console.warn('jQuery .val() failed, using DOM directly:', error);
      email = (document.getElementById('email')?.value || '').trim();
      password = (document.getElementById('password')?.value || '').trim();
      displayName = (document.getElementById('displayName')?.value || '').trim();
    }
    
    console.log('Form values:', { email, password: password ? '***' : '', displayName });

    if (!email || !password) {
      this.showError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (password.length < 6) {
      this.showError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      this.setLoading(true);
      this.clearMessages();

      let result;
      if (this.mode === 'signup') {
        result = await signUp(email, password, {
          display_name: displayName || email.split('@')[0]
        });
      } else {
        result = await signIn(email, password);
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      // 결과가 null인 경우 처리
      if (!result.data) {
        throw new Error('Authentication failed - no data returned');
      }

      // 회원가입의 경우 이메일 확인 메시지 표시
      if (this.mode === 'signup') {
        if (!result.data.session) {
          this.showSuccess('회원가입이 완료되었습니다! 이메일함을 확인하여 계정을 활성화해주세요.');
          // 이메일 확인 대기 중이므로 모달을 유지하되 로딩 상태 해제
          this.setLoading(false);
          return;
        } else {
          this.showSuccess('회원가입이 완료되었습니다! 자동으로 로그인됩니다.');
        }
      }

      // 로그인 성공 시 프로필 생성/업데이트 (개발 환경에서는 스킵)
      if (result.data.user) {
        try {
          await dbManager.upsertProfile({
            id: result.data.user.id,
            email: result.data.user.email,
            display_name: displayName || result.data.user.user_metadata?.display_name,
            avatar_url: result.data.user.user_metadata?.avatar_url
          });
        } catch (error) {
          console.warn('Profile upsert failed (database not ready):', error);
          // 개발 환경에서는 프로필 업데이트 실패를 무시하고 계속 진행
        }
      }

      // 성공 시 모달 닫기
      this.hide();

      // 콜백 실행
      if (this.callback) {
        this.callback(result.data.user);
      }

    } catch (error) {
      console.error('Auth error:', error);
      // 에러 메시지를 안전하게 표시
      const errorMessage = error?.message || 'Authentication failed';
      this.showError(this.getErrorMessage(errorMessage));
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Google 인증 처리
   */
  async handleGoogleAuth() {
    try {
      this.setLoading(true);
      this.clearMessages();

      const { data, error } = await signInWithGoogle();

      if (error) {
        throw new Error(error.message);
      }

      // Google 로그인은 리다이렉트되므로 여기서는 로딩만 표시
      this.showSuccess('Google 로그인 페이지로 이동 중...');
      console.log('Google 로그인 시작...');

    } catch (error) {
      console.error('Google auth error:', error);
      this.showError('Google 로그인을 사용할 수 없습니다. 이메일/비밀번호로 로그인해주세요.');
      this.setLoading(false);
    }
  }

  /**
   * 매직 링크 인증 처리
   */
  async handleMagicLinkAuth() {
    const email = this.modal.find('#email').val().trim();

    if (!email) {
      this.showError('이메일을 입력해주세요.');
      return;
    }

    try {
      this.setLoading(true);
      this.clearMessages();

      const { data, error } = await signInWithMagicLink(email);

      if (error) {
        throw new Error(error.message);
      }

      this.showSuccess('로그인 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요.');
      
    } catch (error) {
      console.error('Magic link auth error:', error);
      this.showError(this.getErrorMessage(error.message));
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 에러 메시지 변환
   */
  getErrorMessage(errorMessage) {
    const errorMap = {
      'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 이메일함을 확인해주세요.',
      'User already registered': '이미 등록된 이메일입니다. 로그인을 시도해보세요.',
      'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
      'Invalid email': '유효하지 않은 이메일 형식입니다.',
      'Signup disabled': '회원가입이 비활성화되었습니다. 관리자에게 문의하세요.',
      'Email rate limit exceeded': '이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      'Invalid request': '잘못된 요청입니다. 입력 정보를 확인해주세요.'
    };

    return errorMap[errorMessage] || `오류: ${errorMessage}`;
  }

  /**
   * 로딩 상태 설정
   */
  setLoading(loading) {
    const submitBtn = this.modal.find('button[type="submit"]');
    const googleBtn = this.modal.find('.btn-google');
    const inputs = this.modal.find('input');

    if (loading) {
      submitBtn.prop('disabled', true).text('처리 중...');
      googleBtn.prop('disabled', true);
      inputs.prop('disabled', true);
    } else {
      const isSignup = this.mode === 'signup';
      submitBtn.prop('disabled', false).text(isSignup ? '회원가입' : '로그인');
      googleBtn.prop('disabled', false);
      inputs.prop('disabled', false);
    }
  }

  /**
   * 에러 메시지 표시
   */
  showError(message) {
    this.clearMessages();
    
    const errorHtml = `
      <div class="message error-message">
        <span class="message-icon">⚠️</span>
        <span class="message-text">${message}</span>
      </div>
    `;
    
    this.modal.find('.login-form').prepend(errorHtml);
  }

  /**
   * 성공 메시지 표시
   */
  showSuccess(message) {
    this.clearMessages();
    
    const successHtml = `
      <div class="message success-message">
        <span class="message-icon">✅</span>
        <span class="message-text">${message}</span>
      </div>
    `;
    
    this.modal.find('.login-form').prepend(successHtml);
  }

  /**
   * 메시지 제거
   */
  clearMessages() {
    if (this.modal) {
      this.modal.find('.message').remove();
    }
  }

  /**
   * 모달 표시
   */
  showModal() {
    if (!this.modal) {
      console.error('Modal not created yet');
      return;
    }
    
    this.modal.fadeIn();
    this.isVisible = true;
    
    // 첫 번째 입력 필드에 포커스
    setTimeout(() => {
      if (this.modal) {
        this.modal.find('#email').focus();
      }
    }, 100);
  }

  /**
   * 인증 상태 리스너 설정
   */
  setupAuthListener() {
    // 기존 리스너 제거
    if (this.authListener) {
      this.authListener.subscription.unsubscribe();
    }
    
    // 새 리스너 설정
    this.authListener = onAuthStateChange((event, session) => {
      console.log('Modal auth state change:', event);
      
      if (event === 'SIGNED_IN' && session?.user && this.isVisible) {
        console.log('User signed in, closing modal');
        
        // 성공 메시지 표시 후 모달 닫기
        this.showSuccess('로그인이 완료되었습니다!');
        setTimeout(() => {
          this.hide();
          if (this.callback) {
            this.callback(session.user);
          }
        }, 1500);
      }
    });
  }

  /**
   * 모달 인스턴스 정리
   */
  destroy() {
    $(document).off('keydown.supabaseLoginModal');
    
    // 인증 리스너 정리
    if (this.authListener) {
      this.authListener.subscription.unsubscribe();
      this.authListener = null;
    }
    
    this.hide();
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