import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';

import './styles/main.css';
import './styles/login.css';

import $ from 'jquery';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { debounce } from 'min-dash';

import { 
  BpmnPropertiesPanelModule, 
  BpmnPropertiesProviderModule 
} from 'bpmn-js-properties-panel';

import { getCurrentUser, onAuthStateChange, logout } from './lib/auth.js';
import { showLoginModal } from './components/LoginModal.js';
import { BpmnCollaborationModule } from './collaboration/BpmnCollaborationModule.js';
import newDiagramXML from './assets/newDiagram.bpmn';

class BpmnCollaborativeEditor {
  constructor() {
    this.container = $('#js-drop-zone');
    this.canvas = $('#js-canvas');
    this.propertiesPanel = $('#js-properties-panel');
    
    // 사용자 및 인증 상태
    this.currentUser = null;
    
    // 협업 모듈
    this.collaborationModule = null;
    
    this.initializeAuth();
    this.initializeModeler();
    this.setupEventListeners();
    this.setupFileDrop();
    
    console.log('BPMN Collaborative Editor initialized');
  }

  initializeAuth() {
    // 현재 사용자 확인
    this.currentUser = getCurrentUser();
    console.log('Current user on init:', this.currentUser);
    this.updateAuthUI();
    
    // 인증 상태 변경 감지
    onAuthStateChange((event, data) => {
      console.log('Auth state change:', event, data);
      if (event === 'SIGNED_IN') {
        this.currentUser = data.user;
        this.onUserSignedIn(data.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.onUserSignedOut();
      }
      this.updateAuthUI();
    });
  }

  async onUserSignedIn(user) {
    console.log('User signed in:', user);
    
    // 협업 모듈 초기화
    await this.initializeCollaboration(user);
    
    // UI 업데이트
    this.updateAuthUI();
    
    // 환영 메시지 (선택사항)
    this.showNotification(`환영합니다, ${user.email}님!`, 'success');
  }

  onUserSignedOut() {
    console.log('User signed out');
    
    // 협업 연결 해제
    if (this.collaborationModule) {
      this.collaborationModule.disconnect();
      this.collaborationModule = null;
    }
    
    // UI 업데이트
    this.updateAuthUI();
  }

  async initializeCollaboration(user) {
    if (!user) return;
    
    try {
      // 기본 문서 ID (실제로는 프로젝트/다이어그램 ID를 사용)
      const roomId = 'demo-room';
      
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
        this.showNotification('동기화 오류가 발생했습니다.', 'error');
      });
      
      this.collaborationModule.on('conflict', (data) => {
        console.warn('Collaboration conflict:', data);
        this.showNotification('다른 사용자와의 충돌이 해결되었습니다.', 'warning');
      });
      
      // 협업 모듈 초기화
      await this.collaborationModule.initialize(roomId, {
        websocketUrl: 'ws://localhost:1234',
        userInfo: {
          id: user.id,
          name: user.email,
          email: user.email
        }
      });
      
      console.log('Collaboration initialized successfully');
      
    } catch (error) {
      console.warn('Collaboration initialization failed:', error);
      this.showNotification('협업 기능을 사용할 수 없습니다. 오프라인 모드로 실행합니다.', 'warning');
    }
  }

  updateAuthUI() {
    console.log('Updating auth UI, current user:', this.currentUser);
    const toolbar = $('.toolbar');
    console.log('Toolbar found:', toolbar.length);
    
    // 기존 인증 관련 버튼 제거
    toolbar.find('.auth-buttons').remove();
    
    if (this.currentUser) {
      // 로그인된 상태: 사용자 정보와 로그아웃 버튼
      const userInfo = `
        <div class="auth-buttons">
          <span class="user-info">${this.currentUser.email}</span>
          <button id="logout-btn" class="btn btn-secondary">로그아웃</button>
        </div>
      `;
      toolbar.append(userInfo);
      console.log('Added logout button');
    } else {
      // 로그아웃된 상태: 로그인 버튼
      const loginButton = `
        <div class="auth-buttons">
          <button id="login-btn" class="btn btn-primary">로그인</button>
        </div>
      `;
      toolbar.append(loginButton);
      console.log('Added login button');
    }
  }

  updateCollaborationStatus(connected) {
    const statusEl = $('.collaboration-status');
    
    if (statusEl.length === 0) {
      $('.app-header').append('<div class="collaboration-status"></div>');
    }
    
    $('.collaboration-status').html(
      connected 
        ? '<span class="status-online">🟢 온라인</span>'
        : '<span class="status-offline">🔴 오프라인</span>'
    );
  }

  updateOnlineUsers(data) {
    if (!data || !data.changes) return;
    
    const users = [];
    if (this.collaborationModule) {
      const connectedUsers = this.collaborationModule.getSyncState().connectedUsers;
      users.push(...connectedUsers);
    }
    
    console.log('Online users:', users);
    
    // 온라인 사용자 목록 UI 업데이트
    this.updateUserList(users);
  }

  updateUserList(users) {
    const userListContainer = $('.user-list');
    
    if (userListContainer.length === 0) {
      $('.app-header').append('<div class="user-list"></div>');
    }
    
    const userElements = users.map(user => 
      `<span class="user-avatar" style="background-color: ${user.color}" title="${user.name}">
        ${user.name.charAt(0).toUpperCase()}
      </span>`
    ).join('');
    
    $('.user-list').html(userElements);
  }

  showNotification(message, type = 'info') {
    // 간단한 알림 표시
    const notification = $(`
      <div class="notification notification-${type}">
        ${message}
      </div>
    `);
    
    $('body').append(notification);
    
    setTimeout(() => {
      notification.fadeOut(() => notification.remove());
    }, 3000);
  }

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
    
    // Export artifacts when diagram changes
    this.modeler.on('commandStack.changed', this.exportArtifacts.bind(this));
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Create new diagram buttons
    $('#js-create-diagram').click((e) => {
      e.preventDefault();
      this.createNewDiagram();
    });

    $('#js-create-diagram-link').click((e) => {
      e.preventDefault();
      this.createNewDiagram();
    });

    // 인증 관련 이벤트 (동적으로 생성되는 버튼들)
    $(document).on('click', '#login-btn', (e) => {
      e.preventDefault();
      console.log('Login button clicked!');
      try {
        console.log('Calling showLoginModal...');
        showLoginModal((user) => {
          console.log('Login successful:', user);
        });
      } catch (error) {
        console.error('Error showing login modal:', error);
      }
    });
    
    // 테스트용 일반 클릭 이벤트
    $(document).on('click', '.btn', (e) => {
      console.log('Button clicked:', e.target.id, e.target.textContent);
    });

    $(document).on('click', '#logout-btn', async (e) => {
      e.preventDefault();
      await logout();
    });

    // Download buttons (다운로드 버튼에만 적용)
    $('.btn[href]').click(function(e) {
      if (!$(this).hasClass('active')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

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
      this.openDiagram(xml);
    });
  }

  createNewDiagram() {
    this.openDiagram(newDiagramXML);
  }

  async openDiagram(xml, syncToRemote = true) {
    try {
      await this.modeler.importXML(xml);
      
      this.container
        .removeClass('with-error')
        .addClass('with-diagram');
      
      console.log('Diagram loaded successfully');
    } catch (err) {
      this.container
        .removeClass('with-diagram')
        .addClass('with-error');

      this.container.find('.error pre').text(err.message);
      console.error('Error loading diagram:', err);
    }
  }

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
}

// Initialize the editor when DOM is ready
$(document).ready(() => {
  new BpmnCollaborativeEditor();
});