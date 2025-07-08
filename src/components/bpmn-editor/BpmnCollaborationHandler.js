import { EventEmitter } from 'events';
import { BpmnCollaborationModule } from '../../collaboration/BpmnCollaborationModule.js';

/**
 * BPMN 에디터의 실시간 협업 기능을 담당하는 클래스
 * 에디터 핵심과 분리된 협업 로직을 관리
 */
export class BpmnCollaborationHandler extends EventEmitter {
  constructor(bpmnEditorCore) {
    super();
    
    this.editorCore = bpmnEditorCore;
    this.collaborationModule = null;
    this.currentUser = null;
    this.currentProject = null;
    this.currentDiagram = null;
    
    // 에디터 이벤트 구독
    this.setupEditorEventListeners();
  }

  setupEditorEventListeners() {
    // 에디터 다이어그램 변경 시 협업 동기화
    this.editorCore.on('diagramChanged', () => {
      this.syncToCollaborationServer();
    });
    
    // 다이어그램 로드 시 협업 룸 업데이트
    this.editorCore.on('diagramLoaded', (diagram) => {
      this.currentDiagram = diagram;
      this.updateCollaborationRoom();
    });
  }

  /**
   * 사용자 설정 및 협업 초기화
   */
  async setUser(user) {
    this.currentUser = user;

    // Initialize collaboration only if the modeler has been initialized
    if (user && this.editorCore.getModeler() && !this.collaborationModule) {
      await this.initializeCollaboration(user);
    } else if (!user && this.collaborationModule) {
      this.disconnect();
    }
    
    this.emit('userChanged', user);
  }

  /**
   * 프로젝트 설정
   */
  async setProject(project) {
    this.currentProject = project;
    
    // 협업 룸 ID 업데이트 (문서별 고유 룸)
    if (this.collaborationModule && project && this.currentDiagram) {
      await this.updateCollaborationRoom();
    }
    
    this.emit('projectChanged', project);
  }

  /**
   * 협업 룸 변경
   */
  async changeCollaborationRoom(roomId) {
    if (!roomId) {
      console.warn('⚠️ Room ID not provided for collaboration room change');
      return;
    }
    
    if (this.collaborationModule) {
      try {
        const userInfo = this.getUserInfo();
        
        await this.collaborationModule.changeRoom(roomId, userInfo);
        console.log('✅ Collaboration room changed successfully to:', roomId);
        
        // 성공 알림
        this.emit('roomChanged', roomId);
        if (window.appManager) {
          window.appManager.showNotification(`협업 룸이 "${roomId}"로 변경되었습니다.`, 'success');
        }
        
      } catch (error) {
        console.error('❌ Failed to change collaboration room:', error);
        this.emit('error', error);
        
        if (window.appManager) {
          window.appManager.showNotification(`협업 룸 변경에 실패했습니다: ${error.message}`, 'error');
        }
      }
    } else {
      console.warn('⚠️ Collaboration module not initialized, cannot change room.');
      
      // 협업 모듈 재초기화 시도
      try {
        await this.initializeCollaboration(roomId);
        this.emit('collaborationReinitialized');
        
        if (window.appManager) {
          window.appManager.showNotification('협업 모듈이 재초기화되었습니다.', 'info');
        }
      } catch (reinitError) {
        console.error('❌ Failed to reinitialize collaboration module:', reinitError);
        this.emit('error', reinitError);
        if (window.appManager) {
          window.appManager.showNotification('협업 모듈 초기화에 실패했습니다.', 'error');
        }
      }
    }
  }

