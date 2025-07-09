import { EventEmitter } from 'events';
import { commandManager } from '../../../../lib/CommandManager.js';
import { DiagramCommandFactory } from '../../../../commands/DiagramCommands.js';
import { FolderCommandFactory } from '../../../../commands/FolderCommands.js';

/**
 * VS Code 레이아웃과 BPMN 에디터의 통합을 담당하는 클래스
 * BPMN 특화 기능, 파일 트리 구성, 에디터 헤더 관리
 */
export class VSCodeBpmnIntegration extends EventEmitter {
  constructor(layoutManager) {
    super();
    
    this.layoutManager = layoutManager;
    this.bpmnEditor = null;
    this.isEditorHeaderVisible = false;
    
    // 에디터 헤더 인스턴스 (외부에서 주입받음)
    this.editorHeader = null;
    
    // BPMN 특화 상태
    this.currentDiagram = null;
    this.currentProject = null;
    this.connectedUsers = [];
  }

  /**
   * BPMN 에디터 통합
   */
  async integrateBPMNEditor(editorInstance) {
    if (!editorInstance) {
      throw new Error('BPMN Editor instance is required');
    }

    this.bpmnEditor = editorInstance;
    console.log('🔧 Integrating BPMN Editor with VS Code Layout');

    // 에디터 컨테이너 준비
    const editorContent = this.layoutManager.getEditorContent();
    if (!editorContent) {
      throw new Error('Editor content container not found');
    }

    try {
      // 기존 컨테이너 정리
      this.clearEditorContent(editorContent);

      // BPMN 에디터 컨테이너 생성
      const bpmnContainer = this.createBPMNContainer();
      editorContent.appendChild(bpmnContainer);

      // BPMN 에디터를 새 컨테이너에 재초기화
      if (editorInstance.initializeModeler) {
        await editorInstance.initializeModeler(bpmnContainer);
      } else if (editorInstance.moveToContainer) {
        await editorInstance.moveToContainer('#bpmn-editor-container');
      }

      // 에디터 이벤트 리스너 설정
      if (editorInstance.editorCore) {
        editorInstance.editorCore.on('diagramClosed', (closedDiagram) => {
          console.log('📄 Diagram closed, showing welcome message');
          if (this.layoutManager) {
            this.layoutManager.showWelcomeMessage();
          }
        });
      }
      
      console.log('✅ BPMN editor successfully integrated');
      this.emit('editorIntegrated', editorInstance);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to integrate BPMN editor:', error);
      this.createPlaceholder(editorContent);
      this.emit('integrationError', error);
      throw error;
    }
  }

