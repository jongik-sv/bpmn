import $ from 'jquery';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { debounce } from 'min-dash';

import { 
  BpmnPropertiesPanelModule, 
  BpmnPropertiesProviderModule 
} from 'bpmn-js-properties-panel';

import { BpmnCollaborationModule } from '../collaboration/BpmnCollaborationModule.js';
import newDiagramXML from '../assets/newDiagram.bpmn';

/**
 * BPMN 편집기 클래스 - 새로운 UI 구조에 맞게 재구성
 */
export class BpmnEditor {
  constructor(containerSelector = '#js-drop-zone') {
    // 컨테이너 동적 할당 지원
    this.containerSelector = containerSelector;
    this.container = $(containerSelector);
    
    // 서브 요소들도 동적으로 찾거나 생성
    this.canvas = null;
    this.propertiesPanel = null;
    
    // 현재 상태
    this.currentUser = null;
    this.currentProject = null;
    this.currentDiagram = null;
    
    // 협업 모듈
    this.collaborationModule = null;
    
    // 에디터 상태
    this.modeler = null;
    this.isInitialized = false;
    
    // 자동 저장 상태 관리
    this.autoSaveTimeout = null;
    this.isSaving = false;
    this.lastSaveTime = 0;
    this.autoSaveDelay = 2000; // 2초 디바운스
    
    // 지연 초기화 - DOM이 준비되면 초기화
    this.initializeWhenReady();
  }
  
