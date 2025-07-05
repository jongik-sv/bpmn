import $ from 'jquery';
import { login } from '../lib/auth.js';

/**
 * 간단한 로그인 모달 컴포넌트
 */
export class LoginModal {
  constructor() {
    this.modal = null;
    this.isVisible = false;
    this.callback = null;
  }

  /**
   * 모달을 표시합니다.
   * @param {Function} callback - 로그인 성공 시 콜백 함수
   */
  show(callback = null) {
    this.callback = callback;
    this.createModal();
    this.showModal();
  }

  /**
   * 모달을 숨깁니다.
   */
  hide() {
    if (this.modal) {
      this.modal.fadeOut(() => {
        this.modal.remove();
        this.modal = null;
        this.isVisible = false;
      });
    }
  }

  /**
   * 모달 HTML을 생성합니다.
   */
  createModal() {
    const modalHtml = `
      <div class="login-modal-overlay">
        <div class="login-modal">
          <div class="login-modal-header">
            <h2>BPMN 협업 에디터 로그인</h2>
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
                <label for="name">이름 (선택사항)</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  placeholder="표시할 이름을 입력하세요"
                  autocomplete="name"
                />
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">로그인</button>
                <button type="button" class="btn btn-secondary cancel-btn">취소</button>
              </div>
            </form>
            <div class="login-info">
              <p><strong>협업 기능 안내:</strong></p>
              <ul>
                <li>실시간으로 다른 사용자와 함께 BPMN 다이어그램을 편집할 수 있습니다</li>
                <li>변경사항은 자동으로 동기화됩니다</li>
                <li>다른 사용자의 커서와 선택 상태를 확인할 수 있습니다</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modal = $(modalHtml);
    $('body').append(this.modal);

    // 이벤트 리스너 설정
    this.setupEventListeners();
  }

  /**
   * 이벤트 리스너를 설정합니다.
   */
  setupEventListeners() {
    // 폼 제출 처리
    this.modal.find('.login-form').on('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // 닫기 버튼 처리
    this.modal.find('.close-btn, .cancel-btn').on('click', () => {
      this.hide();
    });

    // 오버레이 클릭 시 닫기
    this.modal.find('.login-modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hide();
      }
    });

    // ESC 키 처리
    $(document).on('keydown.loginModal', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 엔터 키 처리
    this.modal.find('input').on('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });
  }

  /**
   * 모달을 표시합니다.
   */
  showModal() {
    this.modal.fadeIn();
    this.isVisible = true;
    
    // 첫 번째 입력 필드에 포커스
    setTimeout(() => {
      this.modal.find('#email').focus();
    }, 100);
  }

  /**
   * 로그인 처리
   */
  async handleLogin() {
    const email = this.modal.find('#email').val().trim();
    const name = this.modal.find('#name').val().trim();

    if (!email) {
      this.showError('이메일을 입력해주세요.');
      return;
    }

    try {
      // 로딩 상태 표시
      this.setLoading(true);
      this.clearError();

      // 로그인 시도
      const user = await login(email, name);

      // 성공 시 모달 닫기
      this.hide();

      // 콜백 실행
      if (this.callback) {
        this.callback(user);
      }

    } catch (error) {
      this.showError(error.message || '로그인에 실패했습니다.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 로딩 상태를 설정합니다.
   * @param {boolean} loading - 로딩 상태
   */
  setLoading(loading) {
    const submitBtn = this.modal.find('button[type="submit"]');
    const inputs = this.modal.find('input');

    if (loading) {
      submitBtn.prop('disabled', true).text('로그인 중...');
      inputs.prop('disabled', true);
    } else {
      submitBtn.prop('disabled', false).text('로그인');
      inputs.prop('disabled', false);
    }
  }

  /**
   * 에러 메시지를 표시합니다.
   * @param {string} message - 에러 메시지
   */
  showError(message) {
    this.clearError();
    
    const errorHtml = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${message}</span>
      </div>
    `;
    
    this.modal.find('.login-form').prepend(errorHtml);
  }

  /**
   * 에러 메시지를 제거합니다.
   */
  clearError() {
    this.modal.find('.error-message').remove();
  }

  /**
   * 모달 인스턴스를 정리합니다.
   */
  destroy() {
    $(document).off('keydown.loginModal');
    this.hide();
  }
}

// 전역 인스턴스
let globalLoginModal = null;

/**
 * 로그인 모달을 표시합니다.
 * @param {Function} callback - 로그인 성공 시 콜백 함수
 */
export function showLoginModal(callback) {
  if (!globalLoginModal) {
    globalLoginModal = new LoginModal();
  }
  globalLoginModal.show(callback);
}

/**
 * 로그인 모달을 숨깁니다.
 */
export function hideLoginModal() {
  if (globalLoginModal) {
    globalLoginModal.hide();
  }
}