  /**
   * BPMN 에디터 컨테이너 생성
   */
  createBPMNContainer() {
    const bpmnContainer = document.createElement('div');
    bpmnContainer.id = 'bpmn-editor-container';
    bpmnContainer.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      background-color: #1e1e1e;
    `;
    
    return bpmnContainer;
  }

  /**
   * 에디터 컨텐츠 정리
   */
  clearEditorContent(editorContent) {
    // 환영 메시지 숨김
    const welcomeMessage = editorContent.querySelector('.editor-welcome-message');
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }

    // 기존 BPMN 컨테이너 제거
    const existingContainer = editorContent.querySelector('#bpmn-editor-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // 기존 플레이스홀더 제거
    const existingPlaceholders = editorContent.querySelectorAll('#bpmn-editor-placeholder');
    existingPlaceholders.forEach(p => p.remove());
  }

  /**
   * BPMN 다이어그램 열기
   */
  async openBPMNDiagram(item) {
    try {
      const appManager = window.appManager;
      if (!appManager) {
        throw new Error('AppManager not found');
      }

      const diagram = item.diagramData;
      if (!diagram) {
        throw new Error('Diagram data not found in the clicked item');
      }

      console.log('🔧 Opening BPMN diagram:', diagram);
      this.emit('diagramOpening', diagram);

      // BPMN 에디터 초기화 확인
      if (!appManager.bpmnEditor || !appManager.bpmnEditor.isInitialized) {
        console.log('🔧 BPMN Editor not initialized, initializing...');
        await appManager.initializeBpmnEditor();
      }

      // 에디터 컨텐츠 준비
      const editorContent = this.layoutManager.getEditorContent();
      const welcomeMessage = editorContent?.querySelector('.editor-welcome-message');
      if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
      }

      // 다이어그램 데이터로 BPMN 에디터에 로드
      await appManager.bpmnEditor.openDiagram({
        id: diagram.id,
        name: diagram.name,
        content: diagram.bpmn_xml
      });

      this.currentDiagram = diagram;
      console.log('✅ BPMN diagram opened successfully:', diagram.name);
      
      // Welcome 메시지 숨기고 BPMN 에디터 표시
      if (this.layoutManager) {
        this.layoutManager.showBPMNEditor();
        console.log('📄 BPMN editor displayed, welcome message hidden');
      }

      // 협업 세션 설정
      if (appManager.bpmnEditor?.collaborationHandler) {
        await appManager.bpmnEditor.collaborationHandler.setupCollaborationForDiagram(diagram);
      }
      
      this.emit('diagramOpened', diagram);
      return true;

    } catch (error) {
      console.error('❌ Failed to open BPMN diagram:', error);
      this.emit('diagramOpenError', error);
      
      if (window.appManager) {
        window.appManager.showNotification('다이어그램을 열 수 없습니다. 다시 시도해주세요.', 'error');
      }
      
      return false;
    }
  }

  /**
   * BPMN 프로젝트 구조 생성
   */
  async createBPMNProjectStructure(dataProvider) {
    if (!dataProvider) {
      console.warn('DataProvider not available for BPMN project structure');
      return;
    }

    try {
      // BPMN 파일 연결 설정
      this.setupBPMNFileAssociations();
      
      // 프로젝트 데이터 로드 및 트리 구성
      const projectData = await this.loadProjectData();
      if (projectData) {
        await this.buildProjectTree(dataProvider, projectData);
      }

      this.emit('projectStructureCreated');
    } catch (error) {
      console.error('❌ Failed to create BPMN project structure:', error);
      this.emit('projectStructureError', error);
    }
  }

  /**
   * BPMN 파일 연결 설정
   */
  setupBPMNFileAssociations() {
    // BPMN 파일에 대한 특별 처리 설정
    const container = this.layoutManager.getContainer();
    const explorerContainer = container.querySelector('.explorer-container');
    
    if (explorerContainer) {
      // 단일 클릭으로 BPMN 다이어그램 열기
      explorerContainer.addEventListener('click', (event) => {
        const treeItem = event.target.closest('.tree-item');
        if (treeItem && this.isBPMNFile(treeItem)) {
          this.handleBPMNFileClick(treeItem, event);
        }
      });

      this.emit('fileAssociationsSetup');
    }
  }

  /**
   * BPMN 파일 클릭 처리
   */
  handleBPMNFileClick(treeItem, event) {
    const item = this.getTreeItemData(treeItem);
    if (item && (item.type === 'file' || item.type === 'diagram')) {
      if (item.diagramData || item.diagramId) {
        this.openBPMNDiagram(item);
      }
    }
  }

  /**
   * 트리 아이템이 BPMN 파일인지 확인
   */
  isBPMNFile(treeItem) {
    const label = treeItem.querySelector('.tree-item-label')?.textContent;
    return label && (label.endsWith('.bpmn') || treeItem.dataset.type === 'diagram');
  }

  /**
   * 트리 아이템 데이터 추출
   */
  getTreeItemData(treeItem) {
    // 트리 아이템에서 데이터 추출 로직
    // 실제 구현은 Explorer 컴포넌트와 연동
    return treeItem._itemData || null;
  }

  /**
   * 프로젝트 데이터 로드
   */
  async loadProjectData() {
    try {
      // AppManager를 통해 프로젝트 데이터 가져오기
      const appManager = window.appManager;
      if (appManager && appManager.currentProject) {
        return appManager.currentProject;
      }
      return null;
    } catch (error) {
      console.error('Failed to load project data:', error);
      return null;
    }
  }

  /**
   * 프로젝트 트리 구성
   */
  async buildProjectTree(dataProvider, projectData) {
    // DataProvider를 통해 트리 구조 구성
    if (dataProvider.setProjectData) {
      dataProvider.setProjectData(projectData);
    }
  }

  /**
   * 에디터 헤더 관리
   */
  setEditorHeader(editorHeaderInstance) {
    this.editorHeader = editorHeaderInstance;
    this.emit('editorHeaderSet', editorHeaderInstance);
  }

  /**
   * 에디터 헤더 표시
   */
  showEditorHeader() {
    console.log('📋 VSCodeBpmnIntegration.showEditorHeader called');
    
    const headerContainer = this.layoutManager.getEditorHeaderContainer();
    console.log('📋 Header container found:', !!headerContainer);
    console.log('📋 Editor header instance:', !!this.editorHeader);
    
    if (headerContainer && this.editorHeader) {
      headerContainer.style.display = 'block';
      headerContainer.innerHTML = '';
      
      if (this.editorHeader.getContainer) {
        headerContainer.appendChild(this.editorHeader.getContainer());
      } else if (this.editorHeader.render) {
        headerContainer.innerHTML = this.editorHeader.render();
      }
      
      this.isEditorHeaderVisible = true;
      console.log('✅ Editor header displayed');
      this.emit('editorHeaderShown');
    } else {
      console.warn('❌ Cannot show editor header:', {
        hasContainer: !!headerContainer,
        hasEditorHeader: !!this.editorHeader
      });
    }
  }

  /**
   * 에디터 헤더 숨김
   */
  hideEditorHeader() {
    const headerContainer = this.layoutManager.getEditorHeaderContainer();
    if (headerContainer) {
      headerContainer.style.display = 'none';
      this.isEditorHeaderVisible = false;
      this.emit('editorHeaderHidden');
    }
  }

  /**
   * 브레드크럼 업데이트
   */
  updateBreadcrumb(breadcrumbData) {
    if (this.editorHeader && this.editorHeader.updateBreadcrumb) {
      this.editorHeader.updateBreadcrumb(breadcrumbData);
      this.emit('breadcrumbUpdated', breadcrumbData);
    }
  }

  /**
   * 접속자 정보 업데이트
   */
  updateConnectedUsers(users) {
    this.connectedUsers = users || [];
    
    if (this.editorHeader && this.editorHeader.updateConnectedUsers) {
      this.editorHeader.updateConnectedUsers(this.connectedUsers);
      this.emit('connectedUsersUpdated', this.connectedUsers);
    }
  }

  /**
   * 대시보드로 이동
   */
  goToDashboard() {
    if (window.appManager && window.appManager.showDashboard) {
      window.appManager.showDashboard();
      this.emit('dashboardRequested');
    }
  }

  /**
   * 브레드크럼 네비게이션 처리
   */
  handleBreadcrumbNavigation(id) {
    if (id === 'home') {
      this.goToDashboard();
    } else {
      console.log('Navigate to:', id);
      this.emit('navigationRequested', id);
      // TODO: 구체적인 네비게이션 로직 구현
    }
  }

  /**
   * 새 폴더 생성
   */
  async createNewFolder() {
    try {
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        throw new Error('No active project');
      }

      // 폴더 이름 입력 받기
      const folderName = prompt('새 폴더 이름을 입력하세요:');
      if (!folderName || !folderName.trim()) {
        return false;
      }

      // 폴더 생성 - Command Pattern 사용
      if (window.dbManager) {
        const createCommand = FolderCommandFactory.createFolder({
          name: folderName.trim(),
          project_id: appManager.currentProject.id,
          created_by: appManager.currentUser?.id
        });
        
        const result = await commandManager.executeCommand(createCommand);

        // 탐색기 새로고침
        if (window.vscodeLayout && window.vscodeLayout.explorer) {
          await window.vscodeLayout.explorer.refreshTree();
        }

        console.log('✅ Folder created successfully:', folderName);
        this.emit('folderCreated', result);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to create folder:', error);
      this.emit('folderCreateError', error);
      alert('폴더 생성에 실패했습니다.');
      return false;
    }
  }

  /**
   * 새 다이어그램 생성
   */
  async createNewDiagram() {
    try {
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        throw new Error('No active project');
      }

      // 다이어그램 이름 입력 받기
      const diagramName = prompt('새 다이어그램 이름을 입력하세요:');
      if (!diagramName || !diagramName.trim()) {
        return false;
      }

      // 다이어그램 생성 - Command Pattern 사용
      if (window.dbManager) {
        const createCommand = DiagramCommandFactory.createDiagram({
          name: diagramName.trim(),
          project_id: appManager.currentProject.id,
          created_by: appManager.currentUser?.id,
          bpmn_xml: `<?xml version="1.0" encoding="UTF-8"?>
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
</bpmn:definitions>`
        });
        
        const result = await commandManager.executeCommand(createCommand);

        // 탐색기 새로고침
        if (window.vscodeLayout && window.vscodeLayout.explorer) {
          await window.vscodeLayout.explorer.refreshTree();
        }

        console.log('✅ Diagram created successfully:', diagramName);
        this.emit('diagramCreated', result);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to create diagram:', error);
      this.emit('diagramCreateError', error);
      alert('다이어그램 생성에 실패했습니다.');
      return false;
    }
  }

  /**
   * 플레이스홀더 생성
   */
  createPlaceholder(container) {
    const placeholder = document.createElement('div');
    placeholder.id = 'bpmn-editor-placeholder';
    placeholder.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #cccccc;
      font-size: 16px;
      background-color: #1e1e1e;
    `;
    placeholder.textContent = 'BPMN 에디터를 로드할 수 없습니다.';
    
    container.appendChild(placeholder);
  }

  /**
   * 통합 상태 정보 반환
   */
  getIntegrationStatus() {
    return {
      hasBpmnEditor: !!this.bpmnEditor,
      hasEditorHeader: !!this.editorHeader,
      isEditorHeaderVisible: this.isEditorHeaderVisible,
      currentDiagram: this.currentDiagram,
      currentProject: this.currentProject,
      connectedUsersCount: this.connectedUsers.length
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 정리
    const container = this.layoutManager.getContainer();
    const explorerContainer = container.querySelector('.explorer-container');
    if (explorerContainer) {
      explorerContainer.removeEventListener('click', this.handleBPMNFileClick);
    }

    // 참조 정리
    this.bpmnEditor = null;
    this.editorHeader = null;
    this.currentDiagram = null;
    this.currentProject = null;
    this.connectedUsers = [];
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    this.layoutManager = null;
    
    console.log('🗑️ VSCodeBpmnIntegration destroyed');
  }
}