  async initializeWhenReady() {
    try {
      // DOM이 준비될 때까지 대기
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }
      
      await this.setupContainer();
      this.initializeModeler();
      this.setupEventListeners();
      this.setupFileDrop();
      this.isInitialized = true;
      console.log('BpmnEditor initialized');
    } catch (error) {
      console.error('❌ BpmnEditor initialization failed:', error);
    }
  }
  
  async setupContainer() {
    // 컨테이너가 존재하지 않으면 생성
    if (this.container.length === 0) {
      console.log('📍 Container not found, creating default structure...');
      
      // 기본 구조 생성 (flex layout)
      const body = $('body');
      const defaultContainer = $(`
        <div id="js-drop-zone" style="width: 100%; height: 100vh; position: relative; display: flex;">
          <div id="js-canvas" style="flex: 1; width: 100%; height: 100%; background: #fafafa;"></div>
          <div id="js-properties-panel" style="width: 300px; height: 100%; background: white; border-left: 1px solid #ccc; overflow-y: auto;"></div>
        </div>
      `);
      
      body.append(defaultContainer);
      this.container = defaultContainer;
    }
    
    // 서브 요소들 확인 및 생성
    this.canvas = this.container.find('#js-canvas');
    if (this.canvas.length === 0) {
      this.canvas = $('<div id="js-canvas" style="width: 100%; height: 100%;"></div>');
      this.container.append(this.canvas);
    }
    
    this.propertiesPanel = this.container.find('#js-properties-panel');
    if (this.propertiesPanel.length === 0) {
      this.propertiesPanel = $('<div id="js-properties-panel" style="position: absolute; top: 0; right: 0; width: 300px; height: 100%; background: white; border-left: 1px solid #ccc; z-index: 100;"></div>');
      this.container.append(this.propertiesPanel);
    }
    
    console.log('✅ Container setup complete');
  }
  
  /**
   * 새 컨테이너로 에디터 이동
   */
  async moveToContainer(newContainerSelector) {
    try {
      console.log('📦 Moving BPMN Editor to new container:', newContainerSelector);
      
      const newContainer = $(newContainerSelector);
      if (newContainer.length === 0) {
        throw new Error('New container not found: ' + newContainerSelector);
      }
      
      // 기존 modeler 정리
      if (this.modeler) {
        this.modeler.destroy();
        this.modeler = null;
      }
      
      // 새 컨테이너 설정
      this.containerSelector = newContainerSelector;
      this.container = newContainer;
      
      // 새 컨테이너에 필요한 구조 생성
      newContainer.html(`
        <div id="js-canvas" style="flex: 1; width: 100%; height: 100%; background: #fafafa;"></div>
        <div id="js-properties-panel" style="width: 250px; height: 100%; background: white; border-left: 1px solid #ccc; overflow-y: auto; display: block;"></div>
      `);
      
      this.canvas = newContainer.find('#js-canvas');
      this.propertiesPanel = newContainer.find('#js-properties-panel');
      
      // 에디터 재초기화
      this.initializeModeler();
      this.setupEventListeners();
      this.setupFileDrop();
      
      // 현재 다이어그램이 있으면 다시 로드
      if (this.currentDiagram) {
        await this.openDiagram(this.currentDiagram);
      }
      
      console.log('✅ BPMN Editor moved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to move BPMN Editor:', error);
      return false;
    }
  }

  /**
   * 사용자 설정 및 협업 초기화
   */
  async setUser(user) {
    this.currentUser = user;
    
    if (user && !this.collaborationModule) {
      await this.initializeCollaboration(user);
    } else if (!user && this.collaborationModule) {
      this.collaborationModule.disconnect();
      this.collaborationModule = null;
    }
  }

  /**
   * 프로젝트 설정
   */
  async setProject(project) {
    this.currentProject = project;
    
    // 기본 다이어그램 먼저 로드
    if (!this.currentDiagram) {
      await this.createNewDiagram();
    }
    
    // 협업 룸 ID 업데이트
    if (this.collaborationModule && project) {
      const roomId = `project-${project.id}`;
      try {
        // 현재 사용자 정보와 함께 룸 변경
        const userInfo = this.currentUser ? {
          id: this.currentUser.id,
          name: this.currentUser.user_metadata?.display_name || this.currentUser.email,
          email: this.currentUser.email
        } : null;
        
        await this.collaborationModule.changeRoom(roomId, userInfo);
      } catch (error) {
        console.warn('협업 룸 변경 실패:', error);
      }
    }
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
        console.log('🔄 Starting collaboration room change to:', roomId);
        
        const userInfo = this.currentUser ? {
          id: this.currentUser.id,
          name: this.currentUser.user_metadata?.display_name || this.currentUser.email,
          email: this.currentUser.email
        } : null;
        
        console.log('👤 User info for room change:', userInfo);
        
        await this.collaborationModule.changeRoom(roomId, userInfo);
        console.log('✅ Collaboration room changed successfully to:', roomId);
        
        // 성공 알림
        if (window.appManager) {
          window.appManager.showNotification(`협업 룸이 "${roomId}"로 변경되었습니다.`, 'success');
        }
        
      } catch (error) {
        console.error('❌ Failed to change collaboration room:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          roomId: roomId,
          userInfo: this.currentUser
        });
        
        if (window.appManager) {
          window.appManager.showNotification(`협업 룸 변경에 실패했습니다: ${error.message}`, 'error');
        }
      }
    } else {
      console.warn('⚠️ Collaboration module not initialized, cannot change room.');
      
      // 협업 모듈 재초기화 시도
      try {
        console.log('🔄 Attempting to reinitialize collaboration module...');
        await this.initializeCollaboration(roomId);
        console.log('✅ Collaboration module reinitialized successfully');
        
        if (window.appManager) {
          window.appManager.showNotification('협업 모듈이 재초기화되었습니다.', 'info');
        }
      } catch (reinitError) {
        console.error('❌ Failed to reinitialize collaboration module:', reinitError);
        if (window.appManager) {
          window.appManager.showNotification('협업 모듈 초기화에 실패했습니다.', 'error');
        }
      }
    }
  }

  /**
   * 다이어그램 열기
   */
  async openDiagram(diagramData) {
    try {
      this.currentDiagram = diagramData;
      
      // BPMN XML 로드 (빈 문서인 경우 디폴트 문서 사용)
      let xml = diagramData.content || newDiagramXML;
      
      // 빈 문서이거나 유효하지 않은 XML인 경우 디폴트 문서로 대체
      if (!xml || xml.trim() === '' || !this.isValidBpmnXml(xml)) {
        console.warn('빈 문서이거나 유효하지 않은 XML입니다. 디폴트 문서로 대체합니다.');
        xml = newDiagramXML;
        
        // 현재 다이어그램 데이터도 업데이트
        if (this.currentDiagram) {
          this.currentDiagram.content = xml;
        }
      }
      
      await this.modeler.importXML(xml);
      
      // 캔버스 크기 조정
      setTimeout(() => {
        try {
          const canvas = this.modeler.get('canvas');
          canvas.resized();
          console.log('Canvas resized after diagram load');
        } catch (resizeError) {
          console.warn('Canvas resize failed:', resizeError);
        }
      }, 100);
      
      this.container
        .removeClass('with-error')
        .addClass('with-diagram');
      
      // 브레드크럼 업데이트
      this.updateBreadcrumb();
      
      console.log('Diagram loaded successfully:', diagramData.name);
      
    } catch (err) {
      this.container
        .removeClass('with-diagram')
        .addClass('with-error');

      this.container.find('.error pre').text(err.message);
      console.error('Error loading diagram:', err);
    }
  }

  /**
   * 새 다이어그램 생성
   */
  async createNewDiagram() {
    await this.openDiagram({
      id: 'new',
      name: '새 다이어그램',
      content: newDiagramXML
    });
  }

  /**
   * 다이어그램 저장
   */
  async saveDiagram() {
    if (!this.currentDiagram) {
      window.appManager.showNotification('저장할 다이어그램이 없습니다.', 'warning');
      return;
    }

    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      
      // 데이터베이스에 저장
      if (window.dbManager && this.currentDiagram.id !== 'new') {
        const result = await window.dbManager.updateDiagram(this.currentDiagram.id, {
          bpmn_xml: xml,
          last_modified_by: this.currentUser?.id
        });
        
        if (result.error) {
          console.error('Database save error:', result.error);
          // 로컬 스토리지에 백업 저장
          this.saveToLocalStorage(xml);
        } else {
          console.log('Diagram saved to database:', this.currentDiagram.name);
        }
      } else {
        // 새 다이어그램이거나 DB 연결이 없으면 로컬에 저장
        this.saveToLocalStorage(xml);
      }
      
      window.appManager.showNotification('다이어그램이 저장되었습니다.', 'success');
      
    } catch (error) {
      console.error('Save diagram error:', error);
      window.appManager.showNotification('저장에 실패했습니다.', 'error');
    }
  }

  /**
   * 다이어그램 자동 저장 (디바운스 적용)
   */
  debouncedAutoSave() {
    // 기존 타이머 취소
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // 새로운 타이머 설정
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSaveDiagram();
    }, this.autoSaveDelay);
  }

  /**
   * 다이어그램 자동 저장 (실제 저장 로직)
   */
  async autoSaveDiagram() {
    if (!this.currentDiagram || this.currentDiagram.id === 'new') {
      return; // 새 다이어그램은 자동 저장하지 않음
    }

    // 이미 저장 중이면 무시
    if (this.isSaving) {
      console.log('⏳ Auto-save already in progress, skipping...');
      return;
    }

    // 최근 저장 시간 확인 (1초 내 중복 방지)
    const now = Date.now();
    if (now - this.lastSaveTime < 1000) {
      console.log('⏱️ Auto-save too frequent, skipping...');
      return;
    }

    this.isSaving = true;
    this.lastSaveTime = now;

    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      
      // 다이어그램 ID 결정 (id 또는 diagramId 사용)
      const diagramId = this.currentDiagram.id || this.currentDiagram.diagramId;
      
      if (!diagramId) {
        console.warn('No valid diagram ID found for auto-save:', this.currentDiagram);
        this.saveToLocalStorage(xml);
        this.showAutoSaveStatus('로컬 저장됨');
        return;
      }
      
      console.log('🔄 Auto-saving diagram:', { 
        id: diagramId, 
        name: this.currentDiagram.name || this.currentDiagram.title 
      });
      
      // 데이터베이스에 자동 저장
      if (window.dbManager) {
        const updateData = {
          bpmn_xml: xml,
          last_modified_by: this.currentUser?.id
        };
        
        const result = await window.dbManager.updateDiagram(diagramId, updateData);
        
        if (result.error) {
          console.warn('❌ Auto-save to database failed:', result.error);
          // 로컬 스토리지에 백업 저장
          this.saveToLocalStorage(xml);
          this.showAutoSaveStatus('로컬 저장됨');
        } else {
          console.log('✅ Auto-saved successfully:', this.currentDiagram.name || this.currentDiagram.title);
          this.showAutoSaveStatus('저장됨');
          
          // 현재 다이어그램 데이터 업데이트
          this.currentDiagram.bpmn_xml = xml;
          if (this.currentDiagram.content !== undefined) {
            this.currentDiagram.content = xml; // content 필드가 있는 경우에만 업데이트
          }
        }
      } else {
        // DB 연결이 없으면 로컬에 저장
        console.log('📁 Saving to local storage (no DB connection)');
        this.saveToLocalStorage(xml);
        this.showAutoSaveStatus('로컬 저장됨');
      }
      
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      this.showAutoSaveStatus('저장 실패');
    } finally {
      // 저장 상태 해제
      this.isSaving = false;
    }
  }

  /**
   * 로컬 스토리지에 저장
   */
  saveToLocalStorage(xml) {
    if (!this.currentDiagram) return;
    
    const key = `bpmn-diagram-${this.currentDiagram.id}`;
    const data = {
      id: this.currentDiagram.id,
      name: this.currentDiagram.name,
      xml: xml,
      lastSaved: new Date().toISOString()
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log('Saved to localStorage:', key);
    } catch (error) {
      console.error('localStorage save failed:', error);
    }
  }

  /**
   * 자동 저장 상태 표시
   */
  showAutoSaveStatus(message) {
    const statusEl = $('#auto-save-status');
    if (statusEl.length === 0) {
      // 상태 표시 요소가 없으면 생성
      $('body').append(`<div id="auto-save-status" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 0.875rem;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
      ">${message}</div>`);
    } else {
      statusEl.text(message);
    }
    
    // 페이드 인/아웃 효과
    $('#auto-save-status').css('opacity', '1');
    setTimeout(() => {
      $('#auto-save-status').css('opacity', '0');
    }, 2000);
  }

  /**
   * BPMN 모델러 초기화
   */
  initializeModeler(targetContainer = null) {
    try {
      // 타겟 컨테이너가 지정된 경우 해당 컨테이너 사용
      let canvasElement = this.canvas;
      let propertiesPanelSelector = '#js-properties-panel';
      
      if (targetContainer) {
        console.log('🔧 Initializing modeler in target container:', targetContainer);
        
        // 타겟 컨테이너에 canvas와 properties panel 생성 (flex layout)
        const $targetContainer = $(targetContainer);
        $targetContainer.css('display', 'flex');
        $targetContainer.html(`
          <div id="js-canvas" style="flex: 1; width: 100%; height: 100%; background: #fafafa;"></div>
          <div id="js-properties-panel" style="width: 250px; height: 100%; background: white; border-left: 1px solid #ccc; overflow-y: auto; display: block;"></div>
        `);
        
        canvasElement = $targetContainer.find('#js-canvas');
        this.canvas = canvasElement;
        this.propertiesPanel = $targetContainer.find('#js-properties-panel');
        this.container = $targetContainer;
      }
      
      if (!canvasElement || canvasElement.length === 0) {
        throw new Error('Canvas element not found');
      }

      this.modeler = new BpmnModeler({
        container: canvasElement[0], // DOM 요소 전달
        propertiesPanel: {
          parent: this.propertiesPanel[0] || propertiesPanelSelector
        },
        additionalModules: [
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule
        ]
      });

      this.container.removeClass('with-diagram');
      
      // 다이어그램 변경 시 내보내기 업데이트 및 자동 저장 (디바운스 적용)
      this.modeler.on('commandStack.changed', () => {
        this.exportArtifacts();
        this.debouncedAutoSave(); // 디바운스 적용된 자동 저장 사용
      });
      
      console.log('✅ BPMN Modeler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize BPMN modeler:', error);
      throw error;
    }
  }

  /**
   * 협업 기능 초기화
   */
  async initializeCollaboration(user) {
    if (!user) return;
    
    try {
      // 협업 모듈 생성
      this.collaborationModule = new BpmnCollaborationModule(this.modeler);
      
      // 협업 이벤트 리스너 설정
      this.collaborationModule.on('connectionChange', (data) => {
        console.log('Collaboration connection:', data);
        this.updateCollaborationStatus(data.connected);
      });
      
      this.collaborationModule.on('awarenessChange', (data) => {
        this.updateOnlineUsers(data);
      });
      
      this.collaborationModule.on('syncError', (data) => {
        console.error('Collaboration sync error:', data);
        if (window.appManager) {
          window.appManager.showNotification('동기화 오류가 발생했습니다.', 'error');
        }
      });
      
      this.collaborationModule.on('conflict', (data) => {
        console.warn('Collaboration conflict:', data);
        if (window.appManager) {
          window.appManager.showNotification('다른 사용자와의 충돌이 해결되었습니다.', 'warning');
        }
      });
      
      // 기본 룸 ID
      const roomId = this.currentProject ? `project-${this.currentProject.id}` : 'demo-room';
      
      // 협업 모듈 초기화
      await this.collaborationModule.initialize(roomId, {
        websocketUrl: 'ws://localhost:1234',
        userInfo: {
          id: user.id,
          name: user.user_metadata?.display_name || user.email,
          email: user.email
        }
      });
      
      console.log('✅ Collaboration initialized successfully');
      
    } catch (error) {
      console.warn('⚠️ Collaboration initialization failed:', error);
      this.collaborationModule = null; // 실패 시 null로 설정
      
      if (window.appManager) {
        window.appManager.showNotification('협업 기능을 사용할 수 없습니다. 오프라인 모드로 실행합니다.', 'warning');
      }
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 저장 버튼
    $('#save-diagram').on('click', () => {
      this.saveDiagram();
    });

    // 다운로드 버튼들
    $('.btn[href]').click(function(e) {
      if (!$(this).hasClass('active')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  /**
   * 파일 드래그 앤 드롭 설정
   */
  setupFileDrop() {
    // Check file API availability
    if (!window.FileList || !window.FileReader) {
      window.alert(
        '이 브라우저는 드래그 앤 드롭을 지원하지 않습니다. ' +
        'Chrome, Firefox 또는 Internet Explorer 10 이상을 사용해주세요.'
      );
      return;
    }

    this.registerFileDrop(this.container, (xml) => {
      this.openDiagram({
        id: 'imported',
        name: '가져온 다이어그램',
        content: xml
      });
    });
  }

  /**
   * 파일 드롭 핸들러 등록
   */
  registerFileDrop(container, callback) {
    const handleFileSelect = (e) => {
      e.stopPropagation();
      e.preventDefault();

      const files = e.dataTransfer.files;
      const file = files[0];

      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const xml = e.target.result;
        callback(xml);
      };
      reader.readAsText(file);
    };

    const handleDragOver = (e) => {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };

    container.get(0).addEventListener('dragover', handleDragOver, false);
    container.get(0).addEventListener('drop', handleFileSelect, false);
  }

  /**
   * 내보내기 업데이트 (디바운스)
   */
  exportArtifacts = debounce(async () => {
    try {
      // Export SVG
      const { svg } = await this.modeler.saveSVG();
      this.setDownloadLink('#js-download-svg', 'diagram.svg', svg, 'image/svg+xml');
    } catch (err) {
      console.error('Error exporting SVG:', err);
      this.setDownloadLink('#js-download-svg', 'diagram.svg', null);
    }

    try {
      // Export BPMN XML
      const { xml } = await this.modeler.saveXML({ format: true });
      this.setDownloadLink('#js-download-diagram', 'diagram.bpmn', xml, 'application/bpmn20-xml');
    } catch (err) {
      console.error('Error exporting BPMN:', err);
      this.setDownloadLink('#js-download-diagram', 'diagram.bpmn', null);
    }
  }, 500);

  /**
   * 다운로드 링크 설정
   */
  setDownloadLink(selector, filename, data, mimeType = 'text/plain') {
    const link = $(selector);
    
    if (data) {
      const encodedData = encodeURIComponent(data);
      link.addClass('active').attr({
        'href': `data:${mimeType};charset=UTF-8,${encodedData}`,
        'download': filename
      });
    } else {
      link.removeClass('active').removeAttr('href download');
    }
  }

  /**
   * 브레드크럼 업데이트
   */
  updateBreadcrumb() {
    const breadcrumb = $('#breadcrumb');
    
    if (this.currentProject && this.currentDiagram) {
      breadcrumb.text(`${this.currentProject.name} / ${this.currentDiagram.name}`);
    } else if (this.currentProject) {
      breadcrumb.text(this.currentProject.name);
    } else {
      breadcrumb.text('');
    }
  }

  /**
   * 협업 상태 표시
   */
  updateCollaborationStatus(connected) {
    // TODO: 협업 상태 UI 구현
    console.log('Collaboration status:', connected ? 'connected' : 'disconnected');
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
    
    console.log('Online users in editor:', users);
    // TODO: 에디터 내 사용자 목록 UI 구현
  }

  /**
   * 현재 다이어그램 닫기
   */
  async closeDiagram() {
    if (this.currentDiagram) {
      console.log('📝 Closing diagram:', this.currentDiagram.name);
      
      // 협업 세션 종료
      if (this.collaborationModule) {
        try {
          this.collaborationModule.disconnect();
        } catch (error) {
          console.warn('Collaboration disconnect error:', error);
        }
      }
      
      // 현재 다이어그램 정보 클리어
      this.currentDiagram = null;
      
      // 에디터를 기본 상태로 리셋
      try {
        if (this.modeler) {
          const xml = newDiagramXML;
          await this.modeler.importXML(xml);
        }
      } catch (error) {
        console.warn('Error resetting diagram:', error);
      }
      
      // UI 업데이트
      this.updateBreadcrumb();
      
      console.log('✅ Diagram closed');
    }
  }

  /**
   * 에디터 제목 업데이트
   */
  updateEditorTitle() {
    this.updateBreadcrumb();
    
    // 탭 제목도 업데이트
    if (this.currentDiagram) {
      document.title = `${this.currentDiagram.name} - BPMN 협업 에디터`;
    } else {
      document.title = 'BPMN 협업 에디터';
    }
  }

  /**
   * 다이어그램 내보내기
   */
  async exportDiagram() {
    if (!this.currentDiagram) {
      alert('내보낼 다이어그램이 없습니다.');
      return;
    }

    try {
      console.log('💾 Exporting diagram:', this.currentDiagram.name);
      
      // BPMN XML 내보내기
      const { xml } = await this.modeler.saveXML({ format: true });
      const blob = new Blob([xml], { type: 'application/bpmn20-xml' });
      const url = URL.createObjectURL(blob);
      
      // 다운로드 링크 생성
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentDiagram.name}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // URL 정리
      URL.revokeObjectURL(url);
      
      console.log('✅ Diagram exported successfully');
      
    } catch (error) {
      console.error('❌ Error exporting diagram:', error);
      alert('다이어그램 내보내기 중 오류가 발생했습니다.');
    }
  }

  /**
   * BPMN XML 유효성 검증
   */
  isValidBpmnXml(xml) {
    if (!xml || typeof xml !== 'string' || xml.trim() === '') {
      return false;
    }
    
    try {
      // 기본 XML 파싱 확인
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      
      // 파싱 오류 확인
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('XML 파싱 오류:', parserError.textContent);
        return false;
      }
      
      // BPMN 네임스페이스 확인
      const hasValidNamespace = xml.includes('http://www.omg.org/spec/BPMN/20100524/MODEL') ||
                               xml.includes('bpmn:definitions') ||
                               xml.includes('bpmn2:definitions');
      
      if (!hasValidNamespace) {
        console.warn('유효한 BPMN 네임스페이스가 없습니다.');
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn('BPMN XML 유효성 검증 실패:', error);
      return false;
    }
  }

  /**
   * 리소스 정리
   */
  destroy() {
    if (this.collaborationModule) {
      this.collaborationModule.disconnect();
      this.collaborationModule = null;
    }
    
    if (this.modeler) {
      this.modeler.destroy();
      this.modeler = null;
    }
  }
}