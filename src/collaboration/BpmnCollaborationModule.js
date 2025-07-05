import { collaborationManager } from './CollaborationManager.js';

/**
 * BPMN 에디터와 실시간 협업 기능을 통합하는 모듈
 */
export class BpmnCollaborationModule {
  constructor(modeler) {
    this.modeler = modeler;
    this.sharedDiagram = null;
    this.isInitialized = false;
    this.lastSyncTime = 0;
    this.syncDebounceTime = 100; // 100ms 디바운스
    this.eventListeners = new Map();
    
    // 동기화 상태 관리
    this.syncState = {
      isSyncing: false,
      lastLocalChange: 0,
      lastRemoteChange: 0,
      conflicts: []
    };
  }

  /**
   * 협업 모듈을 초기화합니다.
   * @param {string} roomId - 협업 방 ID
   * @param {Object} options - 초기화 옵션
   */
  async initialize(roomId, options = {}) {
    try {
      // 협업 매니저 초기화
      await collaborationManager.initialize(roomId, options.websocketUrl, options.userInfo);
      
      // 공유 다이어그램 데이터 구조 설정
      this.sharedDiagram = collaborationManager.getSharedMap('bpmn-diagram');
      
      // 초기 BPMN XML 데이터 설정
      const currentXml = await this.getCurrentBpmnXml();
      if (!this.sharedDiagram.has('xml')) {
        this.sharedDiagram.set('xml', currentXml);
      }
      
      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기 동기화
      await this.syncFromRemote();
      
      this.isInitialized = true;
      
      console.log(`🔄 BPMN 협업 모듈 초기화 완료: 방 ${roomId}`);
      
    } catch (error) {
      console.error('BPMN 협업 모듈 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너를 설정합니다.
   */
  setupEventListeners() {
    // 로컬 BPMN 변경 감지
    this.modeler.on('commandStack.changed', (event) => {
      this.handleLocalChange(event);
    });

    // 원격 변경 감지
    this.sharedDiagram.observe((event) => {
      this.handleRemoteChange(event);
    });

    // 협업 상태 변경 감지
    collaborationManager.on('connection', (event) => {
      this.handleConnectionChange(event);
    });

    collaborationManager.on('awarenessChange', (event) => {
      this.handleAwarenessChange(event);
    });

    // 충돌 해결 이벤트
    this.on('conflict', (event) => {
      this.handleConflict(event);
    });
  }

  /**
   * 로컬 변경사항을 처리합니다.
   * @param {Object} event - 변경 이벤트
   */
  handleLocalChange(event) {
    if (this.syncState.isSyncing) {
      return; // 동기화 중에는 로컬 변경 무시
    }

    const now = Date.now();
    this.syncState.lastLocalChange = now;

    // 디바운스 적용
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncToRemote();
    }, this.syncDebounceTime);
  }

  /**
   * 원격 변경사항을 처리합니다.
   * @param {Object} event - Yjs 변경 이벤트
   */
  handleRemoteChange(event) {
    if (this.syncState.isSyncing) {
      return; // 동기화 중에는 원격 변경 무시
    }

    const now = Date.now();
    this.syncState.lastRemoteChange = now;

    // 원격 변경사항 적용
    this.syncFromRemote();
  }

  /**
   * 로컬 변경사항을 원격에 동기화합니다.
   */
  async syncToRemote() {
    if (!this.isInitialized || this.syncState.isSyncing) {
      return;
    }

    try {
      this.syncState.isSyncing = true;
      
      const currentXml = await this.getCurrentBpmnXml();
      const remoteXml = this.sharedDiagram.get('xml');
      
      // 변경사항이 있는지 확인
      if (currentXml !== remoteXml) {
        // 충돌 감지
        if (this.syncState.lastRemoteChange > this.syncState.lastLocalChange) {
          this.emit('conflict', {
            localXml: currentXml,
            remoteXml: remoteXml,
            timestamp: Date.now()
          });
          return;
        }
        
        // 원격에 변경사항 적용
        this.sharedDiagram.set('xml', currentXml);
        this.sharedDiagram.set('lastModified', Date.now());
        this.sharedDiagram.set('lastModifiedBy', collaborationManager.getCurrentUser()?.id);
        
        console.log('📤 로컬 변경사항을 원격에 동기화했습니다.');
      }
      
    } catch (error) {
      console.error('원격 동기화 실패:', error);
      this.emit('syncError', { error, direction: 'toRemote' });
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * 원격 변경사항을 로컬에 동기화합니다.
   */
  async syncFromRemote() {
    if (!this.isInitialized || this.syncState.isSyncing) {
      return;
    }

    try {
      this.syncState.isSyncing = true;
      
      const remoteXml = this.sharedDiagram.get('xml');
      
      if (remoteXml) {
        const currentXml = await this.getCurrentBpmnXml();
        
        // 변경사항이 있는지 확인
        if (remoteXml !== currentXml) {
          // 로컬에 원격 변경사항 적용
          await this.modeler.importXML(remoteXml);
          
          console.log('📥 원격 변경사항을 로컬에 동기화했습니다.');
        }
      }
      
    } catch (error) {
      console.error('로컬 동기화 실패:', error);
      this.emit('syncError', { error, direction: 'fromRemote' });
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * 현재 BPMN XML을 가져옵니다.
   * @returns {Promise<string>} BPMN XML 문자열
   */
  async getCurrentBpmnXml() {
    try {
      const result = await this.modeler.saveXML({ format: true });
      return result.xml;
    } catch (error) {
      console.error('BPMN XML 가져오기 실패:', error);
      throw error;
    }
  }

  /**
   * 연결 상태 변경을 처리합니다.
   * @param {Object} event - 연결 상태 이벤트
   */
  handleConnectionChange(event) {
    this.emit('connectionChange', event);
    
    if (event.connected) {
      console.log('🔗 협업 서버에 연결되었습니다.');
      // 재연결 시 동기화
      this.syncFromRemote();
    } else {
      console.log('⚠️ 협업 서버와의 연결이 끊어졌습니다.');
    }
  }

  /**
   * 사용자 awareness 변경을 처리합니다.
   * @param {Object} event - awareness 변경 이벤트
   */
  handleAwarenessChange(event) {
    this.emit('awarenessChange', event);
    
    const users = collaborationManager.getConnectedUsers();
    console.log(`👥 연결된 사용자: ${users.length}명`);
  }

  /**
   * 충돌을 처리합니다.
   * @param {Object} event - 충돌 이벤트
   */
  handleConflict(event) {
    console.warn('⚠️ 동기화 충돌이 감지되었습니다:', event);
    
    // 충돌 해결 전략: 최신 원격 변경사항 우선
    this.syncFromRemote();
    
    // 충돌 정보 저장
    this.syncState.conflicts.push({
      timestamp: event.timestamp,
      resolved: true,
      strategy: 'remote-wins'
    });
  }

  /**
   * 이벤트 리스너를 등록합니다.
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * 이벤트를 발생시킵니다.
   * @param {string} event - 이벤트 이름
   * @param {Object} data - 이벤트 데이터
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`이벤트 ${event} 콜백 실행 중 오류:`, error);
        }
      });
    }
  }

  /**
   * 동기화 상태를 가져옵니다.
   * @returns {Object} 동기화 상태 정보
   */
  getSyncState() {
    return {
      ...this.syncState,
      isInitialized: this.isInitialized,
      connectedUsers: collaborationManager.getConnectedUsers(),
      isConnected: collaborationManager.isConnectedToServer()
    };
  }

  /**
   * 수동으로 동기화를 실행합니다.
   */
  async forcSync() {
    await this.syncFromRemote();
    await this.syncToRemote();
  }

  /**
   * 협업 모듈을 종료합니다.
   */
  disconnect() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.eventListeners.clear();
    collaborationManager.disconnect();
    this.isInitialized = false;
    
    console.log('🛑 BPMN 협업 모듈이 종료되었습니다.');
  }
}

// 전역 인스턴스 (필요시 사용)
let globalBpmnCollaboration = null;

/**
 * 전역 BPMN 협업 인스턴스를 가져옵니다.
 * @param {Object} modeler - BPMN 모델러 인스턴스
 * @returns {BpmnCollaborationModule} 협업 모듈 인스턴스
 */
export function getBpmnCollaboration(modeler) {
  if (!globalBpmnCollaboration && modeler) {
    globalBpmnCollaboration = new BpmnCollaborationModule(modeler);
  }
  return globalBpmnCollaboration;
}