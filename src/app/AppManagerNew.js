import $ from 'jquery';
import { BpmnEditor } from '../editor/BpmnEditor.js';
import VSCodeLayout from '../components/vscode-layout/VSCodeLayoutNew.js';
import { dbManager } from '../lib/database.js';

// Import the specialized manager modules
import { PageManager } from './managers/PageManager.js';
import { AuthStateManager } from './managers/AuthStateManager.js';
import { ProjectStateManager } from './managers/ProjectStateManager.js';
import { FileTreeManager } from './managers/FileTreeManager.js';

/**
 * 전체 애플리케이션 흐름을 관리하는 메인 오케스트레이터 클래스
 * 4개의 전문화된 매니저를 조합하여 기존 AppManager와 동일한 기능 제공
 */
export class AppManagerNew {
  constructor() {
    // 전문화된 매니저들
    this.pageManager = new PageManager();
    this.authManager = new AuthStateManager();
    this.projectManager = new ProjectStateManager();
    this.fileTreeManager = new FileTreeManager();
    
    // BPMN 에디터와 레이아웃
    this.bpmnEditor = null;
    this.vscodeLayout = null;
    
    // 협업 관리자 참조
    this.collaborationManager = null;
    
    this.initialize();
  }

  async initialize() {
    // 전역 객체 설정
    window.dbManager = dbManager;
    window.appManager = this;
    
    // 데이터베이스 연결 테스트
    await this.testDatabaseConnection();
    
    // 매니저 간 통신 설정
    this.setupManagerIntegration();
    
    console.log('✅ AppManagerNew initialized successfully');
  }

