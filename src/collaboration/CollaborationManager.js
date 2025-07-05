import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * CollaborationManager는 실시간 협업 기능을 관리하는 클래스입니다.
 * Yjs CRDT를 사용하여 여러 사용자 간의 실시간 동기화를 처리합니다.
 */
export class CollaborationManager {
  constructor() {
    this.ydoc = null;
    this.provider = null;
    this.awareness = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.userId = this.generateUserId();
    this.userColor = this.generateUserColor();
  }

  /**
   * 협업 세션을 초기화합니다.
   * @param {string} roomId - 방 ID
   * @param {string} websocketUrl - WebSocket 서버 URL
   * @param {Object} userInfo - 사용자 정보
   */
  initialize(roomId, websocketUrl = 'ws://localhost:1234', userInfo = {}) {
    try {
      // Yjs 문서 생성
      this.ydoc = new Y.Doc();
      
      // WebSocket 프로바이더 생성
      this.provider = new WebsocketProvider(websocketUrl, roomId, this.ydoc);
      
      // Awareness 설정 (사용자 상태 및 커서 정보)
      this.awareness = this.provider.awareness;
      
      // 로컬 사용자 정보 설정
      this.awareness.setLocalStateField('user', {
        id: this.userId,
        name: userInfo.name || `사용자 ${this.userId.slice(0, 6)}`,
        color: this.userColor,
        cursor: null,
        ...userInfo
      });

      // 연결 상태 이벤트 리스너
      this.provider.on('status', (event) => {
        this.isConnected = event.status === 'connected';
        this.emit('connection', { connected: this.isConnected });
      });

      // 동기화 이벤트 리스너
      this.provider.on('sync', (synced) => {
        this.emit('sync', { synced });
      });

      // Awareness 변경 이벤트 리스너
      this.awareness.on('change', (changes) => {
        this.emit('awarenessChange', { changes });
      });

      console.log(`협업 세션 초기화: 방 ID ${roomId}, 사용자 ID ${this.userId}`);
      
    } catch (error) {
      console.error('협업 세션 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 공유 맵 데이터를 가져옵니다.
   * @param {string} mapName - 맵 이름
   * @returns {Y.Map} 공유 맵
   */
  getSharedMap(mapName) {
    if (!this.ydoc) {
      throw new Error('협업 세션이 초기화되지 않았습니다.');
    }
    return this.ydoc.getMap(mapName);
  }

  /**
   * 공유 배열을 가져옵니다.
   * @param {string} arrayName - 배열 이름
   * @returns {Y.Array} 공유 배열
   */
  getSharedArray(arrayName) {
    if (!this.ydoc) {
      throw new Error('협업 세션이 초기화되지 않았습니다.');
    }
    return this.ydoc.getArray(arrayName);
  }

  /**
   * 연결된 사용자 목록을 가져옵니다.
   * @returns {Array} 사용자 목록
   */
  getConnectedUsers() {
    if (!this.awareness) {
      return [];
    }
    
    const users = [];
    this.awareness.getStates().forEach((state) => {
      if (state.user) {
        users.push(state.user);
      }
    });
    return users;
  }

  /**
   * 현재 사용자의 커서 위치를 업데이트합니다.
   * @param {Object} cursor - 커서 정보
   */
  updateCursor(cursor) {
    if (!this.awareness) {
      return;
    }
    
    this.awareness.setLocalStateField('cursor', cursor);
  }

  /**
   * 이벤트 리스너를 등록합니다.
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
   * 이벤트 리스너를 제거합니다.
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
   * 이벤트를 발생시킵니다.
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
   * 협업 세션을 종료합니다.
   */
  disconnect() {
    if (this.provider) {
      this.provider.disconnect();
      this.provider = null;
    }
    
    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }
    
    this.awareness = null;
    this.isConnected = false;
    this.listeners.clear();
    
    console.log('협업 세션이 종료되었습니다.');
  }

  /**
   * 고유한 사용자 ID를 생성합니다.
   * @returns {string} 사용자 ID
   */
  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 사용자 색상을 생성합니다.
   * @returns {string} 색상 코드
   */
  generateUserColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#FFA07A', '#20B2AA', '#87CEEB', '#DEB887'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 연결 상태를 확인합니다.
   * @returns {boolean} 연결 상태
   */
  isConnectedToServer() {
    return this.isConnected;
  }

  /**
   * 현재 사용자 정보를 가져옵니다.
   * @returns {Object} 사용자 정보
   */
  getCurrentUser() {
    if (!this.awareness) {
      return null;
    }
    return this.awareness.getLocalState()?.user || null;
  }
}

// 싱글톤 인스턴스 생성
export const collaborationManager = new CollaborationManager();