  /**
   * 협업 기능 초기화
   */
  async initializeCollaboration(user) {
    if (!user) return;
    
    try {
      // 협업 모듈 생성
      this.collaborationModule = new BpmnCollaborationModule(this.editorCore.getModeler());
      
      // 협업 이벤트 리스너 설정
      this.collaborationModule.on('connectionChange', (data) => {
        this.updateCollaborationStatus(data.connected);
        this.emit('connectionChange', data);
      });
      
      this.collaborationModule.on('awarenessChange', (data) => {
        this.updateOnlineUsers(data);
        this.emit('awarenessChange', data);
      });
      
      this.collaborationModule.on('syncError', (data) => {
        console.error('Collaboration sync error:', data);
        this.emit('syncError', data);
        if (window.appManager) {
          window.appManager.showNotification('동기화 오류가 발생했습니다.', 'error');
        }
      });
      
      this.collaborationModule.on('conflict', (data) => {
        console.warn('Collaboration conflict:', data);
        this.emit('conflict', data);
        if (window.appManager) {
          window.appManager.showNotification('다른 사용자와의 충돌이 해결되었습니다.', 'warning');
        }
      });
      
      // 룸 ID와 다이어그램 ID 생성 (문서별 고유 룸)
      const roomId = this.currentDiagram 
        ? (this.currentDiagram.id || this.currentDiagram.diagramId)
        : 'demo-room';
      const diagramId = this.currentDiagram ? (this.currentDiagram.id || this.currentDiagram.diagramId) : null;
      
      console.log(`🏠 Initializing collaboration: room=${roomId}, diagram=${diagramId}`);
      
      // 협업 모듈 초기화 (다이어그램 ID 포함)
      await this.collaborationModule.initialize(
        roomId, 
        'ws://localhost:1234',
        this.getUserInfo(),
        diagramId
      );
      
      this.emit('collaborationInitialized');
      console.log('✅ Collaboration initialized successfully');
      
    } catch (error) {
      console.warn('⚠️ Collaboration initialization failed:', error);
      this.collaborationModule = null; // 실패 시 null로 설정
      this.emit('error', error);
      
      if (window.appManager) {
        window.appManager.showNotification('협업 기능을 사용할 수 없습니다. 오프라인 모드로 실행합니다.', 'warning');
      }
    }
  }

  /**
   * 협업 룸 업데이트 (다이어그램 변경 시)
   */
  async updateCollaborationRoom() {
    if (this.collaborationModule && this.currentProject && this.currentDiagram) {
      const roomId = this.currentDiagram.id || this.currentDiagram.diagramId;
      
      try {
        const userInfo = this.getUserInfo();
        
        // Diagram ID를 collaboration manager에 전달하여 서버 측 저장 활성화
        const diagramId = this.currentDiagram.id || this.currentDiagram.diagramId;
        await this.collaborationModule.changeRoom(roomId, userInfo, diagramId);
        
        this.emit('roomUpdated', roomId);
        console.log('✅ Collaboration room updated successfully after diagram load');
      } catch (error) {
        console.error('❌ Failed to update collaboration room after diagram load:', error);
        this.emit('error', error);
      }
    }
  }

  /**
   * 협업 서버로 변경사항 동기화
   */
  async syncToCollaborationServer() {
    try {
      if (!this.editorCore.getModeler() || !this.collaborationModule) {
        return;
      }

      // 현재 BPMN XML 가져오기
      const { xml } = await this.editorCore.getModeler().saveXML({ format: true });
      
      // 협업 서버의 공유 맵에 저장 (서버가 자동으로 DB에 저장)
      if (this.collaborationModule.sharedDiagram) {
        this.collaborationModule.sharedDiagram.set('xml', xml);
        this.emit('synced', xml);
      } else {
        console.warn('⚠️ No shared diagram available for sync');
      }
    } catch (error) {
      console.error('❌ Failed to sync to collaboration server:', error);
      this.emit('error', error);
    }
  }

  /**
   * 협업 상태 표시
   */
  updateCollaborationStatus(connected) {
    console.log('Collaboration status:', connected ? 'connected' : 'disconnected');
    
    // 협업 상태 UI 업데이트 이벤트 발생
    this.emit('statusChanged', { connected });
    
    if (connected) {
      // 자동 저장 비활성화 알림
      this.showCollaborationNotice();
    } else {
      // 협업 알림 제거
      this.hideCollaborationNotice();
    }
  }

