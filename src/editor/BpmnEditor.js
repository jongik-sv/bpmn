import { EventEmitter } from 'events';
import { BpmnEditorCore } from '../components/bpmn-editor/BpmnEditorCore.js';
import { BpmnCollaborationHandler } from '../components/bpmn-editor/BpmnCollaborationHandler.js';
import { BpmnAutoSave } from '../components/bpmn-editor/BpmnAutoSave.js';
import { BpmnUIIntegration } from '../components/bpmn-editor/BpmnUIIntegration.js';

/**
 * BPMN 에디터 메인 클래스 - 모든 기능을 통합하여 관리
 * 에디터 핵심, 협업, 자동 저장, UI 통합을 조합하여 완전한 BPMN 에디터 제공
 */
export class BpmnEditor extends EventEmitter {
  constructor(containerSelector = '#js-drop-zone') {
    super();
    
    this.containerSelector = containerSelector;
    
    // 핵심 모듈들 초기화
    this.editorCore = new BpmnEditorCore(containerSelector);
    this.collaborationHandler = new BpmnCollaborationHandler(this.editorCore);
    this.autoSave = new BpmnAutoSave(this.editorCore);
    this.uiIntegration = new BpmnUIIntegration(this.editorCore);
    
    // 현재 상태
    this.currentDiagram = null;
    this.currentProject = null;
    this.currentUser = null;
    this.isInitialized = false;
    
    // 모듈 간 이벤트 연결
    this.setupModuleIntegration();
  }

  /**
   * 모듈 간 이벤트 연결 및 통합 설정
   */
  setupModuleIntegration() {
    // 에디터 핵심 이벤트 전달
    this.editorCore.on('initialized', () => {
      this.isInitialized = true;
      this.emit('initialized');
    });
    
    this.editorCore.on('diagramLoaded', (diagram) => {
      this.currentDiagram = diagram;
      this.uiIntegration.addToRecentFiles(diagram);
      this.emit('diagramLoaded', diagram);
    });
    
    this.editorCore.on('diagramClosed', (diagram) => {
      this.currentDiagram = null;
      this.emit('diagramClosed', diagram);
    });
    
    this.editorCore.on('newDiagramCreated', (diagram) => {
      this.currentDiagram = diagram;
      this.emit('newDiagramCreated', diagram);
    });
    
    // 협업 이벤트 전달
    this.collaborationHandler.on('collaborationInitialized', () => {
      this.uiIntegration.updateCollaborationInfo(this.collaborationHandler);
      this.emit('collaborationInitialized');
    });
    
    this.collaborationHandler.on('connectionChange', (data) => {
      this.emit('connectionChange', data);
    });
    
    // 자동 저장 이벤트 전달
    this.autoSave.on('saved', (data) => {
      this.emit('saved', data);
    });
    
    this.autoSave.on('autoSaveToDatabase', (data) => {
      this.emit('autoSaveToDatabase', data);
    });
    
    // UI 통합 이벤트 처리
    this.uiIntegration.on('saveRequested', () => {
      this.autoSave.forceSave();
    });
    
    this.uiIntegration.on('exportRequested', () => {
      this.exportDiagram();
    });
    
    this.uiIntegration.on('newDiagramRequested', () => {
      this.createNewDiagram();
    });
    
    this.uiIntegration.on('openDiagramRequested', () => {
      // 파일 선택 대화상자는 UI 통합에서 처리됨
    });
    
    this.uiIntegration.on('fileLoadRequested', (fileData) => {
      this.openDiagram(fileData);
    });
    
    this.uiIntegration.on('recentFileSelected', (file) => {
      this.openDiagram(file);
    });
    
    // 에러 이벤트 전달
    [this.editorCore, this.collaborationHandler, this.autoSave, this.uiIntegration].forEach(module => {
      module.on('error', (error) => {
        this.emit('error', error);
      });
    });
  }
  
