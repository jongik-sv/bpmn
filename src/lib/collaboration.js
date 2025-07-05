import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Yjs 문서와 WebSocket Provider 관리 클래스
export class CollaborationManager {
  constructor(documentId = 'default-document') {
    this.documentId = documentId;
    this.ydoc = new Y.Doc();
    this.provider = null;
    this.awareness = null;
    this.isConnected = false;
    
    // BPMN 데이터를 위한 Shared Types
    this.bpmnData = this.ydoc.getMap('bpmn');
    this.elements = this.ydoc.getMap('elements');
    this.connections = this.ydoc.getArray('connections');
    
    // 이벤트 리스너들
    this.listeners = {
      connectionChange: [],
      dataChange: [],
      awarenessChange: []
    };
    
    this.setupEventListeners();
  }

  // WebSocket Provider 연결
  connect(wsUrl = 'ws://localhost:1234', user = null) {
    try {
      this.provider = new WebsocketProvider(
        wsUrl,
        this.documentId,
        this.ydoc,
        {
          connect: true,
          maxBackoffTime: 2500
        }
      );

      this.awareness = this.provider.awareness;
      
      // 사용자 정보 설정
      if (user) {
        this.awareness.setLocalStateField('user', {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          color: this.generateUserColor(user.id),
          cursor: null
        });
      }

      // 연결 상태 이벤트
      this.provider.on('status', (event) => {
        this.isConnected = event.status === 'connected';
        this.notifyListeners('connectionChange', {
          connected: this.isConnected,
          status: event.status
        });
      });

      // Awareness 변경 이벤트
      this.awareness.on('change', () => {
        const users = Array.from(this.awareness.getStates().entries())
          .map(([clientId, state]) => ({
            clientId,
            user: state.user
          }))
          .filter(({ user }) => user);
        
        this.notifyListeners('awarenessChange', users);
      });

      console.log('Collaboration manager connected to:', wsUrl);
      return true;
    } catch (error) {
      console.error('Failed to connect collaboration manager:', error);
      return false;
    }
  }

  // 연결 해제
  disconnect() {
    if (this.provider) {
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
      this.awareness = null;
      this.isConnected = false;
    }
  }

  // BPMN XML 데이터 동기화
  updateBpmnXml(xml) {
    if (!xml) return;
    
    this.bpmnData.set('xml', xml);
    this.bpmnData.set('lastModified', Date.now());
    
    this.notifyListeners('dataChange', {
      type: 'bpmn-update',
      xml: xml
    });
  }

  // 현재 BPMN XML 가져오기
  getBpmnXml() {
    return this.bpmnData.get('xml') || null;
  }

  // 요소 위치 업데이트 (커서 추적용)
  updateElementPosition(elementId, position) {
    if (!this.awareness) return;
    
    const currentUser = this.awareness.getLocalState()?.user;
    if (currentUser) {
      this.awareness.setLocalStateField('user', {
        ...currentUser,
        cursor: {
          elementId,
          position,
          timestamp: Date.now()
        }
      });
    }
  }

  // 사용자 색상 생성
  generateUserColor(userId) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    // BPMN 데이터 변경 감지
    this.bpmnData.observe((event) => {
      const changes = event.changes.keys;
      if (changes.has('xml')) {
        const xml = this.bpmnData.get('xml');
        this.notifyListeners('dataChange', {
          type: 'bpmn-remote-update',
          xml: xml
        });
      }
    });
  }

  // 이벤트 리스너 등록
  addEventListener(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type].push(callback);
    }
  }

  // 이벤트 리스너 제거
  removeEventListener(type, callback) {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(callback);
      if (index > -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  // 이벤트 알림
  notifyListeners(type, data) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => callback(data));
    }
  }

  // 연결 상태 확인
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      provider: !!this.provider,
      awareness: !!this.awareness,
      documentId: this.documentId
    };
  }

  // 온라인 사용자 목록
  getOnlineUsers() {
    if (!this.awareness) return [];
    
    return Array.from(this.awareness.getStates().entries())
      .map(([clientId, state]) => ({
        clientId,
        ...state.user
      }))
      .filter(user => user.id);
  }
}