import { collaborationManager } from './CollaborationManager.js';
import { dbManager } from '../lib/database.js';

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
      conflicts: [],
      retryCount: 0,
      lastRetryLog: 0,
      lastSyncedXml: '', // 마지막으로 동기화된 XML 저장
      isUserEditing: false // 사용자가 편집 중인지 확인
    };
    
    // 커서 및 사용자 상호작용 관리
    this.cursorState = {
      localCursor: null,
      remoteCursors: new Map(),
      cursorElements: new Map() // DOM 요소 캐시
    };
    
    // 서버 측 저장 의존성 표시
    this.serverPersistence = true;
  }

  /**
   * 협업 모듈을 초기화합니다.
   * @param {string} roomId - 협업 방 ID
   * @param {Object} options - 초기화 옵션
   */
  async initialize(roomId, options = {}) {
    try {
      console.log(`🔗 BPMN 협업 모듈 초기화 시도: 방 ${roomId}${options.diagramId ? ` (다이어그램: ${options.diagramId})` : ''}`);
      
      // 협업 매니저 초기화 (실패해도 계속 진행) - diagram ID 포함
      const collaborationEnabled = await collaborationManager.initialize(roomId, options.websocketUrl, options.userInfo, options.diagramId);
      
      if (collaborationEnabled) {
        console.log('✅ 실시간 협업 모드 활성화');
        
        // 공유 다이어그램 데이터 구조 설정 (서버와 동일한 키 사용)
        this.sharedDiagram = collaborationManager.getSharedMap('bpmn-diagram');
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 커서 추적 설정
        this.setupCursorTracking();
        
        // 서버에서 문서 로딩 대기 (약간의 지연 후 확인)
        setTimeout(async () => {
          await this.handleInitialDocumentSync();
        }, 500); // 500ms 대기
      } else {
        console.log('📝 오프라인 모드 - 협업 기능 비활성화');
        
        // 오프라인 모드에서는 더미 객체 생성
        this.sharedDiagram = {
          has: () => false,
          get: () => null,
          set: () => {},
          delete: () => {},
          observe: () => {},
          unobserve: () => {}
        };
        
        // 기본 이벤트 리스너만 설정
        this.setupBasicEventListeners();
      }
      
      this.isInitialized = true;
      this.collaborationEnabled = collaborationEnabled;
      
      if (collaborationEnabled) {
        console.log('💾 Database persistence handled by WebSocket server');
        if (options.diagramId) {
          console.log(`📊 Diagram ID passed to server for persistence: ${options.diagramId}`);
        }
      }
      
      console.log(`✅ BPMN 협업 모듈 초기화 완료: 방 ${roomId} (협업: ${collaborationEnabled ? '활성화' : '비활성화'})`);
      
    } catch (error) {
      console.error('BPMN 협업 모듈 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 이벤트 리스너를 설정합니다.
   */
  setupEventListeners() {
    // 모델러가 존재하는지 확인
    if (!this.modeler) {
      console.warn('모델러가 초기화되지 않았습니다. 이벤트 리스너 설정을 건너뜁니다.');
      return;
    }

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
   * 기본 이벤트 리스너를 설정합니다. (오프라인 모드용)
   */
  setupBasicEventListeners() {
    // 오프라인 모드에서는 로컬 변경만 감지
    this.modeler.on('commandStack.changed', (event) => {
      console.log('📝 로컬 다이어그램 변경 감지 (오프라인 모드)');
      this.syncState.lastLocalChange = Date.now();
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
    this.syncState.isUserEditing = true; // 사용자 편집 시작

    // 편집 상태를 일정 시간 후 해제
    clearTimeout(this.editingTimeout);
    this.editingTimeout = setTimeout(() => {
      this.syncState.isUserEditing = false;
    }, 3000); // 3초 후 편집 상태 해제

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
    if (this.syncState.isSyncing || this.syncState.isUserEditing) {
      return; // 동기화 중이거나 사용자 편집 중에는 원격 변경 무시
    }

    const now = Date.now();
    
    // 너무 빈번한 동기화 방지 (최소 2초 간격)
    if (now - this.syncState.lastRemoteChange < 2000) {
      return;
    }
    
    this.syncState.lastRemoteChange = now;
    
    // 10초마다 한 번씩만 로그 출력
    if (now - this.syncState.lastRetryLog > 10000) {
      // console.log('📨 Remote change detected, syncing from remote'); // Disabled: too verbose
      this.syncState.lastRetryLog = now;
    }

    // 원격 변경사항 적용 (디바운스 적용)
    clearTimeout(this.remoteSyncTimeout);
    this.remoteSyncTimeout = setTimeout(() => {
      this.syncFromRemote();
    }, 1000); // 1초 디바운스
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
      
      // 모델러가 준비되었는지 확인 (조용히)
      if (!this.isModelerReady()) {
        return;
      }
      
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
        
        // console.log('📤 로컬 변경사항을 원격에 동기화했습니다. (서버가 10초 디바운스/1분 강제 저장 처리)'); // Disabled: too verbose
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
      // 5초마다 한 번씩만 로그 출력
      const now = Date.now();
      if (now - this.syncState.lastRetryLog > 5000) {
        console.log('🔍 syncFromRemote skipped:', { 
          isInitialized: this.isInitialized, 
          isSyncing: this.syncState.isSyncing 
        });
        this.syncState.lastRetryLog = now;
      }
      return;
    }

    try {
      this.syncState.isSyncing = true;
      
      const remoteXml = this.sharedDiagram.get('xml');
      
      if (remoteXml) {
        const currentXml = await this.getCurrentBpmnXml();
        
        // 변경사항이 있는지 확인 (현재 로컬 XML과만 비교)
        const isDifferent = remoteXml !== currentXml;
        
        if (!isDifferent) {
          // console.log('✅ XML content is same as current, no sync needed'); // Disabled: too verbose
          return;
        }
        
        // console.log('📝 Remote XML differs from current XML:', {
        //   remoteLength: remoteXml.length,
        //   currentLength: currentXml.length,
        //   lastSyncedLength: this.syncState.lastSyncedXml?.length || 0
        // }); // Disabled: too verbose
        
        
        // 모델러가 준비되지 않은 경우 나중에 재시도
        const modelerReady = this.isModelerReady();
        // console.log('🔧 Modeler ready check:', {
        //   isReady: modelerReady,
        //   hasModeler: !!this.modeler
        // }); // Disabled: too verbose
        
        if (!modelerReady) {
          console.log(`⏳ Modeler not ready, retrying...`);
          setTimeout(() => this.syncFromRemote(), 1000); // 1초 후 재시도
          return;
        }
        
        // 로컬에 원격 변경사항 적용 (실시간 Y.Doc 데이터 사용)
        try {
          // console.log('🔧 Starting XML import process with Y.Doc data...'); // Disabled: too verbose
          
          // Primary: Y.Doc에서 받은 원격 XML을 직접 적용 (실시간 데이터)
          // console.log('🔄 Using direct import with Y.Doc remote XML (PRIMARY)...'); // Disabled: too verbose
          
          try {
            // Y.Doc의 실시간 데이터를 직접 사용 (서버 API 호출 없이)
            await this.modeler.importXML(remoteXml);
            // console.log('✅ Direct Y.Doc import succeeded'); // Disabled: too verbose
            this.syncState.retryCount = 0;
            this.syncState.lastSyncedXml = remoteXml; // 동기화된 XML 저장
            
            // 원격 변경사항은 데이터베이스에 저장하지 않음 (이미 다른 사용자가 저장했음)
            
          } catch (directImportError) {
            console.log('⚠️ Direct import failed, trying BpmnEditor as fallback:', directImportError.message);
            
            // Fallback: DOM 에러 등의 경우 BpmnEditor를 통한 동기화 시도 (서버 API 사용)
            try {
              if (window.appManager && window.appManager.bpmnEditor) {
                // 현재 다이어그램 데이터 구성
                const diagramData = {
                  id: this.getCurrentDiagramId(),
                  content: remoteXml,
                  bpmn_xml: remoteXml
                };
                
                console.log('🔄 Fallback: Syncing via BpmnEditor.openDiagram...');
                await window.appManager.bpmnEditor.openDiagram(diagramData);
                console.log('✅ Fallback BpmnEditor sync succeeded');
                this.syncState.retryCount = 0;
                this.syncState.lastSyncedXml = remoteXml;
                
              } else {
                throw new Error('BpmnEditor not available');
              }
            } catch (fallbackError) {
              console.log('⚠️ Fallback BpmnEditor sync also failed:', fallbackError.message);
              if (directImportError.message.includes('root-') || 
                  directImportError.message.includes('Cannot read properties')) {
                console.log('⚠️ DOM error - will retry later');
                setTimeout(() => this.syncFromRemote(), 2000);
                return;
              }
            }
          }
        } catch (importError) {
          console.log('⚠️ Import process failed:', importError.message);
          setTimeout(() => this.syncFromRemote(), 2000);
          return;
        }
      } else {
        console.log('⚠️ No remote XML found');
      }
      
    } catch (error) {
      console.error('로컬 동기화 실패:', error);
      this.emit('syncError', { error, direction: 'fromRemote' });
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * 모델러가 준비되었는지 확인합니다.
   */
  isModelerReady() {
    try {
      if (!this.modeler) {
        return false;
      }
      
      const canvas = this.modeler.get('canvas');
      if (!canvas) {
        return false;
      }
      
      // 기본적인 canvas 메서드들이 사용 가능한지 확인
      const hasAddRootElement = typeof canvas.addRootElement === 'function';
      const hasGetContainer = typeof canvas.getContainer === 'function';
      
      return hasAddRootElement && hasGetContainer;
    } catch (error) {
      return false;
    }
  }

  /**
   * 모델러가 준비될 때까지 대기합니다.
   */
  async waitForModelerReady(maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (!this.isModelerReady() && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.isModelerReady()) {
      throw new Error('모델러가 준비되지 않았습니다 (타임아웃)');
    }
  }

  /**
   * 현재 다이어그램 ID를 가져옵니다.
   * @returns {string} 다이어그램 ID
   */
  getCurrentDiagramId() {
    if (window.appManager && window.appManager.bpmnEditor && window.appManager.bpmnEditor.currentDiagram) {
      return window.appManager.bpmnEditor.currentDiagram.id || window.appManager.bpmnEditor.currentDiagram.diagramId;
    }
    return 'unknown-diagram';
  }

  /**
   * 현재 BPMN XML을 가져옵니다.
   * @returns {Promise<string>} BPMN XML 문자열
   */
  async getCurrentBpmnXml() {
    try {
      // 모델러가 존재하는지 확인
      if (!this.modeler) {
        console.warn('모델러가 초기화되지 않았습니다. 기본 BPMN XML을 반환합니다.');
        return this.getDefaultBpmnXml();
      }

      // 모델러에 정의가 로드되어 있는지 확인
      const definitions = this.modeler.getDefinitions();
      if (!definitions) {
        // 정의가 없으면 기본 BPMN XML 반환
        return this.getDefaultBpmnXml();
      }
      
      const result = await this.modeler.saveXML({ format: true });
      return result.xml;
    } catch (error) {
      console.error('BPMN XML 가져오기 실패:', error);
      // 실패 시 기본 BPMN XML 반환
      return this.getDefaultBpmnXml();
    }
  }

  /**
   * 기본 BPMN XML을 반환합니다.
   * @returns {string} 기본 BPMN XML 문자열
   */
  getDefaultBpmnXml() {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
           '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">\n' +
           '  <bpmn:process id="Process_1" isExecutable="true" />\n' +
           '</bpmn:definitions>';
  }

  /**
   * 연결 상태 변경을 처리합니다.
   * @param {Object} event - 연결 상태 이벤트
   */
  handleConnectionChange(event) {
    this.emit('connectionChange', event);
    
    if (event.connected) {
      // console.log('🔗 협업 서버에 연결되었습니다.'); // Disabled: too verbose
      // 재연결 시 동기화
      this.syncFromRemote();
    } else {
      // console.log('⚠️ 협업 서버와의 연결이 끊어졌습니다.'); // Disabled: too verbose
    }
  }

  /**
   * 사용자 awareness 변경을 처리합니다.
   * @param {Object} event - awareness 변경 이벤트
   */
  handleAwarenessChange(event) {
    this.emit('awarenessChange', event);
    
    const users = collaborationManager.getConnectedUsers();
    // console.log(`👥 연결된 사용자: ${users.length}명`); // Disabled: too verbose
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
   * 서버 측 저장 상태를 확인합니다.
   * 실제 저장은 WebSocket 서버에서 자동으로 처리됩니다.
   */
  async checkServerSaveStatus() {
    const status = this.getServerSaveStatus();
    console.log('💾 Server-side save status:', status);
    return status;
  }

  /**
   * 커서 추적을 설정합니다.
   */
  setupCursorTracking() {
    if (!this.modeler) {
      console.warn('Modeler not available for cursor tracking');
      return;
    }

    try {
      // Canvas 요소 가져오기 (안전한 방식)
      const canvas = this.modeler.get('canvas');
      const eventBus = this.modeler.get('eventBus');
      
      if (!canvas) {
        // 조용한 재시도 (로그 스팸 방지)
        setTimeout(() => this.setupCursorTracking(), 1000);
        return;
      }
      
      const canvasContainer = canvas.getContainer();
      
      if (!canvasContainer) {
        // 조용한 재시도 (로그 스팸 방지)
        setTimeout(() => this.setupCursorTracking(), 1000);
        return;
      }
      
      // 마우스 이동 이벤트 리스너
      canvasContainer.addEventListener('mousemove', (e) => {
        this.updateLocalCursor(e);
      });
      
      // 요소 클릭 이벤트 리스너
      eventBus.on('element.click', (e) => {
        this.updateLocalCursor(null, e.element);
      });
      
      // Awareness 변경 이벤트 리스너
      collaborationManager.on('awarenessChange', (data) => {
        this.updateRemoteCursors();
      });
      
      console.log('👆 커서 추적이 설정되었습니다.');
      
    } catch (error) {
      console.warn('⚠️ Failed to setup cursor tracking:', error);
      // 협업 기능은 계속 작동하되 커서 추적만 비활성화
    }
  }
  
  /**
   * 로컬 사용자의 커서 위치를 업데이트합니다.
   * @param {MouseEvent} mouseEvent - 마우스 이벤트
   * @param {Object} element - 클릭된 BPMN 요소
   */
  updateLocalCursor(mouseEvent, element = null) {
    if (!this.isInitialized) return;
    
    try {
      const canvas = this.modeler.get('canvas');
      if (!canvas) return;
      
      const canvasContainer = canvas.getContainer();
      if (!canvasContainer) return;
      
      const rect = canvasContainer.getBoundingClientRect();
      
      let cursorData = {
        timestamp: Date.now()
      };
      
      if (mouseEvent) {
        // 마우스 위치 기반 커서
        cursorData.x = mouseEvent.clientX - rect.left;
        cursorData.y = mouseEvent.clientY - rect.top;
        cursorData.type = 'mouse';
      }
      
      if (element) {
        // 요소 기반 커서
        cursorData.elementId = element.id;
        cursorData.elementType = element.type;
        cursorData.type = 'element';
      }
      
      // Awareness에 커서 정보 업데이트
      collaborationManager.updateCursor(cursorData);
      this.cursorState.localCursor = cursorData;
      
    } catch (error) {
      console.warn('⚠️ Failed to update local cursor:', error);
    }
  }
  
  /**
   * 원격 사용자들의 커서를 업데이트합니다.
   */
  updateRemoteCursors() {
    if (!this.isInitialized) return;
    
    const connectedUsers = collaborationManager.getConnectedUsers();
    const currentUserId = collaborationManager.getCurrentUser()?.id;
    
    // 기존 커서 요소들 정리
    this.clearOldCursors();
    
    connectedUsers.forEach(user => {
      if (user.id !== currentUserId && user.cursor) {
        this.renderUserCursor(user);
      }
    });
  }
  
  /**
   * 사용자 커서를 렌더링합니다.
   * @param {Object} user - 사용자 정보
   */
  renderUserCursor(user) {
    const canvas = this.modeler.get('canvas');
    const canvasContainer = canvas.getContainer();
    
    // 기존 커서 요소 제거
    const existingCursor = this.cursorState.cursorElements.get(user.id);
    if (existingCursor) {
      existingCursor.remove();
    }
    
    // 새 커서 요소 생성
    const cursorElement = document.createElement('div');
    cursorElement.className = 'user-cursor';
    cursorElement.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 1000;
      font-size: 0.8rem;
      color: white;
      background-color: ${user.color};
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      white-space: nowrap;
      transform: translate(-50%, -100%);
      margin-top: -5px;
    `;
    
    if (user.cursor.type === 'mouse' && user.cursor.x !== undefined && user.cursor.y !== undefined) {
      // 마우스 위치 기반 커서
      cursorElement.style.left = user.cursor.x + 'px';
      cursorElement.style.top = user.cursor.y + 'px';
      cursorElement.textContent = user.name;
    } else if (user.cursor.type === 'element' && user.cursor.elementId) {
      // 요소 기반 커서
      const element = canvas.findRoot().children.find(el => el.id === user.cursor.elementId);
      if (element) {
        const gfx = canvas.getGraphics(element);
        if (gfx) {
          const bbox = gfx.getBBox();
          cursorElement.style.left = (bbox.x + bbox.width / 2) + 'px';
          cursorElement.style.top = bbox.y + 'px';
          cursorElement.textContent = `${user.name} (${user.cursor.elementType})`;
        }
      }
    }
    
    canvasContainer.appendChild(cursorElement);
    this.cursorState.cursorElements.set(user.id, cursorElement);
  }
  
  /**
   * 오래된 커서들을 정리합니다.
   */
  clearOldCursors() {
    const now = Date.now();
    const timeout = 10000; // 10초 타임아웃
    
    this.cursorState.cursorElements.forEach((element, userId) => {
      const user = collaborationManager.getConnectedUsers().find(u => u.id === userId);
      if (!user || !user.cursor || (now - user.cursor.timestamp) > timeout) {
        element.remove();
        this.cursorState.cursorElements.delete(userId);
      }
    });
  }
  
  /**
   * 초기 문서 동기화를 처리합니다.
   * 서버에서 문서를 로드했는지 확인하고, 없으면 클라이언트 문서를 업로드합니다.
   */
  async handleInitialDocumentSync() {
    try {
      console.log('🔄 Handling initial document sync...');
      
      // 서버에서 문서를 가져왔는지 확인
      const remoteXml = this.sharedDiagram.get('xml');
      const currentXml = await this.getCurrentBpmnXml();
      
      if (remoteXml && remoteXml.trim() !== '') {
        // 서버에 문서가 있음 - 로컬에 적용
        console.log('📖 Server has document, loading from server...');
        if (remoteXml !== currentXml) {
          await this.syncFromRemote();
        }
      } else {
        // 서버에 문서가 없음 - 현재 문서를 서버에 업로드
        console.log('📤 Server has no document, uploading current document...');
        this.sharedDiagram.set('xml', currentXml);
        this.sharedDiagram.set('lastModified', Date.now());
        this.sharedDiagram.set('lastModifiedBy', collaborationManager.getCurrentUser()?.id);
      }
      
    } catch (error) {
      console.error('❌ Initial document sync failed:', error);
    }
  }

  /**
   * 서버 측 데이터베이스 저장 상태를 확인합니다.
   * 실제 저장은 WebSocket 서버에서 처리됩니다.
   */
  getServerSaveStatus() {
    return {
      persistenceMode: 'server-side',
      message: 'Database persistence is handled by the WebSocket server',
      collaborationEnabled: this.collaborationEnabled,
      isConnected: collaborationManager.isConnectedToServer()
    };
  }

  /**
   * 현재 다이어그램 정보를 가져옵니다.
   * @returns {Object|null} 다이어그램 정보
   */
  getCurrentDiagramInfo() {
    try {
      if (window.appManager && window.appManager.bpmnEditor && window.appManager.bpmnEditor.currentDiagram) {
        return window.appManager.bpmnEditor.currentDiagram;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Could not get current diagram info:', error);
      return null;
    }
  }


  /**
   * 협업 룸을 변경합니다.
   * @param {string} newRoomId - 새로운 룸 ID
   * @param {Object} userInfo - 사용자 정보 (선택사항)
   * @param {string} diagramId - 다이어그램 ID (서버 측 저장용)
   */
  async changeRoom(newRoomId, userInfo = null, diagramId = null) {
    if (!newRoomId) {
      console.warn('새로운 룸 ID가 제공되지 않았습니다.');
      return;
    }
    
    console.log(`🔄 협업 룸 변경: ${newRoomId}`);
    
    try {
      // 초기화되지 않은 경우 전체 초기화
      if (!this.isInitialized) {
        const finalUserInfo = userInfo || {
          id: 'anonymous-' + Date.now(),
          name: 'Anonymous User',
          email: 'anonymous@example.com'
        };
        
        await this.initialize(newRoomId, {
          websocketUrl: 'ws://localhost:1234',
          userInfo: finalUserInfo,
          diagramId: diagramId
        });
      } else {
        // 이미 초기화된 경우 룸만 변경 (재연결 없이)
        const success = await collaborationManager.changeRoom(newRoomId, diagramId);
        if (!success) {
          throw new Error('룸 변경 실패');
        }
        
        // 사용자 정보가 제공된 경우 업데이트
        if (userInfo) {
          collaborationManager.updateUserInfo(userInfo);
        }
      }
      
      console.log(`✅ 협업 룸 변경 완료: ${newRoomId}`);
      
    } catch (error) {
      console.error('❌ 협업 룸 변경 실패:', error);
      throw error;
    }
  }

  /**
   * 서버 연결 상태를 확인합니다.
   */
  isConnectedToServer() {
    return collaborationManager.isConnectedToServer();
  }

  /**
   * 연결된 사용자 목록을 가져옵니다.
   */
  getConnectedUsers() {
    return collaborationManager.getConnectedUsers();
  }

  /**
   * 협업 모듈을 종료합니다.
   */
  disconnect() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    if (this.remoteSyncTimeout) {
      clearTimeout(this.remoteSyncTimeout);
    }
    
    if (this.editingTimeout) {
      clearTimeout(this.editingTimeout);
    }
    
    
    // 모든 커서 요소 제거
    this.cursorState.cursorElements.forEach(element => element.remove());
    this.cursorState.cursorElements.clear();
    
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

// 개발자 도구용 전역 함수들
window.checkServerSaveStatus = async () => {
  try {
    if (window.appManager && window.appManager.bpmnEditor && window.appManager.bpmnEditor.collaborationModule) {
      const result = await window.appManager.bpmnEditor.collaborationModule.checkServerSaveStatus();
      console.log('💾 Server save status:', result);
      return result;
    } else {
      console.log('❌ No collaboration module found');
      return null;
    }
  } catch (error) {
    console.error('❌ Check server save status error:', error);
    return null;
  }
};

window.getCollaborationState = () => {
  try {
    if (window.appManager && window.appManager.bpmnEditor && window.appManager.bpmnEditor.collaborationModule) {
      const state = window.appManager.bpmnEditor.collaborationModule.getSyncState();
      console.log('🔄 Collaboration state:', state);
      return state;
    } else {
      console.log('❌ No collaboration module found');
      return null;
    }
  } catch (error) {
    console.error('❌ Get collaboration state error:', error);
    return null;
  }
};