  /**
   * 매니저 간 통신 및 이벤트 연결 설정
   */
  setupManagerIntegration() {
    // ===== AUTH MANAGER 이벤트 연결 =====
    
    // 인증 상태 변경 → 페이지 및 프로젝트 관리
    this.authManager.on('userAuthenticated', (user) => {
      this.pageManager.showDashboard();
      this.projectManager.emit('userUpdated', user);
      this.fileTreeManager.emit('userUpdated', user);
    });
    
    this.authManager.on('userNotAuthenticated', () => {
      this.pageManager.showLanding();
      this.projectManager.emit('userUpdated', null);
      this.fileTreeManager.emit('userUpdated', null);
    });
    
    this.authManager.on('userSignedIn', (user) => {
      console.log('User signed in, updating UI...');
      this.updateUserDisplay(user);
      this.projectManager.emit('userUpdated', user);
      this.fileTreeManager.emit('userUpdated', user);
    });
    
    this.authManager.on('userSignedOut', () => {
      console.log('User signed out, returning to landing...');
      this.pageManager.showLanding();
      this.projectManager.emit('userUpdated', null);
      this.fileTreeManager.emit('userUpdated', null);
    });
    
    // ===== PAGE MANAGER 이벤트 연결 =====
    
    // 인증 요청들
    this.pageManager.on('loginRequested', () => {
      this.authManager.emit('loginModalRequested', 'login');
    });
    
    this.pageManager.on('signupRequested', () => {
      this.authManager.emit('loginModalRequested', 'signup');
    });
    
    this.pageManager.on('userMenuRequested', () => {
      this.authManager.emit('userMenuRequested');
    });
    
    // 프로젝트 관련 요청들
    this.pageManager.on('createProjectRequested', () => {
      this.projectManager.emit('createProjectRequested');
    });
    
    this.pageManager.on('inviteUsersRequested', () => {
      this.projectManager.emit('inviteUsersRequested');
    });
    
    this.pageManager.on('projectOpenRequested', (projectId) => {
      this.projectManager.emit('projectOpenRequested', projectId);
    });
    
    this.pageManager.on('projectsLoadRequested', () => {
      this.projectManager.emit('projectsLoadRequested');
    });
    
    // 에디터 관련 요청들
    this.pageManager.on('vscodeLayoutInitRequested', () => {
      this.initVSCodeLayout();
    });
    
    this.pageManager.on('bpmnEditorResetRequested', () => {
      this.resetBpmnEditor();
    });
    
    this.pageManager.on('projectDataLoadRequested', (project) => {
      this.projectManager.emit('projectDataLoadRequested', project);
      this.fileTreeManager.emit('projectUpdated', project);
    });
    
    this.pageManager.on('collaborationDisconnectRequested', () => {
      this.disconnectCollaboration();
    });
    
    this.pageManager.on('userDisplayUpdateRequested', () => {
      this.updateUserDisplay(this.authManager.getCurrentUser());
    });
    
    // ===== PROJECT MANAGER 이벤트 연결 =====
    
    // 프로젝트 열기 → 에디터로 전환
    this.projectManager.on('projectOpened', (project) => {
      this.pageManager.showEditor(project);
    });
    
    // 프로젝트 데이터 로드 → 파일 트리 업데이트
    this.projectManager.on('projectDataLoaded', (data) => {
      this.fileTreeManager.emit('projectUpdated', data.project);
    });
    
    // ===== FILE TREE MANAGER 이벤트 연결 =====
    
    // 다이어그램 열기 → BPMN 에디터
    this.fileTreeManager.on('diagramOpenRequested', (diagramData) => {
      this.openBpmnDiagram(diagramData);
    });
    
    // 새 다이어그램/폴더 생성 요청
    this.fileTreeManager.on('newDiagramRequested', (folderId) => {
      this.handleCreateDiagram(folderId);
    });
    
    this.fileTreeManager.on('newFolderRequested', (parentFolderId) => {
      this.handleCreateFolder(parentFolderId);
    });
    
    // 이름 변경 요청들
    this.fileTreeManager.on('diagramRenameRequested', (diagram) => {
      this.handleRenameDiagram(diagram);
    });
    
    this.fileTreeManager.on('folderRenameRequested', (folder) => {
      this.handleRenameFolder(folder);
    });
    
    // 삭제 요청들
    this.fileTreeManager.on('diagramDeleteRequested', (diagram) => {
      this.handleDeleteDiagram(diagram);
    });
    
    this.fileTreeManager.on('folderDeleteRequested', (folder) => {
      this.handleDeleteFolder(folder);
    });
    
    // ===== BPMN 에디터 이벤트 연결 =====
    
    // BPMN 에디터 사용자 업데이트 요청
    this.authManager.on('bpmnEditorUserUpdateRequested', (user) => {
      this.updateBpmnEditorUser(user);
    });
    
    // ===== 에러 및 경고 처리 =====
    
    // 다양한 매니저들의 에러/경고 이벤트 통합 처리
    [this.authManager, this.projectManager, this.fileTreeManager].forEach(manager => {
      manager.on('validationError', (message) => this.showErrorMessage(message));
      manager.on('permissionError', (message) => this.showErrorMessage(message));
      manager.on('dataLoadWarning', (message) => this.showWarningMessage(message));
    });
  }

  /**
   * 데이터베이스 연결 테스트
   */
  async testDatabaseConnection() {
    try {
      console.log('🔌 Testing database connection...');
      const testResult = await dbManager.testConnection();
      
      if (testResult.connected) {
        console.log('✅ Database connection successful');
        this.showInfoMessage('데이터베이스 연결이 성공했습니다.');
      } else {
        console.warn('⚠️ Database connection failed, using local mode');
        this.showWarningMessage('데이터베이스 연결에 실패했습니다. 로컬 모드로 진행합니다.');
      }
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      this.showWarningMessage('데이터베이스 연결을 확인할 수 없습니다. 로컬 모드로 진행합니다.');
    }
  }

  /**
   * VS Code 스타일 레이아웃 초기화
   */
  async initVSCodeLayout() {
    try {
      if (!this.vscodeLayout) {
        console.log('🎨 Initializing VS Code layout...');
        this.vscodeLayout = new VSCodeLayout();
        await this.vscodeLayout.initialize();
        
        // 파일 트리 로드 요청
        this.fileTreeManager.emit('fileTreeLoadRequested');
      }
    } catch (error) {
      console.error('Failed to initialize VS Code layout:', error);
      this.showErrorMessage('UI 레이아웃 초기화에 실패했습니다.');
    }
  }

