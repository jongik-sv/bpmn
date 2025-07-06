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
  constructor() {
    this.container = $('#js-drop-zone');
    this.canvas = $('#js-canvas');
    this.propertiesPanel = $('#js-properties-panel');
    
    // 현재 상태
    this.currentUser = null;
    this.currentProject = null;
    this.currentDiagram = null;
    
    // 협업 모듈
    this.collaborationModule = null;
    
    this.initializeModeler();
    this.setupEventListeners();
    this.setupFileDrop();
    
    console.log('BpmnEditor initialized');
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
   * 다이어그램 열기
   */
  async openDiagram(diagramData) {
    try {
      this.currentDiagram = diagramData;
      
      // BPMN XML 로드
      const xml = diagramData.content || newDiagramXML;
      await this.modeler.importXML(xml);
      
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
   * 다이어그램 자동 저장
   */
  async autoSaveDiagram() {
    if (!this.currentDiagram || this.currentDiagram.id === 'new') {
      return; // 새 다이어그램은 자동 저장하지 않음
    }

    try {
      const { xml } = await this.modeler.saveXML({ format: true });
      
      // 데이터베이스에 자동 저장
      if (window.dbManager) {
        const result = await window.dbManager.updateDiagram(this.currentDiagram.id, {
          bpmn_xml: xml,
          last_modified_by: this.currentUser?.id
        });
        
        if (result.error) {
          console.warn('Auto-save to database failed:', result.error);
          // 로컬 스토리지에 백업 저장
          this.saveToLocalStorage(xml);
        } else {
          console.log('Auto-saved:', this.currentDiagram.name);
          // 조용한 알림 (상태 표시)
          this.showAutoSaveStatus('저장됨');
        }
      } else {
        // DB 연결이 없으면 로컬에 저장
        this.saveToLocalStorage(xml);
        this.showAutoSaveStatus('로컬 저장됨');
      }
      
    } catch (error) {
      console.warn('Auto-save failed:', error);
      this.showAutoSaveStatus('저장 실패');
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
  initializeModeler() {
    this.modeler = new BpmnModeler({
      container: this.canvas,
      propertiesPanel: {
        parent: '#js-properties-panel'
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule
      ]
    });

    this.container.removeClass('with-diagram');
    
    // 다이어그램 변경 시 내보내기 업데이트 및 자동 저장
    this.modeler.on('commandStack.changed', debounce(() => {
      this.exportArtifacts();
      this.autoSaveDiagram();
    }, 1000));
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