  /**
   * 에디터 초기화
   */
  async initializeWhenReady() {
    try {
      await this.editorCore.initializeWhenReady();
      
      this.emit('initialized');
      console.log('✅ BpmnEditor integrated successfully');
    } catch (error) {
      console.error('❌ BpmnEditor initialization failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * 새 컨테이너로 에디터 이동
   */
  async moveToContainer(newContainerSelector) {
    return await this.editorCore.moveToContainer(newContainerSelector);
  }

  /**
   * 다이어그램 열기
   */
  async openDiagram(diagramData) {
    try {
      await this.editorCore.openDiagram(diagramData);
      this.currentDiagram = this.editorCore.getCurrentDiagram();
      
      // UI 통합 모듈에 현재 다이어그램 정보 전달
      if (this.currentDiagram) {
        this.uiIntegration.addToRecentFiles(this.currentDiagram);
      }
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 새 다이어그램 생성
   */
  async createNewDiagram() {
    try {
      await this.editorCore.createNewDiagram();
      this.currentDiagram = this.editorCore.getCurrentDiagram();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 현재 다이어그램 닫기
   */
  async closeDiagram() {
    try {
      await this.editorCore.closeDiagram();
      this.currentDiagram = null;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 다이어그램 내보내기
   */
  async exportDiagram() {
    try {
      await this.editorCore.exportDiagram();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 사용자 설정
   */
  async setUser(user) {
    this.currentUser = user;
    
    // 각 모듈에 사용자 정보 전달
    await this.collaborationHandler.setUser(user);
    this.uiIntegration.setCurrentUser(user);
    
    this.emit('userChanged', user);
  }

  /**
   * 프로젝트 설정
   */
  async setProject(project) {
    this.currentProject = project;
    
    // 각 모듈에 프로젝트 정보 전달
    await this.collaborationHandler.setProject(project);
    this.uiIntegration.setCurrentProject(project);
    
    this.emit('projectChanged', project);
  }

  /**
   * 협업 룸 변경
   */
  async changeCollaborationRoom(roomId) {
    await this.collaborationHandler.changeCollaborationRoom(roomId);
  }

  /**
   * 다이어그램 저장
   */
  async saveDiagram() {
    await this.autoSave.saveDiagram();
  }

  /**
   * 자동 저장 활성화
   */
  enableAutoSave() {
    this.autoSave.enableAutoSave();
  }
  
  /**
   * 자동 저장 비활성화
   */
  disableAutoSave() {
    this.autoSave.disableAutoSave();
  }

  /**
   * 접속된 사용자 목록 반환
   */
  getConnectedUsers() {
    return this.collaborationHandler.getConnectedUsers();
  }

  /**
   * 협업 연결 상태 확인
   */
  isConnectedToServer() {
    return this.collaborationHandler.isConnectedToServer();
  }

  /**
   * BPMN XML 유효성 검증
   */
  isValidBpmnXml(xml) {
    return this.editorCore.isValidBpmnXml(xml);
  }

  /**
   * 현재 다이어그램 가져오기
   */
  getCurrentDiagram() {
    return this.currentDiagram || this.editorCore.getCurrentDiagram();
  }

  /**
   * 모델러 인스턴스 가져오기
   */
  getModeler() {
    return this.editorCore.getModeler();
  }

  /**
   * 협업 연결 해제
   */
  disconnect() {
    this.collaborationHandler.disconnect();
    this.emit('disconnected');
  }

  /**
   * 에디터 상태 정보 반환
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      currentDiagram: this.currentDiagram,
      currentProject: this.currentProject,
      currentUser: this.currentUser,
      autoSaveStatus: this.autoSave.getStatus(),
      uiState: this.uiIntegration.getUIState(),
      isConnectedToServer: this.isConnectedToServer()
    };
  }
  
  /**
   * 리소스 정리
   */
  destroy() {
    // 모든 모듈 정리
    this.editorCore.destroy();
    this.collaborationHandler.destroy();
    this.autoSave.destroy();
    this.uiIntegration.destroy();
    
    this.removeAllListeners();
    
    this.currentDiagram = null;
    this.currentProject = null;
    this.currentUser = null;
    this.isInitialized = false;
    
    console.log('🗑️ BpmnEditor destroyed');
  }
}