import { EventEmitter } from 'events';
import { getCurrentUser, onAuthStateChange, signOut } from '../../lib/supabase.js';
import { showSupabaseLoginModal } from '../../components/features/auth/SupabaseLoginModal.js';
import $ from 'jquery';

/**
 * 사용자 인증 상태 관리 전담 클래스
 * 로그인, 로그아웃, 인증 상태 변경 감지 및 처리
 */
export class AuthStateManager extends EventEmitter {
  constructor() {
    super();
    
    // 인증 상태
    this.currentUser = null;
    this.isInitialized = false;
    this.authStateChangeHandler = null;
    
    // 인증 관련 설정
    this.autoSignOutDelay = 500; // 임시 인증 상태 변경 감지 지연
    this.signOutTimeoutId = null;
    
    this.init();
  }

  /**
   * 초기화
   */
  async init() {
    try {
      await this.initializeAuth();
      this.setupAuthEventListeners();
      this.isInitialized = true;
      this.emit('authManagerInitialized');
    } catch (error) {
      console.error('❌ Failed to initialize AuthStateManager:', error);
      this.emit('authInitError', error);
    }
  }

  /**
   * 인증 초기화
   */
  async initializeAuth() {
    try {
      // 현재 사용자 확인
      this.currentUser = await getCurrentUser();
      console.log('Current user on init:', this.currentUser);
      
      // 초기 인증 상태에 따른 이벤트 발생
      if (this.currentUser) {
        this.emit('userAuthenticated', this.currentUser);
      } else {
        this.emit('userNotAuthenticated');
      }
      
      // 인증 상태 변경 감지 설정
      this.setupAuthStateChangeListener();
      
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      this.emit('authInitError', error);
    }
  }

  /**
   * 인증 상태 변경 리스너 설정
   */
  setupAuthStateChangeListener() {
    this.authStateChangeHandler = (event, session) => {
      console.log('Auth state change:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        this.handleUserSignIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleUserSignOut();
      }
    };
    
    onAuthStateChange(this.authStateChangeHandler);
  }

  /**
   * 인증 이벤트 리스너 설정
   */
  setupAuthEventListeners() {
    // PageManager로부터의 인증 요청들
    this.on('loginModalRequested', (mode) => {
      this.showLoginModal(mode);
    });
    
    this.on('logoutRequested', () => {
      this.logout();
    });
    
    this.on('userMenuRequested', () => {
      this.showUserMenu();
    });
  }

  /**
   * 사용자 로그인 처리
   */
  handleUserSignIn(user) {
    console.log('User signed in:', user.email);
    this.currentUser = user;
    
    // 자동 로그아웃 타이머 클리어
    if (this.signOutTimeoutId) {
      clearTimeout(this.signOutTimeoutId);
      this.signOutTimeoutId = null;
    }
    
    // 사용자 인증 완료 이벤트
    this.emit('userSignedIn', user);
    
    // BPMN 에디터에 사용자 설정 요청
    this.emit('bpmnEditorUserUpdateRequested', user);
  }

  /**
   * 사용자 로그아웃 처리
   */
  handleUserSignOut() {
    console.log('User signed out event detected');
    
    // 이미 처리 중인 로그아웃이 있으면 취소
    if (this.signOutTimeoutId) {
      clearTimeout(this.signOutTimeoutId);
    }
    
    // 짧은 지연 후 실제 사용자 상태를 다시 확인
    // 탭 전환 시 발생하는 임시적인 인증 상태 변경을 방지
    this.signOutTimeoutId = setTimeout(async () => {
      try {
        const currentUser = await getCurrentUser();
        
        if (!currentUser) {
          // 실제로 로그아웃된 경우에만 처리
          console.log('✅ Confirmed user signed out');
          this.currentUser = null;
          
          // 로그아웃 완료 이벤트
          this.emit('userSignedOut');
          
          // BPMN 에디터에서 사용자 제거 요청
          this.emit('bpmnEditorUserUpdateRequested', null);
          
        } else {
          // 임시적인 상태 변경인 경우 무시
          console.log('⏭️ Temporary auth state change - keeping current user');
          this.currentUser = currentUser;
        }
      } catch (error) {
        console.error('Error verifying user sign out:', error);
        // 에러 발생 시 안전하게 로그아웃 처리
        this.currentUser = null;
        this.emit('userSignedOut');
      }
      
      this.signOutTimeoutId = null;
    }, this.autoSignOutDelay);
  }

  /**
   * 로그인 모달 표시
   */
  showLoginModal(mode = 'login') {
    try {
      showSupabaseLoginModal(mode, (user) => {
        console.log('Login successful:', user);
        // 인증 상태 변경은 onAuthStateChange에서 처리됨
        this.emit('loginSuccess', user);
      });
    } catch (error) {
      console.error('Failed to show login modal:', error);
      this.emit('loginError', error);
    }
  }