  /**
   * BPMN 에디터 초기화/리셋
   */
  async resetBpmnEditor() {
    try {
      console.log('🔄 Resetting BPMN editor...');
      
      if (this.bpmnEditor) {
        this.bpmnEditor.destroy();
      }
      
      this.bpmnEditor = new BpmnEditor();
      await this.bpmnEditor.initialize();
      
      // 현재 사용자 설정
      const currentUser = this.authManager.getCurrentUser();
      if (currentUser) {
        this.bpmnEditor.setUser(currentUser);
      }
      
      console.log('✅ BPMN editor reset complete');
    } catch (error) {
      console.error('Failed to reset BPMN editor:', error);
      this.showErrorMessage('BPMN 에디터 초기화에 실패했습니다.');
    }
  }

  /**
   * BPMN 다이어그램 열기
   */
  async openBpmnDiagram(diagramData) {
    try {
      console.log('📊 Opening BPMN diagram:', diagramData.name);
      
      if (!this.bpmnEditor) {
        await this.resetBpmnEditor();
      }
      
      await this.bpmnEditor.openDiagram(diagramData);
      
      // 파일 트리에서 활성 다이어그램 표시
      this.fileTreeManager.setActiveDiagram(diagramData.id);
      
      // 협업 연결
      this.connectCollaboration(diagramData);
      
    } catch (error) {
      console.error('Failed to open BPMN diagram:', error);
      this.showErrorMessage(`다이어그램을 열 수 없습니다: ${error.message}`);
    }
  }

  /**
   * 협업 연결
   */
  connectCollaboration(diagramData) {
    try {
      if (window.collaborationManager) {
        console.log('🤝 Connecting to collaboration for diagram:', diagramData.id);
        this.collaborationManager = window.collaborationManager;
        this.collaborationManager.connectToDiagram(diagramData.id);
      }
    } catch (error) {
      console.error('Failed to connect collaboration:', error);
    }
  }

  /**
   * 협업 연결 해제
   */
  disconnectCollaboration() {
    try {
      if (this.collaborationManager) {
        console.log('💔 Disconnecting collaboration...');
        this.collaborationManager.disconnect();
        this.collaborationManager = null;
      }
    } catch (error) {
      console.error('Failed to disconnect collaboration:', error);
    }
  }

  /**
   * BPMN 에디터 사용자 업데이트
   */
  updateBpmnEditorUser(user) {
    try {
      if (this.bpmnEditor) {
        this.bpmnEditor.setUser(user);
        console.log('👤 BPMN editor user updated:', user?.email || 'no user');
      }
    } catch (error) {
      console.error('Failed to update BPMN editor user:', error);
    }
  }

  /**
   * 사용자 표시 업데이트
   */
  updateUserDisplay(user) {
    try {
      if (user) {
        const displayName = this.authManager.getUserDisplayName();
        $('#user-name').text(displayName);
        $('#user-menu-btn').show();
        $('#login-btn, #signup-btn').hide();
      } else {
        $('#user-name').text('');
        $('#user-menu-btn').hide();
        $('#login-btn, #signup-btn').show();
      }
    } catch (error) {
      console.error('Failed to update user display:', error);
    }
  }

  // ===== 파일/폴더 작업 핸들러들 =====

  /**
   * 새 다이어그램 생성
   */
  async handleCreateDiagram(folderId = null) {
    try {
      const name = prompt('다이어그램 이름을 입력하세요:', '새 다이어그램');
      if (!name || !name.trim()) return;

      const currentProject = this.projectManager.getCurrentProject();
      if (!currentProject) {
        this.showErrorMessage('프로젝트가 선택되지 않았습니다.');
        return;
      }

      const diagramData = {
        name: name.trim(),
        project_id: currentProject.id,
        folder_id: folderId,
        content: await this.getDefaultBpmnContent()
      };

      const result = await dbManager.createDiagram(diagramData);
      
      if (result.error) {
        console.warn('Diagram creation warning:', result.error);
        this.showWarningMessage('다이어그램이 로컬에 생성되었습니다.');
      } else {
        this.showSuccessMessage('다이어그램이 생성되었습니다.');
      }

      // 파일 트리 새로고침
      this.fileTreeManager.emit('fileTreeLoadRequested');
      
    } catch (error) {
      console.error('Failed to create diagram:', error);
      this.showErrorMessage('다이어그램 생성에 실패했습니다.');
    }
  }

