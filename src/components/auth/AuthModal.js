import $ from 'jquery';
import { signIn, signUp, signInWithGoogle } from '../../lib/supabase.js';

export class AuthModal {
  constructor() {
    this.isVisible = false;
    this.currentMode = 'login'; // 'login' or 'signup'
    this.onAuthSuccess = null;
    this.createModal();
    this.setupEventListeners();
  }

  createModal() {
    const modalHtml = `
      <div id="auth-modal" class="auth-modal" style="display: none;">
        <div class="auth-modal-overlay"></div>
        <div class="auth-modal-content">
          <div class="auth-modal-header">
            <h2 id="auth-modal-title">로그인</h2>
            <button id="auth-modal-close" class="auth-modal-close">&times;</button>
          </div>
          
          <div class="auth-modal-body">
            <!-- 로그인/회원가입 폼 -->
            <form id="auth-form" class="auth-form">
              <div class="auth-form-group">
                <label for="auth-email">이메일</label>
                <input type="email" id="auth-email" required>
              </div>
              
              <div class="auth-form-group">
                <label for="auth-password">비밀번호</label>
                <input type="password" id="auth-password" required>
              </div>
              
              <div id="auth-confirm-password-group" class="auth-form-group" style="display: none;">
                <label for="auth-confirm-password">비밀번호 확인</label>
                <input type="password" id="auth-confirm-password">
              </div>
              
              <div id="auth-display-name-group" class="auth-form-group" style="display: none;">
                <label for="auth-display-name">표시 이름</label>
                <input type="text" id="auth-display-name">
              </div>
              
              <button type="submit" id="auth-submit-btn" class="auth-btn auth-btn-primary">
                로그인
              </button>
            </form>
            
            <div class="auth-divider">
              <span>또는</span>
            </div>
            
            <button id="auth-google-btn" class="auth-btn auth-btn-google">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 계속하기
            </button>
            
            <div class="auth-switch">
              <span id="auth-switch-text">계정이 없으신가요?</span>
              <button type="button" id="auth-switch-btn" class="auth-link">회원가입</button>
            </div>
            
            <div id="auth-error" class="auth-error" style="display: none;"></div>
            <div id="auth-loading" class="auth-loading" style="display: none;">
              처리 중...
            </div>
          </div>
        </div>
      </div>
    `;

    $('body').append(modalHtml);
  }

  setupEventListeners() {
    // 모달 닫기
    $('#auth-modal-close, .auth-modal-overlay').on('click', () => {
      this.hide();
    });

    // ESC 키로 모달 닫기
    $(document).on('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 로그인/회원가입 전환
    $('#auth-switch-btn').on('click', () => {
      this.toggleMode();
    });

    // 폼 제출
    $('#auth-form').on('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Google 로그인
    $('#auth-google-btn').on('click', () => {
      this.handleGoogleLogin();
    });
  }

  show(mode = 'login', onSuccess = null) {
    this.currentMode = mode;
    this.onAuthSuccess = onSuccess;
    this.updateModalForMode();
    $('#auth-modal').fadeIn(300);
    this.isVisible = true;
    $('#auth-email').focus();
  }

  hide() {
    $('#auth-modal').fadeOut(300);
    this.isVisible = false;
    this.clearForm();
    this.hideError();
    this.hideLoading();
  }

  toggleMode() {
    this.currentMode = this.currentMode === 'login' ? 'signup' : 'login';
    this.updateModalForMode();
    this.clearForm();
    this.hideError();
  }

  updateModalForMode() {
    if (this.currentMode === 'login') {
      $('#auth-modal-title').text('로그인');
      $('#auth-submit-btn').text('로그인');
      $('#auth-switch-text').text('계정이 없으신가요?');
      $('#auth-switch-btn').text('회원가입');
      $('#auth-confirm-password-group').hide();
      $('#auth-display-name-group').hide();
    } else {
      $('#auth-modal-title').text('회원가입');
      $('#auth-submit-btn').text('회원가입');
      $('#auth-switch-text').text('이미 계정이 있으신가요?');
      $('#auth-switch-btn').text('로그인');
      $('#auth-confirm-password-group').show();
      $('#auth-display-name-group').show();
    }
  }

  async handleSubmit() {
    const email = $('#auth-email').val().trim();
    const password = $('#auth-password').val();
    const confirmPassword = $('#auth-confirm-password').val();
    const displayName = $('#auth-display-name').val().trim();

    // 유효성 검사
    if (!email || !password) {
      this.showError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (this.currentMode === 'signup') {
      if (password !== confirmPassword) {
        this.showError('비밀번호가 일치하지 않습니다.');
        return;
      }
      if (password.length < 6) {
        this.showError('비밀번호는 최소 6자 이상이어야 합니다.');
        return;
      }
    }

    this.showLoading();
    this.hideError();

    try {
      let result;
      
      if (this.currentMode === 'login') {
        result = await signIn(email, password);
      } else {
        const metadata = displayName ? { display_name: displayName } : {};
        result = await signUp(email, password, metadata);
      }

      if (result.error) {
        this.handleAuthError(result.error);
      } else {
        if (this.currentMode === 'signup') {
          this.showError('회원가입이 완료되었습니다. 이메일을 확인해주세요.', 'success');
          setTimeout(() => {
            this.toggleMode();
          }, 2000);
        } else {
          this.hide();
          if (this.onAuthSuccess) {
            this.onAuthSuccess(result.data.user);
          }
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.showError('인증 중 오류가 발생했습니다.');
    } finally {
      this.hideLoading();
    }
  }

  async handleGoogleLogin() {
    this.showLoading();
    this.hideError();

    try {
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        this.handleAuthError(error);
      } else {
        // Google OAuth는 리다이렉트를 통해 처리됨
        console.log('Google OAuth initiated');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      this.showError('Google 로그인 중 오류가 발생했습니다.');
    } finally {
      this.hideLoading();
    }
  }

  handleAuthError(error) {
    let message = '인증 중 오류가 발생했습니다.';
    
    switch (error.message) {
      case 'Invalid login credentials':
        message = '이메일 또는 비밀번호가 올바르지 않습니다.';
        break;
      case 'User already registered':
        message = '이미 등록된 이메일입니다.';
        break;
      case 'Password should be at least 6 characters':
        message = '비밀번호는 최소 6자 이상이어야 합니다.';
        break;
      case 'Email not confirmed':
        message = '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
        break;
      default:
        if (error.message) {
          message = error.message;
        }
    }
    
    this.showError(message);
  }

  showError(message, type = 'error') {
    const errorEl = $('#auth-error');
    errorEl.text(message)
      .removeClass('auth-error auth-success')
      .addClass(type === 'success' ? 'auth-success' : 'auth-error')
      .fadeIn();
  }

  hideError() {
    $('#auth-error').fadeOut();
  }

  showLoading() {
    $('#auth-loading').show();
    $('#auth-submit-btn').prop('disabled', true);
    $('#auth-google-btn').prop('disabled', true);
  }

  hideLoading() {
    $('#auth-loading').hide();
    $('#auth-submit-btn').prop('disabled', false);
    $('#auth-google-btn').prop('disabled', false);
  }

  clearForm() {
    $('#auth-form')[0].reset();
  }
}