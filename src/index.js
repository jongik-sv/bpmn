import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';

import './styles/main.css';
import './styles/login.css';
import './styles/project-manager.css';

import $ from 'jquery';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { debounce } from 'min-dash';

import { 
  BpmnPropertiesPanelModule, 
  BpmnPropertiesProviderModule 
} from 'bpmn-js-properties-panel';

import { getCurrentUser, onAuthStateChange, signOut } from './lib/supabase.js';
import { showSupabaseLoginModal } from './components/SupabaseLoginModal.js';
import { BpmnCollaborationModule } from './collaboration/BpmnCollaborationModule.js';
import { getProjectManager } from './components/ProjectManager.js';
import { testDatabaseConnection, createDiagram, updateDiagram, getDiagram, getProjectDiagrams } from './lib/database.js';
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
    
    // 프로젝트 매니저
    this.projectManager = null;
    
    // 현재 다이어그램 상태
    this.currentProject = null;
    this.currentDiagram = null;
    this.isDiagramModified = false;
    
    this.initializeAuth();
    this.initializeModeler();
    this.setupEventListeners();
    this.setupFileDrop();
    
    // 디버깅용 전역 함수
    window.debugAuth = async () => {
      console.log('=== AUTH DEBUG ===');
      console.log('Current user in app:', this.currentUser);
      const freshUser = await getCurrentUser();
      console.log('Fresh user from Supabase:', freshUser);
      if (freshUser && !this.currentUser) {
        console.log('User found but not set in app - updating...');
        this.currentUser = freshUser;
        this.onUserSignedIn(freshUser);
      }
      console.log('==================');
    };
    
    window.forceUpdateUI = () => {
      console.log('Force updating UI...');
      this.updateAuthUI();
    };
    
    window.testLogout = async () => {
      console.log('Testing logout...');
      const { signOut } = await import('./lib/supabase.js');
      await signOut();
      console.log('Logout completed');
    };
    
    console.log('BPMN Collaborative Editor initialized');
  }

  async initializeAuth() {
    // 데이터베이스 연결 테스트
    const dbConnected = await testDatabaseConnection();
    console.log('Database connection:', dbConnected ? '✅ Connected' : '❌ Failed');
    
    // 현재 사용자 확인
    this.currentUser = await getCurrentUser();
    console.log('Current user on init:', this.currentUser);
    this.updateAuthUI();
    
    // 인증 상태 변경 감지
    onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        const wasSignedIn = !!this.currentUser;
        console.log('SIGNED_IN event detected - wasSignedIn:', wasSignedIn, 'currentUser:', this.currentUser?.email);
        this.currentUser = session.user;
        
        // 처음 로그인한 경우에만 환영 메시지 표시
        // 이미 로그인되어 있었다면 (탭 전환, 토큰 갱신 등) 환영 메시지 없이 처리
        this.onUserSignedIn(session.user, !wasSignedIn);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.onUserSignedOut();
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // 토큰 갱신 시에도 사용자 정보 업데이트 (환영 메시지 없이)
        this.currentUser = session.user;
        console.log('Token refreshed for user:', session.user.email);
        // 협업 모듈이 없으면 초기화 (환영 메시지 없이)
        if (!this.collaborationModule) {
          this.onUserSignedIn(session.user, false);
        }
      }
      
      this.updateAuthUI();
    });
    
    // 페이지 포커스 시 사용자 상태 재확인
    window.addEventListener('focus', async () => {
      console.log('Window focused, checking auth status - currentUser:', this.currentUser?.email);
      const currentUser = await getCurrentUser();
      if (currentUser && !this.currentUser) {
        console.log('User logged in from another tab/window');
        this.currentUser = currentUser;
        this.onUserSignedIn(currentUser, false); // 환영 메시지 비활성화
      } else if (!currentUser && this.currentUser) {
        console.log('User logged out from another tab/window');
        this.currentUser = null;
        this.onUserSignedOut();
      }
      this.updateAuthUI();
    });
  }

  async onUserSignedIn(user, showWelcome = true) {
    console.log('User signed in:', user.email, 'showWelcome:', showWelcome, 'reason:', showWelcome ? 'first-time login' : 'tab switch/token refresh');
    
    // 프로젝트 매니저 초기화 (아직 없으면)
    if (!this.projectManager) {
      await this.initializeProjectManager();
    }
    
    // 협업 모듈 초기화 (아직 없으면)
    if (!this.collaborationModule) {
      await this.initializeCollaboration(user);
    }
    
    // UI 업데이트
    this.updateAuthUI();
    
    // 환영 메시지 (선택사항)
    if (showWelcome) {
      this.showNotification(`환영합니다, ${user.email}님!`, 'success');
    }
  }

  onUserSignedOut() {
    console.log('User signed out');
    
    // 프로젝트 매니저 정리
    if (this.projectManager) {
      this.projectManager.destroy();
      this.projectManager = null;
    }
    
    // 협업 연결 해제
    if (this.collaborationModule) {
      this.collaborationModule.disconnect();
      this.collaborationModule = null;
    }
    
    // UI 업데이트
    this.updateAuthUI();
  }

  async initializeProjectManager() {
    try {
      this.projectManager = getProjectManager();
      await this.projectManager.initialize();
      
      // 프로젝트 선택 이벤트 리스너
      this.projectManager.on('projectSelected', async (data) => {
        console.log('Project selected:', data.project.name);
        this.currentProject = data.project;
        
        // 프로젝트의 다이어그램 목록 로드
        await this.loadProjectDiagrams(data.project.id);
        
        // 선택된 프로젝트를 기반으로 협업 룸 변경
        this.updateCollaborationRoom(data.project.id);
      });
      
      // 전역 참조 설정 (알림 시스템용)
      window.bpmnEditor = this;
      
    } catch (error) {
      console.error('Project manager initialization failed:', error);
    }
  }

  updateCollaborationRoom(projectId) {
    if (this.collaborationModule && this.currentUser) {
      // 새 프로젝트로 협업 룸 변경
      const newRoomId = `project-${projectId}`;
      this.collaborationModule.disconnect();
      
      // 잠시 후 새 룸으로 재연결
      setTimeout(async () => {
        await this.initializeCollaboration(this.currentUser, newRoomId);
      }, 500);
    }
  }

  async initializeCollaboration(user, roomId = 'global-bpmn-room') {
    if (!user) return;
    
    try {
      console.log('Initializing collaboration for user:', user.email, 'in room:', roomId);
      
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
          name: user.user_metadata?.display_name || user.email?.split('@')[0],
          email: user.email
        }
      });
      
      console.log('Collaboration initialized successfully');
      
      // 협업 초기화 완료 후 공유 다이어그램 로드
      setTimeout(async () => {
        if (!this.container.hasClass('with-diagram')) {
          console.log('Auto-loading shared diagram after collaboration init...');
          await this.createNewDiagram();
        }
      }, 1000);
      
    } catch (error) {
      console.warn('Collaboration initialization failed:', error);
      this.showNotification('협업 기능을 사용할 수 없습니다. 오프라인 모드로 실행합니다.', 'warning');
    }
  }

  updateAuthUI() {
    console.log('Updating auth UI, current user:', this.currentUser);
    console.log('Current user details:', {
      id: this.currentUser?.id,
      email: this.currentUser?.email,
      metadata: this.currentUser?.user_metadata
    });
    const toolbar = $('.toolbar');
    console.log('Toolbar found:', toolbar.length);
    
    // 기존 인증 관련 버튼 제거
    toolbar.find('.auth-buttons').remove();
    
    if (this.currentUser) {
      // 로그인된 상태: 사용자 정보와 로그아웃 버튼
      const displayName = this.currentUser.user_metadata?.display_name || 
                         this.currentUser.email?.split('@')[0] || 
                         'Unknown User';
      const userInfo = `
        <div class="auth-buttons">
          <span class="user-info" title="${this.currentUser.email}">${displayName}</span>
          <button id="logout-btn" class="btn btn-secondary active btn-icon" title="로그아웃">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16,17V14H9V10H16V7L21,12L16,17M14,2A2,2 0 0,1 16,4V6H14V4H5V20H14V18H16V20A2,2 0 0,1 14,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2H14Z"/>
            </svg>
          </button>
        </div>
      `;
      toolbar.append(userInfo);
      console.log('Added logout button');
    } else {
      // 로그아웃된 상태: 로그인 버튼
      const loginButton = `
        <div class="auth-buttons">
          <button id="login-btn" class="btn btn-primary btn-icon" title="로그인">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10,17V14H3V10H10V7L15,12L10,17M10,2H19A2,2 0 0,1 21,4V20A2,2 0 0,1 19,22H10A2,2 0 0,1 8,20V18H10V20H19V4H10V6H8V4A2,2 0 0,1 10,2Z"/>
            </svg>
          </button>
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
      console.log('Creating new diagram...');
      this.createNewDiagram();
    });

    $('#js-create-diagram-link').click((e) => {
      e.preventDefault();
      console.log('Creating new diagram via link...');
      this.createNewDiagram();
    });

    // 인증 관련 이벤트 (동적으로 생성되는 버튼들)
    $(document).on('click', '#login-btn', (e) => {
      e.preventDefault();
      console.log('Login button clicked!');
      try {
        console.log('Calling showSupabaseLoginModal...');
        showSupabaseLoginModal('login', (user) => {
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
      await signOut();
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

  async createNewDiagram() {
    // 협업 모드에서는 공유 다이어그램 확인
    if (this.collaborationModule && this.collaborationModule.isInitialized) {
      console.log('Loading shared diagram from collaboration...');
      
      // 공유된 BPMN XML 가져오기
      const sharedXml = this.collaborationModule.getBpmnXml();
      
      if (sharedXml) {
        console.log('Found shared diagram, loading...');
        await this.openDiagram(sharedXml, false); // 동기화 방지
      } else {
        console.log('No shared diagram found, creating new shared diagram...');
        await this.openDiagram(newDiagramXML, false);
        // 새 다이어그램을 공유 상태로 설정
        console.log('Setting new diagram XML to collaboration...');
        this.collaborationModule.setBpmnXml(newDiagramXML);
        
        // 여러 방법으로 동기화 시도
        setTimeout(async () => {
          console.log('Force syncing new diagram - attempt 1...');
          await this.collaborationModule.forcSync();
        }, 100);
        
        setTimeout(async () => {
          console.log('Force syncing new diagram - attempt 2...');
          await this.collaborationModule.syncToRemote();
        }, 500);
        
        setTimeout(async () => {
          console.log('Force syncing new diagram - attempt 3...');
          this.collaborationModule.setBpmnXml(newDiagramXML);
          await this.collaborationModule.forcSync();
          
          // awareness 변경을 강제로 트리거
          if (this.collaborationModule && this.collaborationModule.emit) {
            this.collaborationModule.emit('awarenessChange', { 
              changes: ['forced-sync'], 
              timestamp: Date.now() 
            });
          }
        }, 1000);
      }
    } else {
      // 비협업 모드에서는 로컬 다이어그램 생성
      console.log('Loading local diagram...');
      await this.openDiagram(newDiagramXML);
    }
  }

  async openDiagram(xml, syncToRemote = true) {
    try {
      await this.modeler.importXML(xml);
      
      this.container
        .removeClass('with-error')
        .addClass('with-diagram');
      
      // 협업 모드에서 원격 동기화
      if (syncToRemote && this.collaborationModule && this.collaborationModule.isInitialized) {
        console.log('Syncing diagram to collaboration...');
        this.collaborationModule.setBpmnXml(xml);
        
        // 즉시 동기화 트리거
        setTimeout(() => {
          this.collaborationModule.forcSync();
        }, 100);
      }
      
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
      
      // Auto-save to database if user is logged in and has a current diagram
      if (this.currentUser && this.currentProject) {
        await this.autoSaveDiagram(xml);
      }
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

  /**
   * 프로젝트의 다이어그램 목록을 로드합니다.
   */
  async loadProjectDiagrams(projectId) {
    try {
      const { data: diagrams, error } = await getProjectDiagrams(projectId);
      
      if (error) {
        console.error('Error loading project diagrams:', error);
        this.showNotification('다이어그램을 불러오는 중 오류가 발생했습니다.', 'error');
        return;
      }
      
      console.log('Project diagrams loaded:', diagrams);
      this.updateDiagramList(diagrams);
      
      // 첫 번째 다이어그램이 있으면 자동으로 로드
      if (diagrams && diagrams.length > 0) {
        await this.loadDiagram(diagrams[0].id);
      } else {
        // 다이어그램이 없으면 새 다이어그램 생성
        await this.createNewProjectDiagram();
      }
      
    } catch (error) {
      console.error('Error loading project diagrams:', error);
      this.showNotification('다이어그램을 불러오는 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 다이어그램 목록 UI를 업데이트합니다.
   */
  updateDiagramList(diagrams) {
    // 간단한 다이어그램 목록 표시 (나중에 더 복잡한 UI로 확장 가능)
    const diagramList = diagrams.map(diagram => 
      `<div class="diagram-item" data-diagram-id="${diagram.id}">
        <span class="diagram-name">${diagram.name}</span>
        <span class="diagram-date">${new Date(diagram.updated_at).toLocaleDateString()}</span>
      </div>`
    ).join('');
    
    // 다이어그램 목록을 표시할 컨테이너가 있다면 업데이트
    const container = $('.diagram-list');
    if (container.length > 0) {
      container.html(diagramList);
    }
  }

  /**
   * 다이어그램을 데이터베이스에서 로드합니다.
   */
  async loadDiagram(diagramId) {
    try {
      const { data: diagram, error } = await getDiagram(diagramId);
      
      if (error) {
        console.error('Error loading diagram:', error);
        this.showNotification('다이어그램을 불러오는 중 오류가 발생했습니다.', 'error');
        return;
      }
      
      if (diagram) {
        console.log('Loading diagram:', diagram.name);
        this.currentDiagram = diagram;
        this.isDiagramModified = false;
        
        // BPMN XML을 모델러에 로드
        await this.openDiagram(diagram.bpmn_xml, false);
        
        this.showNotification(`다이어그램 "${diagram.name}"을 불러왔습니다.`, 'success');
      }
      
    } catch (error) {
      console.error('Error loading diagram:', error);
      this.showNotification('다이어그램을 불러오는 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 새 프로젝트 다이어그램을 생성합니다.
   */
  async createNewProjectDiagram() {
    if (!this.currentProject || !this.currentUser) {
      console.warn('Cannot create diagram: no project or user');
      return;
    }

    try {
      const diagramName = `새 다이어그램 ${new Date().toLocaleString()}`;
      
      const { data: newDiagram, error } = await createDiagram({
        project_id: this.currentProject.id,
        name: diagramName,
        description: '새로 생성된 BPMN 다이어그램',
        bpmn_xml: newDiagramXML,
        created_by: this.currentUser.id
      });
      
      if (error) {
        console.error('Error creating new diagram:', error);
        this.showNotification('새 다이어그램 생성 중 오류가 발생했습니다.', 'error');
        return;
      }
      
      console.log('New diagram created:', newDiagram);
      this.currentDiagram = newDiagram;
      this.isDiagramModified = false;
      
      // 새 다이어그램을 모델러에 로드
      await this.openDiagram(newDiagramXML, false);
      
      this.showNotification(`새 다이어그램 "${diagramName}"을 생성했습니다.`, 'success');
      
    } catch (error) {
      console.error('Error creating new diagram:', error);
      this.showNotification('새 다이어그램 생성 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 다이어그램을 데이터베이스에 자동 저장합니다.
   */
  async autoSaveDiagram(xml) {
    if (!this.currentDiagram || !this.currentUser) {
      return;
    }

    try {
      const { data: updatedDiagram, error } = await updateDiagram(this.currentDiagram.id, {
        bpmn_xml: xml,
        last_modified_by: this.currentUser.id
      });
      
      if (error) {
        console.error('Error auto-saving diagram:', error);
        return;
      }
      
      console.log('Diagram auto-saved:', updatedDiagram);
      this.currentDiagram = updatedDiagram;
      this.isDiagramModified = false;
      
      // 저장 상태 표시 (간단한 알림)
      this.showSaveStatus('저장됨');
      
    } catch (error) {
      console.error('Error auto-saving diagram:', error);
      this.showSaveStatus('저장 오류');
    }
  }

  /**
   * 저장 상태를 표시합니다.
   */
  showSaveStatus(message) {
    const statusEl = $('.save-status');
    
    if (statusEl.length === 0) {
      $('.app-header').append('<div class="save-status"></div>');
    }
    
    $('.save-status').text(message).addClass('show');
    
    setTimeout(() => {
      $('.save-status').removeClass('show');
    }, 2000);
  }
}

// Initialize the editor when DOM is ready
$(document).ready(() => {
  new BpmnCollaborativeEditor();
});