  /**
   * 새 폴더 생성
   */
  async handleCreateFolder(parentFolderId = null) {
    try {
      const name = prompt('폴더 이름을 입력하세요:', '새 폴더');
      if (!name || !name.trim()) return;

      const currentProject = this.projectManager.getCurrentProject();
      if (!currentProject) {
        this.showErrorMessage('프로젝트가 선택되지 않았습니다.');
        return;
      }

      const folderData = {
        name: name.trim(),
        project_id: currentProject.id,
        parent_id: parentFolderId
      };

      const result = await dbManager.createFolder(folderData);
      
      if (result.error) {
        console.warn('Folder creation warning:', result.error);
        this.showWarningMessage('폴더가 로컬에 생성되었습니다.');
      } else {
        this.showSuccessMessage('폴더가 생성되었습니다.');
      }

      // 파일 트리 새로고침
      this.fileTreeManager.emit('fileTreeLoadRequested');
      
    } catch (error) {
      console.error('Failed to create folder:', error);
      this.showErrorMessage('폴더 생성에 실패했습니다.');
    }
  }

  /**
   * 다이어그램 이름 변경
   */
  async handleRenameDiagram(diagram) {
    try {
      const newName = prompt('새 이름을 입력하세요:', diagram.name);
      if (!newName || !newName.trim() || newName.trim() === diagram.name) return;

      const result = await dbManager.updateDiagram(diagram.id, { name: newName.trim() });
      
      if (result.error) {
        console.warn('Diagram rename warning:', result.error);
        this.showWarningMessage('다이어그램 이름이 로컬에서 변경되었습니다.');
      } else {
        this.showSuccessMessage('다이어그램 이름이 변경되었습니다.');
      }

      // 파일 트리 새로고침
      this.fileTreeManager.emit('fileTreeLoadRequested');
      
    } catch (error) {
      console.error('Failed to rename diagram:', error);
      this.showErrorMessage('다이어그램 이름 변경에 실패했습니다.');
    }
  }

  /**
   * 폴더 이름 변경
   */
  async handleRenameFolder(folder) {
    try {
      const newName = prompt('새 이름을 입력하세요:', folder.name);
      if (!newName || !newName.trim() || newName.trim() === folder.name) return;

      const result = await dbManager.updateFolder(folder.id, { name: newName.trim() });
      
      if (result.error) {
        console.warn('Folder rename warning:', result.error);
        this.showWarningMessage('폴더 이름이 로컬에서 변경되었습니다.');
      } else {
        this.showSuccessMessage('폴더 이름이 변경되었습니다.');
      }

      // 파일 트리 새로고침
      this.fileTreeManager.emit('fileTreeLoadRequested');
      
    } catch (error) {
      console.error('Failed to rename folder:', error);
      this.showErrorMessage('폴더 이름 변경에 실패했습니다.');
    }
  }

  /**
   * 다이어그램 삭제
   */
  async handleDeleteDiagram(diagram) {
    try {
      if (!confirm(`'${diagram.name}' 다이어그램을 삭제하시겠습니까?`)) return;

      const result = await dbManager.deleteDiagram(diagram.id);
      
      if (result.error) {
        console.warn('Diagram delete warning:', result.error);
        this.showWarningMessage('다이어그램이 로컬에서 삭제되었습니다.');
      } else {
        this.showSuccessMessage('다이어그램이 삭제되었습니다.');
      }

      // 파일 트리 새로고침
      this.fileTreeManager.emit('fileTreeLoadRequested');
      
    } catch (error) {
      console.error('Failed to delete diagram:', error);
      this.showErrorMessage('다이어그램 삭제에 실패했습니다.');
    }
  }

