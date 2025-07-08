import { EventEmitter } from 'events';
import $ from 'jquery';

/**
 * 인증 모달의 코어 UI 및 상태 관리 클래스
 * DOM 조작, 이벤트 처리, 상태 관리를 담당
 */
export class AuthModalCore extends EventEmitter {
  constructor() {
    super();
    
    // UI 상태
    this.modal = null;
    this.isVisible = false;
    this.mode = 'login'; // 'login' 또는 'signup'
    
    // 콜백 및 설정
    this.callback = null;
    this.authListener = null;
    
    // 로딩 상태
    this.isLoading = false;
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
    
    this.destroyModal();
    this.createModal();
    this.showModal();
    
    this.emit('modalShown', { mode });
  }

  /**
   * 모달 숨기기
   */
  hide() {
    if (this.modal && this.isVisible) {
      this.isVisible = false;
      this.modal.fadeOut(300, () => {
        this.destroyModal();
      });
      
      this.emit('modalHidden');
    }
  }

  /**
   * 모달 DOM 생성
   */
  createModal() {
    const isSignup = this.mode === 'signup';
    const title = isSignup ? '회원가입' : '로그인';
    const submitText = isSignup ? '회원가입' : '로그인';
    const switchText = isSignup ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
    const switchLink = isSignup ? '로그인' : '회원가입';

    const modalHtml = this.generateModalHTML({
      title,
      submitText,
      switchText,
      switchLink,
      isSignup
    });

    try {
      this.modal = $(modalHtml);
      $('body').append(this.modal);
      this.setupEventListeners();
      
      this.emit('modalCreated');
    } catch (error) {
      console.error('Error creating modal:', error);
      this.emit('modalCreateError', error);
    }
  }

