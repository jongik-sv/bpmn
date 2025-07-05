/**
 * 간단한 사용자 인증 시스템 (Phase 2 MVP용)
 * 실제 production에서는 Supabase 또는 Firebase Auth를 사용하세요.
 */

class SimpleAuthSystem {
  constructor() {
    this.currentUser = null;
    this.users = new Map(); // 임시 사용자 저장소
    this.listeners = new Map();
    this.loadUserFromStorage();
  }

  /**
   * 사용자 로그인
   * @param {string} email - 이메일
   * @param {string} name - 사용자 이름 (선택사항)
   * @returns {Object} 사용자 정보
   */
  async login(email, name = null) {
    try {
      // 이메일 형식 검증
      if (!this.isValidEmail(email)) {
        throw new Error('유효하지 않은 이메일 형식입니다.');
      }

      // 사용자 ID 생성
      const userId = this.generateUserId(email);
      
      // 사용자 정보 생성
      const user = {
        id: userId,
        email: email,
        name: name || email.split('@')[0],
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      // 사용자 저장 (임시)
      this.users.set(userId, user);
      this.currentUser = user;

      // 로컬 스토리지에 저장
      this.saveUserToStorage(user);

      // 로그인 이벤트 발생
      this.emit('login', user);

      console.log('사용자 로그인 성공:', user);
      return user;

    } catch (error) {
      console.error('로그인 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 로그아웃
   */
  async logout() {
    const user = this.currentUser;
    
    this.currentUser = null;
    this.clearUserFromStorage();
    
    // 로그아웃 이벤트 발생
    this.emit('logout', { user });
    
    console.log('사용자 로그아웃 성공');
  }

  /**
   * 현재 사용자 정보 가져오기
   * @returns {Object|null} 사용자 정보
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 사용자 인증 상태 확인
   * @returns {boolean} 인증 상태
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * 이메일 형식 검증
   * @param {string} email - 이메일
   * @returns {boolean} 유효성 여부
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 사용자 ID 생성
   * @param {string} email - 이메일
   * @returns {string} 사용자 ID
   */
  generateUserId(email) {
    // 이메일 기반 해시 ID 생성 (간단한 방법)
    const hash = email.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return 'user_' + Math.abs(hash).toString(36);
  }

  /**
   * 로컬 스토리지에 사용자 정보 저장
   * @param {Object} user - 사용자 정보
   */
  saveUserToStorage(user) {
    try {
      localStorage.setItem('bpmn_auth_user', JSON.stringify(user));
    } catch (error) {
      console.error('사용자 정보 저장 실패:', error);
    }
  }

  /**
   * 로컬 스토리지에서 사용자 정보 불러오기
   */
  loadUserFromStorage() {
    try {
      const userData = localStorage.getItem('bpmn_auth_user');
      if (userData) {
        this.currentUser = JSON.parse(userData);
        console.log('저장된 사용자 정보 로드:', this.currentUser);
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      this.clearUserFromStorage();
    }
  }

  /**
   * 로컬 스토리지에서 사용자 정보 삭제
   */
  clearUserFromStorage() {
    try {
      localStorage.removeItem('bpmn_auth_user');
    } catch (error) {
      console.error('사용자 정보 삭제 실패:', error);
    }
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const eventListeners = this.listeners.get(event);
    const index = eventListeners.indexOf(callback);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  }

  /**
   * 이벤트 발생
   * @param {string} event - 이벤트 이름
   * @param {Object} data - 이벤트 데이터
   */
  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`이벤트 ${event} 콜백 실행 중 오류:`, error);
      }
    });
  }

  /**
   * 사용자 정보 업데이트
   * @param {Object} updates - 업데이트할 정보
   */
  async updateUser(updates) {
    if (!this.currentUser) {
      throw new Error('로그인이 필요합니다.');
    }

    const updatedUser = {
      ...this.currentUser,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.currentUser = updatedUser;
    this.users.set(updatedUser.id, updatedUser);
    this.saveUserToStorage(updatedUser);

    // 업데이트 이벤트 발생
    this.emit('userUpdate', updatedUser);

    return updatedUser;
  }

  /**
   * 인증 상태 변경 감지
   * @param {Function} callback - 콜백 함수
   */
  onAuthStateChange(callback) {
    this.on('login', (user) => callback('SIGNED_IN', { user }));
    this.on('logout', (data) => callback('SIGNED_OUT', data));
  }
}

// 싱글톤 인스턴스 생성
export const authSystem = new SimpleAuthSystem();

// 편의 함수들
export const getCurrentUser = () => authSystem.getCurrentUser();
export const isAuthenticated = () => authSystem.isAuthenticated();
export const login = (email, name) => authSystem.login(email, name);
export const logout = () => authSystem.logout();
export const updateUser = (updates) => authSystem.updateUser(updates);
export const onAuthStateChange = (callback) => authSystem.onAuthStateChange(callback);