  /**
   * 사용자 메뉴 표시
   */
  showUserMenu() {
    try {
      // 사용자 정보 가져오기
      const displayName = this.getUserDisplayName();
      
      // 간단한 사용자 메뉴
      const menu = $(`
        <div class="user-menu-dropdown" style="
          position: absolute;
          top: 100%;
          right: 0;
          background-color: #252526;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          min-width: 200px;
          z-index: 1000;
        ">
          <div class="menu-header" style="
            padding: 12px 16px;
            border-bottom: 1px solid #3e3e3e;
            color: #cccccc;
            font-size: 14px;
          ">
            <div style="font-weight: 600;">${displayName}</div>
            <div style="font-size: 12px; color: #999; margin-top: 2px;">${this.currentUser?.email || ''}</div>
          </div>
          <div class="menu-item logout-item" style="
            padding: 8px 16px;
            color: #cccccc;
            cursor: pointer;
            font-size: 13px;
            border-radius: 0 0 4px 4px;
          ">
            <span style="margin-right: 8px;">🚪</span>로그아웃
          </div>
        </div>
      `);
      
      // 기존 메뉴 제거
      $('.user-menu-dropdown').remove();
      
      // 새 메뉴 추가
      $('.user-menu').append(menu);
      
      // 메뉴 아이템 이벤트
      menu.find('.logout-item').on('click', () => {
        this.logout();
        $('.user-menu-dropdown').remove();
      });
      
      // 호버 효과
      menu.find('.menu-item').on('mouseenter', function() {
        $(this).css('background-color', '#2a2d2e');
      }).on('mouseleave', function() {
        $(this).css('background-color', 'transparent');
      });
      
      // 외부 클릭 시 메뉴 닫기
      $(document).one('click', (e) => {
        if (!$(e.target).closest('.user-menu').length) {
          $('.user-menu-dropdown').remove();
        }
      });
      
      this.emit('userMenuShown');
      
    } catch (error) {
      console.error('Failed to show user menu:', error);
      this.emit('userMenuError', error);
    }
  }

  /**
   * 로그아웃 실행
   */
  async logout() {
    try {
      console.log('🚪 Logging out user...');
      
      // 메뉴 정리
      $('.user-menu-dropdown').remove();
      
      // Supabase 로그아웃
      await signOut();
      
      // 로그아웃 시작 이벤트 (UI 업데이트용)
      this.emit('logoutStarted');
      
    } catch (error) {
      console.error('Logout failed:', error);
      this.emit('logoutError', error);
    }
  }

  /**
   * 사용자 표시 이름 반환
   */
  getUserDisplayName() {
    if (!this.currentUser) return '사용자';
    
    return this.currentUser.user_metadata?.display_name || 
           this.currentUser.user_metadata?.full_name ||
           this.currentUser.email?.split('@')[0] || 
           '사용자';
  }

  /**
   * 사용자 이메일 반환
   */
  getUserEmail() {
    return this.currentUser?.email || null;
  }

  /**
   * 사용자 ID 반환
   */
  getUserId() {
    return this.currentUser?.id || null;
  }

  /**
   * 현재 사용자 반환
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 로그인 상태 확인
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * 사용자 권한 확인 (추후 확장용)
   */
  hasPermission(permission) {
    // TODO: 권한 시스템 구현
    return this.isAuthenticated();
  }

  /**
   * 사용자 프로필 업데이트
   */
  async updateUserProfile(updates) {
    try {
      // TODO: 사용자 프로필 업데이트 구현
      console.log('Updating user profile:', updates);
      this.emit('userProfileUpdated', updates);
    } catch (error) {
      console.error('Failed to update user profile:', error);
      this.emit('userProfileUpdateError', error);
    }
  }

  /**
   * 세션 갱신
   */
  async refreshSession() {
    try {
      const user = await getCurrentUser();
      if (user) {
        this.currentUser = user;
        this.emit('sessionRefreshed', user);
        return user;
      } else {
        this.currentUser = null;
        this.emit('sessionExpired');
        return null;
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      this.emit('sessionRefreshError', error);
      return null;
    }
  }

  /**
   * 인증 상태 검증
   */
  async validateAuthState() {
    try {
      const user = await getCurrentUser();
      const isValid = !!user;
      
      if (!isValid && this.currentUser) {
        // 로컬 상태와 실제 상태가 다른 경우
        console.warn('Auth state mismatch detected');
        this.currentUser = null;
        this.emit('authStateMismatch');
        this.emit('userSignedOut');
      }
      
      return isValid;
    } catch (error) {
      console.error('Auth state validation failed:', error);
      return false;
    }
  }

  /**
   * 인증 상태 정보 반환
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated(),
      isInitialized: this.isInitialized,
      currentUser: this.currentUser ? {
        id: this.currentUser.id,
        email: this.currentUser.email,
        displayName: this.getUserDisplayName()
      } : null,
      lastSignInTime: this.currentUser?.last_sign_in_at || null
    };
  }

  /**
   * 디버그 정보 반환
   */
  getDebugInfo() {
    return {
      authStatus: this.getAuthStatus(),
      hasSignOutTimeout: !!this.signOutTimeoutId,
      autoSignOutDelay: this.autoSignOutDelay,
      hasAuthStateChangeHandler: !!this.authStateChangeHandler
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 타이머 정리
    if (this.signOutTimeoutId) {
      clearTimeout(this.signOutTimeoutId);
      this.signOutTimeoutId = null;
    }
    
    // 사용자 메뉴 정리
    $('.user-menu-dropdown').remove();
    
    // 인증 상태 변경 리스너 해제
    // TODO: Supabase에서 리스너 해제 방법 확인 필요
    
    // 상태 초기화
    this.currentUser = null;
    this.isInitialized = false;
    this.authStateChangeHandler = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    console.log('🗑️ AuthStateManager destroyed');
  }
}