  /**
   * 모달 HTML 생성
   */
  generateModalHTML({ title, submitText, switchText, switchLink, isSignup }) {
    return `
      <div class="login-modal-overlay">
        <div class="login-modal">
          <div class="login-modal-header">
            <h2>BPMN 협업 에디터 ${title}</h2>
            <button class="close-btn" type="button">&times;</button>
          </div>
          <div class="login-modal-body">
            <form class="login-form">
              ${this.generateFormFields(isSignup)}
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">${submitText}</button>
                <button type="button" class="btn btn-secondary cancel-btn">취소</button>
              </div>
            </form>
            
            ${this.generateSocialLoginSection(title)}
            ${this.generateModeSwitch(switchText, switchLink)}
            ${this.generateInfoSection(isSignup)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 폼 필드 생성
   */
  generateFormFields(isSignup) {
    return `
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
    `;
  }

  /**
   * 소셜 로그인 섹션 생성
   */
  generateSocialLoginSection(title) {
    return `
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
      
      ${this.mode === 'login' ? `
      <div class="social-login">
        <button type="button" class="btn btn-magic">
          📧 이메일 링크로 로그인
        </button>
      </div>
      ` : ''}
    `;
  }

  /**
   * 모드 전환 섹션 생성
   */
  generateModeSwitch(switchText, switchLink) {
    return `
      <div class="auth-switch">
        <p>${switchText} <a href="#" class="switch-mode">${switchLink}</a></p>
      </div>
    `;
  }

  /**
   * 정보 섹션 생성
   */
  generateInfoSection(isSignup) {
    if (isSignup) return '';
    
    return `
      <div class="login-info">
        <p><strong>협업 기능 안내:</strong></p>
        <ul>
          <li>실시간으로 다른 사용자와 함께 BPMN 다이어그램을 편집할 수 있습니다</li>
          <li>변경사항은 자동으로 동기화됩니다</li>
          <li>프로젝트별 권한 관리를 지원합니다</li>
        </ul>
      </div>
    `;
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 폼 제출
    this.modal.find('.login-form').on('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleFormSubmit();
      return false;
    });

    // 닫기 버튼들
    this.modal.find('.close-btn, .cancel-btn').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      return false;
    });

    // 소셜 로그인 버튼들
    this.modal.find('.btn-google').on('click', () => {
      this.emit('googleLoginRequested');
    });

    this.modal.find('.btn-magic').on('click', () => {
      this.emit('magicLinkRequested', this.getEmailValue());
    });

    // 모드 전환
    this.modal.find('.switch-mode').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.switchMode();
      return false;
    });

    // 오버레이 클릭으로 닫기
    this.modal.find('.login-modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return false;
      }
    });

    // ESC 키 처리
    $(document).on('keydown.authModal', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 엔터 키 처리
    this.modal.find('input').on('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.modal.find('.login-form').trigger('submit');
        return false;
      }
    });

    this.emit('eventListenersSetup');
  }

  /**
   * 폼 제출 처리
   */
  handleFormSubmit() {
    const formData = this.getFormData();
    
    if (!this.validateFormData(formData)) {
      return;
    }
    
    this.emit('authSubmit', {
      mode: this.mode,
      ...formData
    });
  }

  /**
   * 폼 데이터 추출
   */
  getFormData() {
    // jQuery .val()이 실패할 경우 DOM에서 직접 가져오기
    let email, password, displayName;
    
    try {
      email = (this.modal.find('#email').val() || '').trim();
      password = (this.modal.find('#password').val() || '').trim();
      displayName = (this.modal.find('#displayName').val() || '').trim();
    } catch (error) {
      console.warn('jQuery .val() failed, using DOM directly:', error);
      email = (document.getElementById('email')?.value || '').trim();
      password = (document.getElementById('password')?.value || '').trim();
      displayName = (document.getElementById('displayName')?.value || '').trim();
    }
    
    return { email, password, displayName };
  }

  /**
   * 이메일 값 가져오기
   */
  getEmailValue() {
    try {
      return this.modal.find('#email').val().trim();
    } catch (error) {
      return document.getElementById('email')?.value?.trim() || '';
    }
  }

  /**
   * 폼 데이터 검증
   */
  validateFormData({ email, password }) {
    if (!email || !password) {
      this.showError('이메일과 비밀번호를 입력해주세요.');
      return false;
    }

    if (password.length < 6) {
      this.showError('비밀번호는 6자 이상이어야 합니다.');
      return false;
    }

    return true;
  }

  /**
   * 모드 전환
   */
  switchMode() {
    const newMode = this.mode === 'login' ? 'signup' : 'login';
    const currentCallback = this.callback;
    
    // 즉시 모드 전환
    this.destroyModal();
    this.isVisible = false;
    
    // 새 모드로 바로 모달 생성
    this.mode = newMode;
    this.callback = currentCallback;
    this.createModal();
    this.showModal();
    
    this.emit('modeChanged', { newMode, oldMode: this.mode === 'login' ? 'signup' : 'login' });
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
    
    this.emit('modalDisplayed');
  }

  /**
   * 로딩 상태 설정
   */
  setLoading(loading) {
    this.isLoading = loading;
    
    if (!this.modal) return;
    
    const submitBtn = this.modal.find('button[type="submit"]');
    const googleBtn = this.modal.find('.btn-google');
    const magicBtn = this.modal.find('.btn-magic');
    const inputs = this.modal.find('input');

    if (loading) {
      submitBtn.prop('disabled', true).text('처리 중...');
      googleBtn.prop('disabled', true);
      magicBtn.prop('disabled', true);
      inputs.prop('disabled', true);
    } else {
      const isSignup = this.mode === 'signup';
      submitBtn.prop('disabled', false).text(isSignup ? '회원가입' : '로그인');
      googleBtn.prop('disabled', false);
      magicBtn.prop('disabled', false);
      inputs.prop('disabled', false);
    }
    
    this.emit('loadingStateChanged', { loading });
  }

  /**
   * 메시지 표시
   */
  showMessage(message, type = 'error') {
    this.clearMessages();
    
    const iconMap = {
      error: '⚠️',
      success: '✅',
      info: 'ℹ️'
    };
    
    const messageHtml = `
      <div class="message ${type}-message">
        <span class="message-icon">${iconMap[type] || iconMap.error}</span>
        <span class="message-text">${message}</span>
      </div>
    `;
    
    this.modal.find('.login-form').prepend(messageHtml);
    this.emit('messageShown', { message, type });
  }

  /**
   * 에러 메시지 표시
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * 성공 메시지 표시
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
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
   * 모달 DOM 정리
   */
  destroyModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    
    // 이벤트 리스너 정리
    $(document).off('keydown.authModal');
  }

  /**
   * 현재 상태 반환
   */
  getState() {
    return {
      isVisible: this.isVisible,
      mode: this.mode,
      isLoading: this.isLoading,
      hasModal: !!this.modal
    };
  }

  /**
   * 완전한 정리
   */
  destroy() {
    this.destroyModal();
    
    // 인증 리스너 정리
    if (this.authListener) {
      this.authListener.subscription?.unsubscribe();
      this.authListener = null;
    }
    
    // 상태 초기화
    this.isVisible = false;
    this.callback = null;
    this.isLoading = false;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    this.emit('destroyed');
  }
}