  /**
   * 폴더 삭제
   */
  async handleDeleteFolder(folder) {
    try {
      if (!confirm(`'${folder.name}' 폴더와 그 안의 모든 내용을 삭제하시겠습니까?`)) return;

      const result = await dbManager.deleteFolder(folder.id);
      
      if (result.error) {
        console.warn('Folder delete warning:', result.error);
        this.showWarningMessage('폴더가 로컬에서 삭제되었습니다.');
      } else {
        this.showSuccessMessage('폴더가 삭제되었습니다.');
      }

      // 파일 트리 새로고침
      this.fileTreeManager.emit('fileTreeLoadRequested');
      
    } catch (error) {
      console.error('Failed to delete folder:', error);
      this.showErrorMessage('폴더 삭제에 실패했습니다.');
    }
  }

  // ===== 유틸리티 메소드들 =====

  /**
   * 기본 BPMN 내용 반환
   */
  async getDefaultBpmnContent() {
    try {
      const response = await fetch('/assets/newDiagram.bpmn');
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.warn('Failed to load default BPMN template:', error);
    }
    
    // 기본 BPMN 템플릿
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }

  // ===== 메시지 표시 메소드들 =====

  /**
   * 성공 메시지 표시
   */
  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  /**
   * 경고 메시지 표시
   */
  showWarningMessage(message) {
    this.showToast(message, 'warning');
  }

  /**
   * 오류 메시지 표시
   */
  showErrorMessage(message) {
    this.showToast(message, 'error');
  }

  /**
   * 정보 메시지 표시
   */
  showInfoMessage(message) {
    this.showToast(message, 'info');
  }

  /**
   * 토스트 메시지 표시
   */
  showToast(message, type = 'info') {
    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3'
    };

    const toast = $(`
      <div class="toast-message" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: ${colors[type]};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease;
      ">
        ${message}
      </div>
    `);

    // CSS 애니메이션 추가
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    $('body').append(toast);

    // 3초 후 자동 제거
    setTimeout(() => {
      toast.css('animation', 'slideOut 0.3s ease');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ===== 레거시 호환성 메소드들 =====

  /**
   * 현재 사용자 반환 (레거시 호환성)
   */
  getCurrentUser() {
    return this.authManager.getCurrentUser();
  }

  /**
   * 현재 프로젝트 반환 (레거시 호환성)
   */
  getCurrentProject() {
    return this.projectManager.getCurrentProject();
  }

  /**
   * 현재 페이지 반환 (레거시 호환성)
   */
  getCurrentPage() {
    return this.pageManager.getCurrentPage();
  }

  /**
   * 대시보드 표시 (레거시 호환성)
   */
  showDashboard() {
    this.pageManager.showDashboard();
  }

  /**
   * 에디터 표시 (레거시 호환성)
   */
  showEditor(project) {
    this.pageManager.showEditor(project);
  }

  /**
   * 상태 정보 반환
   */
  getStatus() {
    return {
      auth: this.authManager.getAuthStatus(),
      page: this.pageManager.getPageStatus(),
      project: this.projectManager.getProjectStatus(),
      fileTree: this.fileTreeManager.getFileTreeStatus(),
      bpmnEditor: this.bpmnEditor ? {
        isInitialized: !!this.bpmnEditor,
        hasDiagram: this.bpmnEditor.hasActiveDiagram?.() || false
      } : null,
      vscodeLayout: this.vscodeLayout ? {
        isInitialized: !!this.vscodeLayout
      } : null
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    console.log('🗑️ Destroying AppManagerNew...');
    
    // 매니저들 정리
    this.pageManager?.destroy();
    this.authManager?.destroy();
    this.projectManager?.destroy();
    this.fileTreeManager?.destroy();
    
    // 에디터 및 레이아웃 정리
    this.bpmnEditor?.destroy();
    this.vscodeLayout?.destroy();
    
    // 협업 연결 해제
    this.disconnectCollaboration();
    
    // 전역 참조 정리
    if (window.appManager === this) {
      delete window.appManager;
    }
    
    // 토스트 메시지 정리
    $('.toast-message').remove();
    
    console.log('✅ AppManagerNew destroyed');
  }
}