  /**
   * 협업 모드 알림 표시
   */
  showCollaborationNotice() {
    const noticeId = 'collaboration-notice';
    if ($(`#${noticeId}`).length > 0) return; // 이미 표시 중
    
    const notice = $(`
      <div id="${noticeId}" style="
        position: fixed;
        top: 60px;
        right: 20px;
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 12px 16px;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
      ">
        <div style="display: flex; align-items: start; gap: 8px;">
          <span style="font-size: 16px;">⚠️</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">서버 중앙 저장 활성화</div>
            <div style="font-size: 13px; color: #b45309; line-height: 1.4;">
              모든 변경사항이 <strong>협업 서버에 자동 저장</strong>됩니다.<br>
              실시간 동기화 및 중앙 관리로 안전한 협업!
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: none;
            border: none;
            color: #92400e;
            cursor: pointer;
            font-size: 14px;
            padding: 0;
            margin-left: 4px;
          ">×</button>
        </div>
      </div>
    `);
    
    $('body').append(notice);
    
    // 10초 후 자동 제거
    setTimeout(() => {
      notice.fadeOut(300, () => notice.remove());
    }, 10000);
    
    this.emit('noticeShown');
  }

  /**
   * 협업 모드 알림 숨김
   */
  hideCollaborationNotice() {
    $('#collaboration-notice').fadeOut(300, function() {
      $(this).remove();
    });
    
    this.emit('noticeHidden');
  }

  /**
   * 온라인 사용자 목록 업데이트
   */
  updateOnlineUsers(data) {
    if (!data || !data.changes) return;
    
    const users = [];
    if (this.collaborationModule) {
      const connectedUsers = this.collaborationModule.getSyncState().connectedUsers;
      users.push(...connectedUsers);
    }
    
    this.emit('onlineUsersChanged', users);
    console.log('Online users in editor:', users);
  }

  /**
   * 사용자 아바타 생성
   */
  getUserAvatar(user) {
    // 사용자 이름의 첫 글자를 아바타로 사용
    if (user.name && user.name.length > 0) {
      return user.name.charAt(0).toUpperCase();
    }
    return '👤';
  }

  /**
   * 현재 사용자 정보 반환
   */
  getUserInfo() {
    return this.currentUser ? {
      id: this.currentUser.id,
      name: (this.currentUser.user_metadata && this.currentUser.user_metadata.display_name) || this.currentUser.email,
      email: this.currentUser.email
    } : null;
  }

  /**
   * 접속된 사용자 목록 반환
   */
  getConnectedUsers() {
    if (!this.collaborationModule) {
      return [];
    }
    
    try {
      const connectedUsers = this.collaborationModule.getConnectedUsers();
      return connectedUsers.map(user => ({
        id: user.id,
        name: user.name || 'Anonymous',
        email: user.email,
        avatar: this.getUserAvatar(user),
        status: user.status || 'online'
      }));
    } catch (error) {
      console.warn('Failed to get connected users:', error);
      return [];
    }
  }

  /**
   * 협업 연결 상태 확인
   */
  isConnectedToServer() {
    return this.collaborationModule && this.collaborationModule.isConnectedToServer();
  }

  /**
   * 협업 연결 해제
   */
  disconnect() {
    if (this.collaborationModule) {
      try {
        this.collaborationModule.disconnect();
        this.emit('disconnected');
      } catch (error) {
        console.warn('Collaboration disconnect error:', error);
        this.emit('error', error);
      }
      this.collaborationModule = null;
    }
    
    this.hideCollaborationNotice();
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.disconnect();
    this.removeAllListeners();
    
    // 에디터 이벤트 리스너 해제
    this.editorCore.removeAllListeners('diagramChanged');
    this.editorCore.removeAllListeners('diagramLoaded');
    
    this.currentUser = null;
    this.currentProject = null;
    this.currentDiagram = null;
    
    console.log('🗑️ BpmnCollaborationHandler destroyed');
  }
}