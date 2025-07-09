import $ from 'jquery';
import { getCurrentUser, onAuthStateChange } from '../lib/supabase.js';
import { showSupabaseLoginModal } from '../components/features/auth/SupabaseLoginModal.js';
import { dbManager, updateFolder } from '../lib/database.js';
import { BpmnEditorCore } from '../components/features/bpmn-editor/BpmnEditorCore.js';
import { BpmnCollaborationHandler } from '../components/features/bpmn-editor/BpmnCollaborationHandler.js';
import { BpmnAutoSave } from '../components/features/bpmn-editor/BpmnAutoSave.js';
import { BpmnUIIntegration } from '../components/features/bpmn-editor/BpmnUIIntegration.js';
import { rbacManager, hasPermission, getUserRoleInProject } from '../lib/rbac.js';
import VSCodeLayout from '../components/VSCodeLayout.js';
import '../components/modals/ProjectMembersModal.js';
import Router from './Router.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 전체 애플리케이션 흐름을 관리하는 클래스
 */
export class AppManager {
  constructor() {
    this.currentUser = null;
    this.currentProject = null;
    this.currentPage = 'landing';
    this.projects = [];
    
    // 라우터 초기화
    this.router = new Router();
    
    // 페이지 요소들
    this.landingPage = document.getElementById('landing-page');
    this.dashboardPage = document.getElementById('dashboard-page');
    this.editorPage = document.getElementById('editor-page');
    
    // BPMN 에디터 모듈들
    this.bpmnEditor = null;
    this.bpmnEditorCore = null;
    this.bpmnCollaborationHandler = null;
    this.bpmnAutoSave = null;
    this.bpmnUIIntegration = null;
    
    // VS Code 스타일 레이아웃
    this.vscodeLayout = null;
    
    // 파일 트리 상태
    this.expandedFolders = new Set();
    
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
    
    // 인증 상태 확인
    await this.initializeAuth();
    
    // EventBus 이벤트 리스너 설정
    this.setupEventBusListeners();
    
    // 라우터 이벤트 리스너 설정
    this.setupRouterEventListeners();
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
  }

  async initializeAuth() {
    // 현재 사용자 확인
    this.currentUser = await getCurrentUser();
    console.log('🔐 Current user on init:', this.currentUser);
    
    // 인증 상태에 따라 페이지 표시
    if (this.currentUser) {
      console.log('✅ User found, showing dashboard');
      this.showDashboard();
    } else {
      console.log('❌ No user found, showing landing');
      this.showLanding();
    }
    
    // 인증 상태 변경 감지
    onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email);
        this.currentUser = session.user;
        this.onUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        console.log('❌ User signed out');
        this.currentUser = null;
        this.onUserSignedOut();
      }
    });
  }

  /**
   * EventBus 이벤트 리스너 설정
   */
  setupEventBusListeners() {
    // 인증 관련 이벤트
    eventBus.on(eventBus.EVENTS.AUTH_LOGIN, (data) => {
      console.log('🔐 User logged in via EventBus:', data.user?.email);
      this.handleUserLogin(data.user);
    });

    eventBus.on(eventBus.EVENTS.AUTH_LOGOUT, () => {
      console.log('🚪 User logged out via EventBus');
      this.handleUserLogout();
    });

    // 프로젝트 관련 이벤트
    eventBus.on(eventBus.EVENTS.PROJECT_CREATED, (data) => {
      console.log('✨ Project created via EventBus:', data.project.name);
      this.handleProjectCreated(data.project);
    });

    eventBus.on(eventBus.EVENTS.PROJECT_UPDATED, (data) => {
      console.log('📝 Project updated via EventBus:', data.projectId);
      this.handleProjectUpdated(data);
    });

    eventBus.on(eventBus.EVENTS.PROJECT_DELETED, (data) => {
      console.log('🗑️ Project deleted via EventBus:', data.projectId);
      this.handleProjectDeleted(data.projectId);
    });

    eventBus.on(eventBus.EVENTS.PROJECT_SELECTED, (data) => {
      console.log('📂 Project selected via EventBus:', data.project.name);
      this.handleProjectSelected(data.project);
    });

    // 다이어그램 관련 이벤트
    eventBus.on(eventBus.EVENTS.DIAGRAM_CREATED, (data) => {
      console.log('📄 Diagram created via EventBus:', data.diagram.name);
      this.handleDiagramCreated(data.diagram);
    });

    eventBus.on(eventBus.EVENTS.DIAGRAM_OPENED, (data) => {
      console.log('📖 Diagram opened via EventBus:', data.diagram.name);
      this.handleDiagramOpened(data.diagram);
    });

    eventBus.on(eventBus.EVENTS.DIAGRAM_CLOSED, (data) => {
      console.log('📚 Diagram closed via EventBus:', data.diagram?.name);
      this.handleDiagramClosed(data.diagram);
    });

    eventBus.on(eventBus.EVENTS.DIAGRAM_UPDATED, (data) => {
      console.log('📝 Diagram updated via EventBus:', data.diagramId);
      this.handleDiagramUpdated(data);
    });

    eventBus.on(eventBus.EVENTS.DIAGRAM_DELETED, (data) => {
      console.log('🗑️ Diagram deleted via EventBus:', data.diagramId);
      this.handleDiagramDeleted(data.diagramId);
    });

    // 폴더 관련 이벤트
    eventBus.on(eventBus.EVENTS.FOLDER_CREATED, (data) => {
      console.log('📁 Folder created via EventBus:', data.folder.name);
      this.handleFolderCreated(data.folder);
    });

    eventBus.on(eventBus.EVENTS.FOLDER_UPDATED, (data) => {
      console.log('📝 Folder updated via EventBus:', data.folderId);
      this.handleFolderUpdated(data);
    });

    eventBus.on(eventBus.EVENTS.FOLDER_DELETED, (data) => {
      console.log('🗑️ Folder deleted via EventBus:', data.folderId);
      this.handleFolderDeleted(data.folderId);
    });

    // UI 관련 이벤트
    eventBus.on(eventBus.EVENTS.UI_PAGE_CHANGED, (data) => {
      console.log('📱 Page changed via EventBus:', data.from, '→', data.to);
      this.handlePageChanged(data);
    });

    // 알림 이벤트
    eventBus.on(eventBus.EVENTS.NOTIFICATION_SHOW, (data) => {
      this.showNotification(data.message, data.type || 'info');
    });

    // 에러 이벤트
    eventBus.on(eventBus.EVENTS.ERROR_OCCURRED, (data) => {
      console.error('💥 Error occurred via EventBus:', data);
      this.handleError(data);
    });

    console.log('🚌 EventBus listeners setup completed');
  }

  /**
   * 라우터 이벤트 리스너 설정
   */
  setupRouterEventListeners() {
    // 라우트 변경 전 이벤트
    this.router.on('beforeNavigate', (data, respond) => {
      console.log('🔄 Route change requested:', data.from.page, '→', data.to.page);
      
      // 에디터 페이지에서 나갈 때 저장 확인 등의 로직을 추가할 수 있음
      if (data.from.page === 'editor' && this.bpmnEditor) {
        // 향후 확장: 저장되지 않은 변경사항 확인
        // const hasUnsavedChanges = this.bpmnEditor.hasUnsavedChanges();
        // if (hasUnsavedChanges) {
        //   const shouldContinue = confirm('저장되지 않은 변경사항이 있습니다. 정말로 나가시겠습니까?');
        //   respond(shouldContinue);
        //   return;
        // }
      }
      
      respond(true); // 기본적으로 허용
    });

    // 라우트 변경 완료 이벤트
    this.router.on('routeChanged', (data) => {
      console.log('✅ Route changed:', data.from.page, '→', data.to.page);
      this.currentPage = data.to.page;
      
      // 페이지별 추가 처리
      this.handleRouteChanged(data);
    });

    // 페이지 준비 이벤트들
    this.router.on('prepareLanding', (data) => {
      this.prepareLandingPage(data.params, data.options);
    });

    this.router.on('prepareDashboard', (data) => {
      this.prepareDashboardPage(data.params, data.options);
    });

    this.router.on('prepareEditor', (data) => {
      this.prepareEditorPage(data.params, data.options);
    });

    // 페이지 정리 이벤트들
    this.router.on('cleanupLanding', (data) => {
      this.cleanupLandingPage(data.options);
    });

    this.router.on('cleanupDashboard', (data) => {
      this.cleanupDashboardPage(data.options);
    });

    this.router.on('cleanupEditor', (data) => {
      this.cleanupEditorPage(data.options);
    });

    console.log('🚀 Router event listeners setup completed');
  }

  /**
   * 라우트 변경 후 처리
   */
  handleRouteChanged(data) {
    // 브레드크럼 업데이트 등 공통 처리
    this.updateBreadcrumb(data.to);
    
    // 페이지별 특수 처리
    switch (data.to.page) {
      case 'dashboard':
        if (data.to.params.projectId) {
          this.loadProjectById(data.to.params.projectId);
        }
        break;
      case 'editor':
        if (data.to.params.diagramId) {
          this.openDiagramById(data.to.params.diagramId);
        }
        break;
    }
  }

  /**
   * 브레드크럼 업데이트
   */
  updateBreadcrumb(route) {
    // 향후 확장: 브레드크럼 UI 업데이트 로직
    console.log('📍 Breadcrumb update:', route);
  }

  setupEventListeners() {
    // 랜딩 페이지 이벤트
    $('#login-btn').on('click', () => {
      this.showLoginModal('login');
    });

    $('#signup-btn').on('click', () => {
      this.showLoginModal('signup');
    });

    // 대시보드 이벤트
    $('#create-project-btn').on('click', () => {
      this.showCreateProjectModal();
    });

    $('#invite-users-btn').on('click', () => {
      this.showProjectMembersModal();
    });

    $('#user-menu-btn').on('click', () => {
      this.showUserMenu();
    });

    // 에디터 페이지 이벤트
    $('#back-to-dashboard').on('click', () => {
      this.showDashboard();
    });

    // 프로젝트 카드 클릭 (동적)
    $(document).on('click', '.project-card:not(.create-project-card)', (e) => {
      const projectId = $(e.currentTarget).data('project-id');
      this.openProject(projectId);
    });

    $(document).on('click', '.create-project-card', () => {
      this.showCreateProjectModal();
    });

    // Welcome 화면에서 빠른 생성 버튼들
    $(document).on('click', '#quick-create-diagram', () => {
      this.createNewDiagram();
    });

    $(document).on('click', '#quick-create-folder', () => {
      this.createNewFolder();
    });
  }

  // 페이지 전환 메서드들 (Router 사용)
  showLanding() {
    return this.router.navigateTo('landing');
  }

  async showDashboard(params = {}) {
    console.log('📊 showDashboard called with params:', params);
    return await this.router.navigateTo('dashboard', params);
  }

  async showEditor(project) {
    // 프로젝트 설정
    this.currentProject = project;
    
    // Router를 통한 페이지 이동
    return await this.router.navigateTo('editor', { 
      projectId: project.id 
    });
  }

  // 인증 관련 메서드들
  onUserSignedIn(user) {
    console.log('🔐 User signed in:', user.email);
    console.log('📍 Current page:', this.currentPage);
    this.currentUser = user;
    
    // BPMN 에디터에 사용자 설정
    if (this.bpmnEditor) {
      this.bpmnEditor.setUser(user);
    }
    
    // 현재 페이지가 에디터인 경우 대시보드로 이동하지 않음
    if (this.currentPage !== 'editor') {
      console.log('🔄 Navigating to dashboard after login');
      this.showDashboard();
    } else {
      console.log('⏭️ User signed in but staying on editor page');
    }
  }

  onUserSignedOut() {
    console.log('User signed out event detected');
    
    // 짧은 지연 후 실제 사용자 상태를 다시 확인
    // 탭 전환 시 발생하는 임시적인 인증 상태 변경을 방지
    setTimeout(async () => {
      const { getCurrentUser } = await import('../lib/supabase.js');
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        // 실제로 로그아웃된 경우에만 처리
        console.log('✅ Confirmed user signed out - redirecting to landing');
        this.currentUser = null;
        this.currentProject = null;
        
        // BPMN 에디터에서 사용자 제거
        if (this.bpmnEditor) {
          this.bpmnEditor.setUser(null);
        }
        
        this.showLanding();
      } else {
        // 임시적인 상태 변경인 경우 무시
        console.log('⏭️ Temporary auth state change - keeping current page');
        this.currentUser = currentUser;
      }
    }, 500); // 500ms 지연으로 상태 안정화 대기
  }

  showLoginModal(mode = 'login') {
    console.log('🔐 Showing login modal, mode:', mode);
    showSupabaseLoginModal(mode, (user) => {
      console.log('✅ Login successful:', user?.email || 'no user');
      // 인증 상태 변경은 onAuthStateChange에서 처리됨
    });
  }

  showUserMenu() {
    // 간단한 사용자 메뉴
    const menu = $(`
      <div class="user-menu-dropdown">
        <div class="menu-item" onclick="window.appManager.logout()">로그아웃</div>
      </div>
    `);
    
    // 기존 메뉴 제거
    $('.user-menu-dropdown').remove();
    
    // 새 메뉴 추가
    $('.user-menu').append(menu);
    
    // 외부 클릭 시 메뉴 닫기
    $(document).one('click', (e) => {
      if (!$(e.target).closest('.user-menu').length) {
        $('.user-menu-dropdown').remove();
      }
    });
  }

  async logout() {
    const { signOut } = await import('../lib/supabase.js');
    await signOut();
  }

  // 프로젝트 관련 메서드들
  async loadProjects() {
    try {
      console.log('📊 Loading projects for user:', this.currentUser.id);
      const { data, error } = await dbManager.getUserProjects(this.currentUser.id);
      
      if (error) {
        console.error('Error loading projects:', error);
        return;
      }

      this.projects = data || [];
      console.log('📊 Projects loaded:', this.projects.length, 'projects');
      this.renderProjectsGrid();
      
    } catch (error) {
      console.error('Load projects error:', error);
    }
  }

  renderProjectsGrid() {
    console.log('🎨 Rendering projects grid, projects count:', this.projects.length);
    const grid = document.getElementById('projects-grid');
    console.log('🎨 Projects grid element found:', !!grid);
    
    // 새 프로젝트 생성 카드
    let html = `
      <div class="project-card create-project-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <h3>새 프로젝트 생성</h3>
        <p>새로운 BPMN 프로젝트를 시작하세요</p>
      </div>
    `;
    
    // 기존 프로젝트 카드들
    console.log('🎨 Rendering project cards for:', this.projects.map(p => p.name));
    this.projects.forEach(project => {
      const role = project.project_members?.[0]?.role || 'viewer';
      const roleText = {
        'owner': '소유자',
        'admin': '관리자', 
        'editor': '편집자',
        'viewer': '뷰어'
      }[role] || '뷰어';
      
      html += `
        <div class="project-card" data-project-id="${project.id}">
          <div class="project-card-header">
            <h3>${project.name}</h3>
            ${role === 'owner' || role === 'admin' ? `
              <button class="project-edit-btn" data-project-id="${project.id}" title="프로젝트 이름 수정" onclick="event.stopPropagation(); appManager.showEditProjectModal('${project.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            ` : ''}
          </div>
          <p>${project.description || '설명이 없습니다.'}</p>
          <div class="project-meta">
            <span class="role">${roleText}</span>
            <span class="date">${this.formatDate(project.updated_at)}</span>
          </div>
        </div>
      `;
    });
    
    console.log('🎨 Setting grid HTML, length:', html.length);
    if (grid) {
      grid.innerHTML = html;
    }
    
    console.log('✅ Projects grid rendered with', this.projects.length, 'projects');
  }

  async openProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      return;
    }
    
    await this.showEditor(project);
  }

  showCreateProjectModal() {
    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>새 프로젝트 생성</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="create-project-form">
              <div class="form-group">
                <label for="project-name">프로젝트 이름 *</label>
                <input type="text" id="project-name" name="name" required 
                       placeholder="프로젝트 이름을 입력하세요">
              </div>
              <div class="form-group">
                <label for="project-description">설명</label>
                <textarea id="project-description" name="description" 
                          placeholder="프로젝트 설명을 입력하세요" rows="3"></textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">생성</button>
                <button type="button" class="btn btn-secondary close-modal">취소</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    $('body').append(modalHtml);
    this.setupModalEvents();
    setTimeout(() => $('#project-name').focus(), 100);
  }

  setupModalEvents() {
    $('.modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    $('.close-btn, .close-modal').on('click', () => {
      this.closeModal();
    });

    $('#create-project-form').on('submit', async (e) => {
      e.preventDefault();
      await this.handleCreateProject();
    });
  }

  async handleCreateProject() {
    const form = $('#create-project-form');
    const name = form.find('#project-name').val().trim();
    const description = form.find('#project-description').val().trim();

    if (!name) {
      this.showNotification('프로젝트 이름을 입력해주세요.', 'error');
      return;
    }

    try {
      this.setFormLoading(true);

      
      const projectData = {
        name,
        description,
        owner_id: this.currentUser.id,
        owner_name: this.currentUser.user_metadata?.display_name || this.currentUser.email?.split('@')[0] || 'Unknown User',
        owner_email: this.currentUser.email
      };
      
      const result = await dbManager.createProject(projectData);


      if (result.error) {
        console.warn('Project creation returned error:', result.error);
        this.showNotification('프로젝트 생성 중 문제가 발생했지만 로컬에 저장되었습니다.', 'warning');
      } else if (result.data) {
        this.showNotification('프로젝트가 생성되었습니다.', 'success');
      } else {
        throw new Error('프로젝트 생성에 실패했습니다.');
      }

      await this.loadProjects();
      this.closeModal();

    } catch (error) {
      console.error('Create project error:', error);
      this.showNotification(error.message || '프로젝트 생성에 실패했습니다.', 'error');
    } finally {
      this.setFormLoading(false);
    }
  }

  showProjectMembersModal() {
    if (!this.currentProject || !this.currentUser) {
      this.showNotification('프로젝트와 사용자 정보가 필요합니다.', 'warning');
      return;
    }

    // 권한 확인
    const userRole = getUserRoleInProject(this.currentUser.id, this.currentProject.id);
    if (!hasPermission(userRole, 'members.view')) {
      this.showNotification('멤버 목록을 볼 권한이 없습니다.', 'error');
      return;
    }

    window.projectMembersModal.show(this.currentProject, this.currentUser);
  }

  async loadFileTree() {
    if (!this.currentProject) {
      const fileTree = $('#file-tree');
      fileTree.html(`
        <div class="empty-state">
          <p>프로젝트를 선택해주세요.</p>
        </div>
      `);
      return;
    }

    try {
      console.log('Loading file tree for project:', this.currentProject.id);
      
      // 프로젝트의 폴더와 다이어그램 병렬 로드
      const [foldersResult, diagramsResult] = await Promise.all([
        dbManager.getProjectFolders(this.currentProject.id).catch(err => {
          console.error('Failed to load folders:', err);
          return { data: [], error: err };
        }),
        dbManager.getProjectDiagrams(this.currentProject.id).catch(err => {
          console.error('Failed to load diagrams:', err);
          return { data: [], error: err };
        })
      ]);
      
      console.log('Folders result:', foldersResult);
      console.log('Diagrams result:', diagramsResult);
      
      // 오류가 있어도 계속 진행하되, 경고만 표시
      if (foldersResult.error || diagramsResult.error) {
        console.warn('Some data loading failed:', { 
          foldersError: foldersResult.error, 
          diagramsError: diagramsResult.error 
        });
        if (foldersResult.error && diagramsResult.error) {
          this.showNotification('일부 데이터를 불러올 수 없습니다. 로컬 모드로 진행합니다.', 'warning');
        }
      }

      this.currentProject.folders = foldersResult.data || [];
      this.currentProject.diagrams = diagramsResult.data || [];
      
      console.log(`Loaded ${this.currentProject.folders.length} folders and ${this.currentProject.diagrams.length} diagrams`);
      
      // 모든 폴더를 기본적으로 확장된 상태로 설정
      this.expandedFolders.clear();
      this.currentProject.folders.forEach(folder => {
        this.expandedFolders.add(folder.id);
      });
      
      this.renderFileTree();
      
      // 성공 로딩 확인
      console.log('✅ File tree loaded successfully');
      
    } catch (error) {
      console.error('Load file tree error:', error);
      this.showNotification('파일 트리 로드 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 파일 트리 렌더링
   */
  renderFileTree() {
    const fileTree = $('#file-tree');
    const diagrams = this.currentProject?.diagrams || [];
    
    const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
    const canCreateDiagram = hasPermission(userRole, 'diagram.create');
    const canCreateFolder = hasPermission(userRole, 'folder.create');
    
    const html = `
      <div class="file-tree-header">
        <h3>${this.currentProject.name}</h3>
        <div class="file-tree-actions">
          ${canCreateDiagram ? `
            <button class="file-tree-btn primary" id="create-diagram-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              새 다이어그램
            </button>
          ` : ''}
          ${canCreateFolder ? `
            <button class="file-tree-btn" id="create-folder-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
              </svg>
              새 폴더
            </button>
          ` : ''}
        </div>
      </div>
      <div class="file-tree-content">
        ${this.renderFileTreeItems()}
      </div>
    `;
    
    fileTree.html(html);
    
    // 이벤트 리스너 설정
    this.setupFileTreeEventListeners();
  }

  /**
   * 파일 트리 아이템들 렌더링 (계층적 구조)
   */
  renderFileTreeItems() {
    const folders = this.currentProject?.folders || [];
    const diagrams = this.currentProject?.diagrams || [];
    
    // 계층 구조 생성
    const structure = this.buildFileTreeStructure(folders, diagrams);
    
    if (structure.length === 0 && diagrams.length === 0) {
      return `
        <div class="empty-state">
          <p>파일이 없습니다.</p>
          <p style="font-size: 0.875rem; color: var(--gray-500);">새 폴더나 다이어그램을 만들어보세요.</p>
        </div>
      `;
    }
    
    return this.renderFileTreeNode(structure, 0);
  }

  /**
   * 파일 트리 구조 생성
   */
  buildFileTreeStructure(folders, diagrams) {
    // 루트 폴더들 (parent_id가 null인 폴더들)
    const rootFolders = folders.filter(folder => !folder.parent_id);
    // 루트에 있는 다이어그램들 (folder_id가 null인 다이어그램들)
    const rootDiagrams = diagrams.filter(diagram => !diagram.folder_id);
    
    const structure = [];
    
    // 루트 폴더들 추가
    rootFolders.forEach(folder => {
      structure.push({
        type: 'folder',
        data: folder,
        children: this.getChildrenForFolder(folder.id, folders, diagrams)
      });
    });
    
    // 루트 다이어그램들 추가
    rootDiagrams.forEach(diagram => {
      structure.push({
        type: 'diagram',
        data: diagram,
        children: []
      });
    });
    
    return structure;
  }

  /**
   * 특정 폴더의 하위 항목들 가져오기
   */
  getChildrenForFolder(folderId, folders, diagrams) {
    const children = [];
    
    // 하위 폴더들
    const subFolders = folders.filter(folder => folder.parent_id === folderId);
    subFolders.forEach(folder => {
      children.push({
        type: 'folder',
        data: folder,
        children: this.getChildrenForFolder(folder.id, folders, diagrams)
      });
    });
    
    // 폴더 내 다이어그램들
    const folderDiagrams = diagrams.filter(diagram => diagram.folder_id === folderId);
    folderDiagrams.forEach(diagram => {
      children.push({
        type: 'diagram',
        data: diagram,
        children: []
      });
    });
    
    return children;
  }

  /**
   * 파일 트리 노드 렌더링
   */
  renderFileTreeNode(nodes, depth = 0) {
    const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
    
    return nodes.map(node => {
      const indentClass = depth > 0 ? 'file-tree-indent' : '';
      const style = depth > 0 ? `style="margin-left: ${depth * 1.5}rem;"` : '';
      
      if (node.type === 'folder') {
        const folder = node.data;
        const hasChildren = node.children.length > 0;
        const isExpanded = this.expandedFolders.has(folder.id) || !hasChildren;
        
        return `
          <div class="file-tree-item folder ${indentClass}" 
               data-folder-id="${folder.id}" 
               data-type="folder"
               draggable="true"
               ondragstart="appManager.handleDragStart(event)"
               ondragover="appManager.handleDragOver(event)"
               ondragenter="appManager.handleDragEnter(event)"
               ondragleave="appManager.handleDragLeave(event)"
               ondrop="appManager.handleDrop(event)"
               ${style}>
            <div class="icon">
              ${hasChildren ? `
                <div class="folder-toggle" onclick="appManager.toggleFolder('${folder.id}'); event.stopPropagation();">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    ${isExpanded ? 
                      '<path d="M7 10l5 5 5-5z"/>' :  // 확장됨 (아래 화살표)
                      '<path d="M10 17l5-5-5-5v10z"/>' // 접힘 (오른쪽 화살표)
                    }
                  </svg>
                </div>
              ` : ''}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-left: ${hasChildren ? '0' : '20px'};">
                <path d="${isExpanded ? 
                  'M19 20H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h6l2 2h7a2 2 0 0 1 2 2v1H4v9l1.14-4.55a2 2 0 0 1 1.93-1.45H23l-2.5 5z' :
                  'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z'
                }"/>
              </svg>
            </div>
            <div class="name">${folder.name}</div>
            <div class="actions" onclick="event.stopPropagation()">
              ${hasPermission(userRole, 'folder.create') ? `
                <button class="action-btn" title="새 하위 폴더" onclick="appManager.createSubFolder('${folder.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2.5 7.5h-3V16h-1v-2.5h-3v-1h3V10h1v2.5h3v1z"/>
                  </svg>
                </button>
              ` : ''}
              ${hasPermission(userRole, 'diagram.create') ? `
                <button class="action-btn" title="새 다이어그램" onclick="appManager.createDiagramInFolder('${folder.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z M19,13H13V11H19V13Z"/>
                  </svg>
                </button>
              ` : ''}
              ${hasPermission(userRole, 'folder.edit') ? `
                <button class="action-btn" title="이름 변경" onclick="appManager.renameFolder('${folder.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z M9,13H16V15H9V13Z M9,16H14V18H9V16Z"/>
                  </svg>
                </button>
              ` : ''}
              ${hasPermission(userRole, 'folder.delete') ? `
                <button class="action-btn" title="삭제" onclick="appManager.deleteFolder('${folder.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
          ${isExpanded ? this.renderFileTreeNode(node.children, depth + 1) : ''}
        `;
      } else {
        const diagram = node.data;
        return `
          <div class="file-tree-item diagram-item ${indentClass}" 
               data-diagram-id="${diagram.id}" 
               data-type="diagram"
               draggable="true"
               ondragstart="appManager.handleDragStart(event)"
               ondragover="appManager.handleDragOver(event)"
               ondragenter="appManager.handleDragEnter(event)"
               ondragleave="appManager.handleDragLeave(event)"
               ondrop="appManager.handleDrop(event)"
               onclick="appManager.openDiagram('${diagram.id}')" 
               ${style}>
            <div class="icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </div>
            <div class="name">${diagram.name}</div>
            <div class="actions" onclick="event.stopPropagation()">
              <button class="action-btn" title="편집" onclick="appManager.openDiagram('${diagram.id}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              ${hasPermission(userRole, 'diagram.edit') ? `
                <button class="action-btn" title="이름 변경" onclick="appManager.renameDiagram('${diagram.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z M9,13H16V15H9V13Z M9,16H14V18H9V16Z"/>
                  </svg>
                </button>
              ` : ''}
              ${hasPermission(userRole, 'diagram.delete') ? `
                <button class="action-btn" title="삭제" onclick="appManager.deleteDiagram('${diagram.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }
    }).join('');
  }

  /**
   * 파일 트리 이벤트 리스너 설정
   */
  setupFileTreeEventListeners() {
    // 새 다이어그램 버튼
    $('#create-diagram-btn').on('click', () => {
      this.createNewDiagram();
    });

    // 새 폴더 버튼
    $('#create-folder-btn').on('click', () => {
      this.createNewFolder();
    });

    // 다이어그램 선택
    $('.file-tree-item').on('click', (e) => {
      const $item = $(e.currentTarget);
      const diagramId = $item.data('diagram-id');
      const folderId = $item.data('folder-id');
      
      if (diagramId) {
        this.openDiagram(diagramId);
      } else if (folderId && $item.hasClass('folder')) {
        // 폴더 확장/접기
        this.toggleFolder(folderId);
      }
    });
  }

  /**
   * 폴더 확장/접기 토글
   */
  toggleFolder(folderId) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    this.renderFileTree();
  }

  /**
   * 다이어그램 열기 메소드 추가
   */
  async openDiagram(diagramId) {
    console.log('🔍 Opening diagram:', diagramId);
    console.log('📋 Available diagrams:', this.currentProject?.diagrams);
    
    const diagram = this.currentProject?.diagrams?.find(d => d.id === diagramId);
    if (!diagram) {
      console.error('❌ Diagram not found in current project');
      this.showNotification('다이어그램을 찾을 수 없습니다.', 'error');
      return;
    }

    console.log('✅ Found diagram:', diagram);

    // BPMN 에디터가 없으면 먼저 초기화
    if (!this.bpmnEditor) {
      console.log('⚠️ BPMN Editor not initialized, initializing now...');
      const success = await this.initializeBpmnEditor();
      if (!success) {
        this.showNotification('BPMN 에디터를 초기화할 수 없습니다.', 'error');
        return;
      }
    }
    
    // BPMN 에디터로 다이어그램 열기 (서버에서 문서 요청)
    const diagramData = {
      id: diagram.id,
      diagramId: diagram.id,
      name: diagram.name,
      title: diagram.name
    };

    console.log('🚀 Opening diagram with data:', diagramData);
    
    try {
      await this.bpmnEditor.openDiagram(diagramData);
      
      // 활성 항목 표시
      $('.file-tree-item').removeClass('active');
      $(`.file-tree-item[data-diagram-id="${diagramId}"]`).addClass('active');
      
      this.showNotification(`${diagram.name}을 열었습니다.`, 'success');
    } catch (error) {
      console.error('Open diagram error:', error);
      this.showNotification('다이어그램을 여는데 실패했습니다.', 'error');
    }
  }

  /**
   * 다이어그램 삭제
   */
  async deleteDiagram(diagramId) {
    const diagram = this.currentProject?.diagrams?.find(d => d.id === diagramId);
    if (!diagram) {
      this.showNotification('다이어그램을 찾을 수 없습니다.', 'error');
      return;
    }

    const confirmed = confirm(`"${diagram.name}" 다이어그램을 삭제하시겠습니까?`);
    if (!confirmed) return;

    try {
      const result = await dbManager.deleteDiagram(diagramId);
      
      if (result.error) {
        this.showNotification('삭제에 실패했습니다.', 'error');
        return;
      }

      // 로컬 상태 업데이트
      this.currentProject.diagrams = this.currentProject.diagrams.filter(d => d.id !== diagramId);
      this.renderFileTree();
      
      this.showNotification('다이어그램이 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('Delete diagram error:', error);
      this.showNotification('삭제 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 하위 폴더 생성
   */
  async createSubFolder(parentId) {
    if (!this.currentProject) {
      this.showNotification('프로젝트를 먼저 선택해주세요.', 'warning');
      return;
    }

    const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
    if (!hasPermission(userRole, 'folder.create')) {
      this.showNotification('폴더를 생성할 권한이 없습니다.', 'error');
      return;
    }

    const name = prompt('새 하위 폴더 이름을 입력하세요:', '새 폴더');
    if (!name || !name.trim()) return;

    try {
      const folderData = {
        project_id: this.currentProject.id,
        parent_id: parentId,
        name: name.trim(),
        created_by: this.currentUser?.id || 'anonymous'
      };

      console.log('Creating sub folder with data:', folderData);
      const result = await dbManager.createFolder(folderData);
      
      if (result.error) {
        console.error('Sub folder creation failed:', result.error);
        this.showNotification(`하위 폴더 생성에 실패했습니다: ${result.error.message || result.error}`, 'error');
        return;
      }

      // 로컬 상태 업데이트
      if (result.data) {
        this.currentProject.folders = this.currentProject.folders || [];
        this.currentProject.folders.push(result.data);
        
        // 부모 폴더를 확장된 상태로 설정
        this.expandedFolders.add(parentId);
        this.expandedFolders.add(result.data.id);
        
        this.renderFileTree();
        this.showNotification('하위 폴더가 생성되었습니다.', 'success');
        
        console.log('✅ Sub folder added to UI:', result.data);
      }
    } catch (error) {
      console.error('Create sub folder error:', error);
      this.showNotification('하위 폴더 생성 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 새 폴더 생성 (루트)
   */
  async createNewFolder() {
    if (!this.currentProject) {
      this.showNotification('프로젝트를 먼저 선택해주세요.', 'warning');
      return;
    }

    console.log('🚀 AppManager: Current user for folder creation:', this.currentUser);
    console.log('🚀 AppManager: Current project for folder creation:', this.currentProject);

    const name = prompt('새 폴더 이름을 입력하세요:', '새 폴더');
    if (!name || !name.trim()) return;

    try {
      const folderData = {
        project_id: this.currentProject.id,
        parent_id: null, // 루트 폴더로 생성
        name: name.trim(),
        created_by: this.currentUser?.id || 'anonymous'
      };

      console.log('🚀 AppManager: Creating folder with data:', folderData);
      const result = await dbManager.createFolder(folderData);
      console.log('🚀 AppManager: Folder creation result:', result);
      
      if (result.error) {
        console.error('Folder creation failed:', result.error);
        this.showNotification(`폴더 생성에 실패했습니다: ${result.error.message || result.error}`, 'error');
        return;
      }

      // 로컬 상태 업데이트
      if (result.data) {
        this.currentProject.folders = this.currentProject.folders || [];
        this.currentProject.folders.push(result.data);
        
        // 새로 생성된 폴더를 확장된 상태로 설정
        this.expandedFolders.add(result.data.id);
        
        this.renderFileTree();
        this.showNotification('폴더가 생성되었습니다.', 'success');
        
        console.log('✅ Folder added to UI:', result.data);
      } else {
        console.error('No data returned from folder creation');
        this.showNotification('폴더 생성 후 데이터 업데이트에 실패했습니다.', 'warning');
      }
    } catch (error) {
      console.error('Create folder error:', error);
      this.showNotification('폴더 생성 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 폴더 삭제
   */
  async deleteFolder(folderId) {
    const folder = this.currentProject?.folders?.find(f => f.id === folderId);
    if (!folder) {
      this.showNotification('폴더를 찾을 수 없습니다.', 'error');
      return;
    }

    // 하위 폴더나 다이어그램이 있는지 확인
    const hasSubFolders = this.currentProject.folders.some(f => f.parent_id === folderId);
    const hasDiagrams = this.currentProject.diagrams.some(d => d.folder_id === folderId);
    
    if (hasSubFolders || hasDiagrams) {
      const confirmed = confirm(`"${folder.name}" 폴더에 파일이 있습니다. 폴더와 모든 내용을 삭제하시겠습니까?`);
      if (!confirmed) return;
    } else {
      const confirmed = confirm(`"${folder.name}" 폴더를 삭제하시겠습니까?`);
      if (!confirmed) return;
    }

    try {
      const result = await dbManager.deleteFolder(folderId);
      
      if (result.error) {
        this.showNotification('폴더 삭제에 실패했습니다.', 'error');
        return;
      }

      // 로컬 상태 업데이트
      this.currentProject.folders = this.currentProject.folders.filter(f => f.id !== folderId);
      this.renderFileTree();
      
      this.showNotification('폴더가 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('Delete folder error:', error);
      this.showNotification('폴더 삭제 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 폴더 이름 변경
   */
  async renameFolder(folderId) {
    const folder = this.currentProject?.folders?.find(f => f.id === folderId);
    if (!folder) {
      this.showNotification('폴더를 찾을 수 없습니다.', 'error');
      return;
    }

    const newName = prompt('새 폴더 이름을 입력하세요:', folder.name);
    if (!newName || !newName.trim() || newName.trim() === folder.name) return;

    try {
      const result = await dbManager.renameFolder(folderId, newName.trim());
      
      if (result.error) {
        this.showNotification('폴더 이름 변경에 실패했습니다.', 'error');
        return;
      }

      // 로컬 상태 업데이트
      const folderIndex = this.currentProject.folders.findIndex(f => f.id === folderId);
      if (folderIndex !== -1) {
        this.currentProject.folders[folderIndex].name = newName.trim();
        this.renderFileTree();
        this.showNotification('폴더 이름이 변경되었습니다.', 'success');
      }
    } catch (error) {
      console.error('Rename folder error:', error);
      this.showNotification('폴더 이름 변경 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 폴더 내에 다이어그램 생성
   */
  async createDiagramInFolder(folderId) {
    if (!this.currentProject) {
      this.showNotification('프로젝트를 먼저 선택해주세요.', 'warning');
      return;
    }

    const name = prompt('새 다이어그램 이름을 입력하세요:', '새 다이어그램');
    if (!name || !name.trim()) return;

    try {
      const diagramData = {
        project_id: this.currentProject.id,
        folder_id: folderId,
        name: name.trim(),
        description: '',
        created_by: this.currentUser?.id
      };

      const result = await dbManager.createDiagram(diagramData);
      
      if (result.error) {
        this.showNotification('다이어그램 생성에 실패했습니다.', 'error');
        return;
      }

      // 로컬 상태 업데이트
      this.currentProject.diagrams = this.currentProject.diagrams || [];
      this.currentProject.diagrams.push(result.data);
      this.renderFileTree();
      
      this.showNotification('다이어그램이 생성되었습니다.', 'success');
    } catch (error) {
      console.error('Create diagram in folder error:', error);
      this.showNotification('다이어그램 생성 중 오류가 발생했습니다.', 'error');
    }
  }

  // 데이터베이스 관련 메서드들
  async testDatabaseConnection() {
    try {
      const isConnected = await dbManager.testConnection();
      
      if (isConnected) {
        this.showNotification('데이터베이스 연결 성공', 'success');
      } else {
        this.showNotification('로컬 스토리지 모드로 실행 중', 'info');
      }
    } catch (error) {
      console.error('Database connection test error:', error);
      this.showNotification('데이터베이스 연결 실패 - 로컬 모드 사용', 'warning');
    }
  }

  // VS Code 스타일 레이아웃 초기화
  async initializeVSCodeLayout() {
    try {
      
      // VS Code 레이아웃이 이미 있으면 재사용
      if (this.vscodeLayout) {
        return true;
      }
      
      // VS Code 레이아웃 컨테이너 찾기 - 에디터 페이지 내에서 교체
      const editorPage = document.querySelector('#editor-page');
      if (!editorPage) {
        console.error('❌ Editor page not found');
        return false;
      }
      
      // 기존 에디터 레이아웃을 숨기고 VS Code 레이아웃으로 교체
      const editorLayout = editorPage.querySelector('.editor-layout');
      if (editorLayout) {
        editorLayout.style.display = 'none';
      }
      
      // 에디터 페이지를 relative positioning으로 설정
      editorPage.style.position = 'relative';
      
      // VS Code 레이아웃용 컨테이너 생성
      let vscodeContainer = document.querySelector('#vscode-layout-container');
      if (!vscodeContainer) {
        vscodeContainer = document.createElement('div');
        vscodeContainer.id = 'vscode-layout-container';
        // 에디터 페이지에 직접 추가
        editorPage.appendChild(vscodeContainer);
      }
      
      // 스타일 적용 (display: flex 제거)
      vscodeContainer.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;';
      
      // VS Code 레이아웃 생성
      this.vscodeLayout = new VSCodeLayout(vscodeContainer);
      
      // 전역 변수로 설정 (BpmnEditor에서 접근하기 위해)
      window.vscodeLayout = this.vscodeLayout;
      
      // BPMN 에디터와 통합 설정
      if (this.bpmnEditor) {
        await this.vscodeLayout.integrateBPMNEditor(this.bpmnEditor);
      }
      
      return true;
    } catch (error) {
      this.showNotification('VS Code 레이아웃 초기화에 실패했습니다.', 'error');
      return false;
    }
  }

  // 프로젝트 데이터 로드
  async loadProjectData() {
    if (!this.currentProject) {
      console.warn('❌ No current project to load data for');
      return;
    }

    try {
      
      // 프로젝트의 폴더와 다이어그램 병렬 로드
      const [foldersResult, diagramsResult] = await Promise.all([
        dbManager.getProjectFolders(this.currentProject.id).catch(err => {
          console.error('Failed to load folders:', err);
          return { data: [], error: err };
        }),
        dbManager.getProjectDiagrams(this.currentProject.id).catch(err => {
          console.error('Failed to load diagrams:', err);
          return { data: [], error: err };
        })
      ]);
      
      // 프로젝트 객체에 데이터 저장
      this.currentProject.folders = foldersResult.data || [];
      this.currentProject.diagrams = diagramsResult.data || [];
      
      console.log(`✅ Loaded ${this.currentProject.folders.length} folders and ${this.currentProject.diagrams.length} diagrams`);
      
    } catch (error) {
      console.error('❌ Failed to load project data:', error);
      this.currentProject.folders = [];
      this.currentProject.diagrams = [];
    }
  }

  // BPMN 에디터 관련 메서드들
  async initializeBpmnEditor() {
    try {
      console.log('🔧 Initializing BPMN Editor...');
      
      if (!this.bpmnEditorCore) {
        // 모듈형 BPMN 에디터 초기화
        this.bpmnEditorCore = new BpmnEditorCore();
        this.bpmnCollaborationHandler = new BpmnCollaborationHandler(this.bpmnEditorCore);
        this.bpmnAutoSave = new BpmnAutoSave(this.bpmnEditorCore);
        this.bpmnUIIntegration = new BpmnUIIntegration(this.bpmnEditorCore);
        
        // 레거시 호환성을 위한 래퍼 객체 생성
        this.bpmnEditor = {
          editorCore: this.bpmnEditorCore,
          collaborationHandler: this.bpmnCollaborationHandler,
          autoSave: this.bpmnAutoSave,
          uiIntegration: this.bpmnUIIntegration,
          
          // 주요 메서드들을 래핑
          async initializeWhenReady() {
            return await this.editorCore.initializeWhenReady();
          },
          async openDiagram(diagramData) {
            return await this.editorCore.openDiagram(diagramData);
          },
          async closeDiagram() {
            return await this.editorCore.closeDiagram();
          },
          async createNewDiagram() {
            return await this.editorCore.createNewDiagram();
          },
          async exportDiagram() {
            return await this.editorCore.exportDiagram();
          },
          getCurrentDiagram() {
            return this.editorCore.getCurrentDiagram();
          },
          getModeler() {
            return this.editorCore.getModeler();
          },
          async setUser(user) {
            await this.collaborationHandler.setUser(user);
            this.uiIntegration.setCurrentUser(user);
          },
          async setProject(project) {
            await this.collaborationHandler.setProject(project);
            this.uiIntegration.setCurrentProject(project);
          },
          async moveToContainer(containerSelector) {
            return await this.editorCore.moveToContainer(containerSelector);
          },
          isConnectedToServer() {
            return this.collaborationHandler.isConnectedToServer();
          },
          getConnectedUsers() {
            return this.collaborationHandler.getConnectedUsers();
          },
          disconnect() {
            this.collaborationHandler.disconnect();
          },
          destroy() {
            this.editorCore.destroy();
            this.collaborationHandler.destroy();
            this.autoSave.destroy();
            this.uiIntegration.destroy();
          }
        };
        
        console.log('✅ BPMN Editor modules created (not initialized yet - waiting for document selection)');
        
        // 전역 변수로 설정 (협업 모듈에서 접근하기 위해)
        window.bpmnEditor = this.bpmnEditor;
        window.bpmnEditorCore = this.bpmnEditorCore;
      }
      
      // 현재 사용자 설정
      if (this.currentUser) {
        await this.bpmnEditor.setUser(this.currentUser);
        console.log('✅ User set in BPMN Editor:', this.currentUser.email);
      }
      
      // 현재 프로젝트 설정
      if (this.currentProject) {
        try {
          await this.bpmnEditor.setProject(this.currentProject);
          console.log('✅ Project set in BPMN Editor:', this.currentProject.name);
        } catch (error) {
          console.warn('⚠️ 프로젝트 설정 중 협업 모듈 오류 발생, 에디터는 계속 작동합니다:', error);
        }
      }
      
      // VS Code 레이아웃과 통합
      if (this.vscodeLayout) {
        await this.vscodeLayout.integrateBPMNEditor(this.bpmnEditor);
      }
      
      console.log('🎉 BPMN Editor fully initialized');
      return true;
    } catch (error) {
      console.error('❌ BPMN Editor initialization failed:', error);
      this.showNotification('BPMN 에디터 초기화에 실패했습니다.', 'error');
      return false;
    }
  }

  async createNewDiagram() {
    if (!this.currentProject) {
      this.showNotification('프로젝트를 먼저 선택해주세요.', 'warning');
      return;
    }

    console.log('🚀 AppManager: Creating new diagram...');
    console.log('🚀 AppManager: Current project:', this.currentProject);
    console.log('🚀 AppManager: Current user:', this.currentUser);

    const name = prompt('새 다이어그램 이름을 입력하세요:', '새 다이어그램');
    if (!name || !name.trim()) return;

    try {
      const diagramData = {
        project_id: this.currentProject.id,
        name: name.trim(),
        description: '',
        bpmn_xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" targetNamespace="http://bpmn.io/schema/bpmn" id="Definitions_1">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds height="36.0" width="36.0" x="173.0" y="102.0" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
        created_by: this.currentUser.id
      };

      console.log('🚀 AppManager: Diagram data to be created:', diagramData);
      const result = await dbManager.createDiagram(diagramData);
      console.log('🚀 AppManager: Diagram creation result:', result);

      if (result.error) {
        console.error('Error creating diagram:', result.error);
        this.showNotification('다이어그램 생성 중 오류가 발생했습니다.', 'error');
        return;
      }

      const { data, error } = result;

      // 파일 트리 새로고침
      await this.loadFileTree();
      
      // 새로 생성된 다이어그램 열기
      if (data) {
        await this.openDiagramById(data.id);
      }
      
      this.showNotification('다이어그램이 생성되었습니다.', 'success');

    } catch (error) {
      console.error('Create diagram error:', error);
      this.showNotification('다이어그램 생성에 실패했습니다.', 'error');
    }
  }

  async openDiagramById(diagramId) {
    try {
      const diagram = this.currentProject.diagrams?.find(d => d.id === diagramId);
      if (!diagram) {
        console.error('Diagram not found:', diagramId);
        this.showNotification('다이어그램을 찾을 수 없습니다.', 'error');
        return;
      }

      // BPMN 에디터는 VSCodeLayout에서 처리 (지연 초기화)
      // if (!this.bpmnEditor) {
      //   this.initializeBpmnEditor();
      // }
      
      // 다이어그램 열기
      await this.bpmnEditor.openDiagram({
        id: diagram.id,
        name: diagram.name,
        content: diagram.bpmn_xml
      });
      
      console.log('Opened diagram:', diagram.name);
      
    } catch (error) {
      console.error('Open diagram error:', error);
      this.showNotification('다이어그램을 열 수 없습니다.', 'error');
    }
  }

  async renameDiagram(diagramId) {
    try {
      const diagram = this.currentProject.diagrams?.find(d => d.id === diagramId);
      if (!diagram) return;

      const newName = prompt('새 이름을 입력하세요:', diagram.name);
      if (!newName || !newName.trim() || newName.trim() === diagram.name) return;

      const { data, error } = await dbManager.updateDiagram(diagramId, {
        name: newName.trim(),
        last_modified_by: this.currentUser.id
      });

      if (error) {
        console.error('Error renaming diagram:', error);
        this.showNotification('이름 변경 중 오류가 발생했습니다.', 'error');
        return;
      }

      // 파일 트리 새로고침
      await this.loadFileTree();
      this.showNotification('다이어그램 이름이 변경되었습니다.', 'success');

    } catch (error) {
      console.error('Rename diagram error:', error);
      this.showNotification('이름 변경에 실패했습니다.', 'error');
    }
  }

  async deleteDiagram(diagramId) {
    try {
      const diagram = this.currentProject.diagrams?.find(d => d.id === diagramId);
      if (!diagram) return;

      if (!confirm(`'${diagram.name}' 다이어그램을 삭제하시겠습니까?`)) return;

      const { data, error } = await dbManager.updateDiagram(diagramId, {
        is_active: false,
        last_modified_by: this.currentUser.id
      });

      if (error) {
        console.error('Error deleting diagram:', error);
        this.showNotification('삭제 중 오류가 발생했습니다.', 'error');
        return;
      }

      // 파일 트리 새로고침
      await this.loadFileTree();
      this.showNotification('다이어그램이 삭제되었습니다.', 'success');

    } catch (error) {
      console.error('Delete diagram error:', error);
      this.showNotification('삭제에 실패했습니다.', 'error');
    }
  }

  openNewDiagram() {
    // 새 다이어그램은 VSCodeLayout에서 처리 (지연 초기화)
    console.log('📄 Creating new diagram via VSCodeLayout...');
    if (this.vscodeLayout) {
      // VSCodeLayout의 새 다이어그램 생성 기능 호출
      // this.vscodeLayout.createNewDiagram();
    }
  }

  // 이 메서드는 위의 async openDiagram과 중복되므로 제거
  // openDiagram은 async 버전만 사용

  // 드래그 앤 드롭 관련 메서드들
  
  /**
   * 드래그 시작 핸들러
   */
  handleDragStart(event) {
    const item = event.target.closest('.file-tree-item');
    if (!item) return;

    const type = item.dataset.type;
    const id = type === 'folder' ? item.dataset.folderId : item.dataset.diagramId;
    
    // 권한 확인
    const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
    if (type === 'folder' && !hasPermission(userRole, 'folder.edit')) {
      event.preventDefault();
      return;
    }
    if (type === 'diagram' && !hasPermission(userRole, 'diagram.edit')) {
      event.preventDefault();
      return;
    }

    const dragData = {
      type: type,
      id: id,
      name: item.querySelector('.name').textContent
    };

    event.dataTransfer.setData('text/json', JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'move';
    
    // 드래그 중인 아이템 스타일링
    item.style.opacity = '0.5';
    item.classList.add('dragging');
    
    console.log('🎯 Drag started:', dragData);
  }

  /**
   * 드래그 오버 핸들러
   */
  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  /**
   * 드래그 엔터 핸들러
   */
  handleDragEnter(event) {
    event.preventDefault();
    const item = event.target.closest('.file-tree-item');
    if (!item || !item.classList.contains('folder')) return;

    item.classList.add('drag-over');
  }

  /**
   * 드래그 리브 핸들러
   */
  handleDragLeave(event) {
    const item = event.target.closest('.file-tree-item');
    if (!item) return;

    // 진짜로 아이템을 벗어났는지 확인
    const rect = item.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      item.classList.remove('drag-over');
    }
  }

  /**
   * 드롭 핸들러
   */
  async handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const targetItem = event.target.closest('.file-tree-item');
    if (!targetItem) return;

    // 드래그 스타일 정리
    document.querySelectorAll('.file-tree-item').forEach(item => {
      item.style.opacity = '';
      item.classList.remove('dragging', 'drag-over');
    });

    try {
      const dragData = JSON.parse(event.dataTransfer.getData('text/json'));
      console.log('📥 Drop received:', dragData);

      // 폴더에만 드롭 가능
      if (!targetItem.classList.contains('folder')) {
        this.showNotification('폴더에만 이동할 수 있습니다.', 'warning');
        return;
      }

      const targetFolderId = targetItem.dataset.folderId;
      
      // 자기 자신에게 드롭하는 경우 무시
      if (dragData.type === 'folder' && dragData.id === targetFolderId) {
        return;
      }

      // 권한 확인
      const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
      if (dragData.type === 'folder' && !hasPermission(userRole, 'folder.edit')) {
        this.showNotification('폴더를 이동할 권한이 없습니다.', 'error');
        return;
      }
      if (dragData.type === 'diagram' && !hasPermission(userRole, 'diagram.edit')) {
        this.showNotification('다이어그램을 이동할 권한이 없습니다.', 'error');
        return;
      }

      // 순환 참조 방지 (폴더를 자신의 하위 폴더로 이동하는 경우)
      if (dragData.type === 'folder' && await this.isDescendantFolder(dragData.id, targetFolderId)) {
        this.showNotification('폴더를 자신의 하위 폴더로 이동할 수 없습니다.', 'error');
        return;
      }

      // 이동 실행
      const success = await this.moveItem(dragData.type, dragData.id, targetFolderId);
      
      if (success) {
        // 대상 폴더 확장
        this.expandedFolders.add(targetFolderId);
        this.renderFileTree();
        this.showNotification(`${dragData.name}이(가) 이동되었습니다.`, 'success');
      }

    } catch (error) {
      console.error('Drop error:', error);
      this.showNotification('이동 중 오류가 발생했습니다.', 'error');
    }
  }

  /**
   * 폴더가 다른 폴더의 하위인지 확인
   */
  async isDescendantFolder(folderId, ancestorId) {
    const folders = this.currentProject?.folders || [];
    
    const checkDescendant = (currentId) => {
      const folder = folders.find(f => f.id === currentId);
      if (!folder || !folder.parent_id) return false;
      if (folder.parent_id === ancestorId) return true;
      return checkDescendant(folder.parent_id);
    };
    
    return checkDescendant(folderId);
  }

  /**
   * 아이템 이동 (폴더 또는 다이어그램)
   */
  async moveItem(type, itemId, targetFolderId) {
    try {
      if (type === 'folder') {
        // 폴더 이동
        const result = await dbManager.updateFolder(itemId, {
          parent_id: targetFolderId
        });
        
        if (result.error) {
          console.error('Folder move failed:', result.error);
          return false;
        }

        // 로컬 상태 업데이트
        const folderIndex = this.currentProject.folders.findIndex(f => f.id === itemId);
        if (folderIndex !== -1) {
          this.currentProject.folders[folderIndex].parent_id = targetFolderId;
        }
        
      } else if (type === 'diagram') {
        // 다이어그램 이동
        const result = await dbManager.updateDiagram(itemId, {
          folder_id: targetFolderId,
          last_modified_by: this.currentUser?.id
        });
        
        if (result.error) {
          console.error('Diagram move failed:', result.error);
          return false;
        }

        // 로컬 상태 업데이트
        const diagramIndex = this.currentProject.diagrams.findIndex(d => d.id === itemId);
        if (diagramIndex !== -1) {
          this.currentProject.diagrams[diagramIndex].folder_id = targetFolderId;
        }
      }

      return true;
    } catch (error) {
      console.error('Move item error:', error);
      return false;
    }
  }

  // 유틸리티 메서드들
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  }

  setFormLoading(loading) {
    const submitBtn = $('#create-project-form button[type="submit"]');
    const inputs = $('#create-project-form input, #create-project-form textarea');
    
    if (loading) {
      submitBtn.prop('disabled', true).text('생성 중...');
      inputs.prop('disabled', true);
    } else {
      submitBtn.prop('disabled', false).text('생성');
      inputs.prop('disabled', false);
    }
  }

  showNotification(message, type = 'info') {
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

  closeModal() {
    $('.modal-overlay').fadeOut(() => {
      $('.modal-overlay').remove();
    });
  }

  /**
   * 프로젝트 수정 모달 표시
   */
  showEditProjectModal(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      this.showNotification('프로젝트를 찾을 수 없습니다.', 'error');
      return;
    }

    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>프로젝트 수정</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="edit-project-form">
              <div class="form-group">
                <label for="edit-project-name">프로젝트 이름 *</label>
                <input type="text" id="edit-project-name" name="name" required 
                       value="${project.name}" placeholder="프로젝트 이름을 입력하세요">
              </div>
              <div class="form-group">
                <label for="edit-project-description">설명</label>
                <textarea id="edit-project-description" name="description" 
                          placeholder="프로젝트 설명을 입력하세요" rows="3">${project.description || ''}</textarea>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="appManager.closeModal()">취소</button>
                <button type="submit" class="btn btn-primary">수정</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    $('body').append(modalHtml);

    // 이벤트 리스너 설정
    $('.close-btn').on('click', () => this.closeModal());
    $('.modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    // 폼 제출 처리
    $('#edit-project-form').on('submit', (e) => {
      e.preventDefault();
      this.handleEditProject(projectId);
    });

    // 첫 번째 입력 필드에 포커스
    $('#edit-project-name').focus().select();
  }

  /**
   * 프로젝트 수정 처리
   */
  async handleEditProject(projectId) {
    try {
      this.setFormLoading(true);

      const formData = new FormData(document.getElementById('edit-project-form'));
      const name = formData.get('name')?.trim();
      const description = formData.get('description')?.trim();

      if (!name) {
        this.showNotification('프로젝트 이름을 입력해주세요.', 'error');
        return;
      }

      // 프로젝트 업데이트
      const updateData = {
        name,
        description
      };

      console.log('🔄 프로젝트 업데이트:', updateData);
      const result = await dbManager.updateProject(projectId, updateData);

      if (result.error) {
        console.warn('프로젝트 업데이트 중 오류:', result.error);
        this.showNotification('프로젝트 수정 중 문제가 발생했습니다.', 'warning');
      } else {
        this.showNotification('프로젝트가 수정되었습니다.', 'success');
      }

      // 프로젝트 목록 새로고침
      await this.loadProjects();
      this.closeModal();

    } catch (error) {
      console.error('프로젝트 수정 오류:', error);
      this.showNotification(error.message || '프로젝트 수정에 실패했습니다.', 'error');
    } finally {
      this.setFormLoading(false);
    }
  }

  // ==================== Router 관련 메서드들 ====================

  /**
   * 페이지 이동 (Router 사용)
   */
  async navigateToPage(page, params = {}, options = {}) {
    return await this.router.navigateTo(page, params, options);
  }

  /**
   * 랜딩 페이지 준비
   */
  prepareLandingPage(params, options) {
    console.log('🏠 Preparing landing page');
    // 랜딩 페이지 특별한 준비 작업이 있다면 여기서
  }

  /**
   * 대시보드 페이지 준비
   */
  async prepareDashboardPage(params, options) {
    console.log('📊 Preparing dashboard page');
    console.log('👤 Current user:', this.currentUser?.email || 'none');
    
    // 사용자 로그인 확인
    if (!this.currentUser) {
      console.log('❌ User not logged in, redirecting to landing');
      await this.router.navigateTo('landing');
      return;
    }

    // 대시보드로 이동할 때 협업 세션 해제
    if (this.collaborationManager) {
      console.log('🔌 대시보드 이동으로 인한 협업 세션 해제');
      this.collaborationManager.disconnect();
    }
    
    // 사용자 이름 표시
    if (this.currentUser) {
      const displayName = this.currentUser.user_metadata?.display_name || 
                         this.currentUser.email?.split('@')[0] || 
                         '사용자';
      $('#user-name').text(displayName);
    }

    // 프로젝트 목록 로드
    await this.loadProjects();
    
    // 특정 프로젝트가 지정된 경우
    if (params.projectId) {
      await this.selectProject(params.projectId);
    }
  }

  /**
   * 에디터 페이지 준비
   */
  async prepareEditorPage(params, options) {
    console.log('✏️ Preparing editor page');
    
    // 사용자 로그인 확인
    if (!this.currentUser) {
      console.log('❌ User not logged in, redirecting to landing');
      await this.router.navigateTo('landing');
      return;
    }

    // 프로젝트 설정 (params에서 projectId가 있는 경우)
    if (params.projectId && (!this.currentProject || this.currentProject.id !== params.projectId)) {
      const project = this.projects.find(p => p.id === params.projectId);
      if (project) {
        this.currentProject = project;
      }
    }

    // 프로젝트 선택 확인
    if (!this.currentProject) {
      console.log('❌ No project selected, redirecting to dashboard');
      await this.router.navigateTo('dashboard');
      return;
    }

    // 프로젝트 이름 표시
    $('#current-project-name').text(this.currentProject.name);
    
    // 프로젝트 데이터 로드
    await this.loadProjectData();
    
    // VS Code 스타일 레이아웃 초기화
    await this.initializeVSCodeLayout();
    
    // 이전 편집 중인 에디터 내용 버리기 - 초기 화면으로 복원
    if (this.bpmnEditor) {
      console.log('🔄 이전 편집 내용 버리고 초기 화면으로 복원');
      try {
        // 에디터를 닫고 초기 상태로 복원
        await this.bpmnEditor.closeDiagram();
      } catch (error) {
        console.warn('⚠️ 이전 다이어그램 닫기 실패:', error);
      }
    }
    
    // VS Code Layout에 프로젝트 데이터 적용
    if (this.vscodeLayout) {
      await this.vscodeLayout.setupBPMNIntegration();
      
      // Explorer에 데이터 설정
      if (this.vscodeLayout.explorer && this.vscodeLayout.explorer.explorerCore) {
        const explorerCore = this.vscodeLayout.explorer.explorerCore;
        if (explorerCore.dataProvider && explorerCore.dataProvider.setProjectData) {
          console.log('🔧 Setting project data to Explorer');
          explorerCore.dataProvider.setProjectData(this.currentProject);
          explorerCore.refreshTree();
        }
      }
    } else {
      // 폴백: 기존 파일 트리 로드
      this.loadFileTree();
    }

    // BPMN 에디터 초기화 (아직 초기화되지 않은 경우)
    if (!this.bpmnEditor) {
      await this.initializeBpmnEditor();
    }

    // 특정 다이어그램이 지정된 경우
    if (params.diagramId) {
      await this.openDiagramById(params.diagramId);
    } else {
      // 다이어그램이 지정되지 않은 경우 welcome 메시지 표시
      if (this.vscodeLayout && this.vscodeLayout.layoutManager) {
        this.vscodeLayout.layoutManager.showWelcomeMessage();
        console.log('📄 Welcome message displayed');
      }
    }
  }

  /**
   * 랜딩 페이지 정리
   */
  cleanupLandingPage(options) {
    console.log('🧹 Cleaning up landing page');
    // 필요한 정리 작업
  }

  /**
   * 대시보드 페이지 정리
   */
  cleanupDashboardPage(options) {
    console.log('🧹 Cleaning up dashboard page');
    // 필요한 정리 작업
  }

  /**
   * 에디터 페이지 정리
   */
  cleanupEditorPage(options) {
    console.log('🧹 Cleaning up editor page');
    
    // 에디터 리소스 정리 (필요한 경우)
    if (this.bpmnEditor && options.fullCleanup) {
      // 전체 정리가 필요한 경우에만
      // this.bpmnEditor.destroy();
      // this.bpmnEditor = null;
    }
  }

  /**
   * 프로젝트 ID로 로드 (라우터용)
   */
  async loadProjectById(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (project) {
      await this.selectProject(project.id);
    } else {
      console.warn(`❌ Project not found: ${projectId}`);
      await this.router.navigateTo('dashboard');
    }
  }

  /**
   * 다이어그램 ID로 열기 (라우터용)
   */
  async openDiagramById(diagramId) {
    if (!this.currentProject) {
      console.warn('❌ No current project for diagram:', diagramId);
      return;
    }

    const diagram = this.currentProject.diagrams?.find(d => d.id === diagramId);
    if (diagram && this.bpmnEditor) {
      await this.bpmnEditor.openDiagram({
        id: diagram.id,
        name: diagram.name,
        content: diagram.bpmn_xml
      });
    } else {
      console.warn(`❌ Diagram not found: ${diagramId}`);
    }
  }


  /**
   * 라우터 상태 정보
   */
  getRouterStatus() {
    return this.router.getStatus();
  }

  // ==================== EventBus 이벤트 핸들러들 ====================

  /**
   * 사용자 로그인 처리
   */
  handleUserLogin(user) {
    this.currentUser = user;
    // 필요한 경우 대시보드로 이동
    if (this.router.isCurrentPage('landing')) {
      this.router.navigateTo('dashboard');
    }
  }

  /**
   * 사용자 로그아웃 처리
   */
  handleUserLogout() {
    this.currentUser = null;
    this.currentProject = null;
    this.projects = [];
    
    // 랜딩 페이지로 이동
    this.router.navigateTo('landing');
  }

  /**
   * 프로젝트 생성 처리
   */
  handleProjectCreated(project) {
    // 프로젝트 목록에 추가
    if (!this.projects.find(p => p.id === project.id)) {
      this.projects.push(project);
    }
    
    // UI 새로고침
    this.refreshProjectList();
    
    // 알림 표시
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message: `프로젝트 "${project.name}"가 생성되었습니다.`,
      type: 'success'
    });
  }

  /**
   * 프로젝트 업데이트 처리
   */
  handleProjectUpdated(data) {
    // 프로젝트 목록에서 업데이트
    const projectIndex = this.projects.findIndex(p => p.id === data.projectId);
    if (projectIndex !== -1) {
      this.projects[projectIndex] = { ...this.projects[projectIndex], ...data.updates };
    }
    
    // 현재 프로젝트가 업데이트된 경우
    if (this.currentProject && this.currentProject.id === data.projectId) {
      this.currentProject = { ...this.currentProject, ...data.updates };
    }
    
    // UI 새로고침
    this.refreshProjectList();
  }

  /**
   * 프로젝트 삭제 처리
   */
  handleProjectDeleted(projectId) {
    // 프로젝트 목록에서 제거
    this.projects = this.projects.filter(p => p.id !== projectId);
    
    // 현재 프로젝트가 삭제된 경우
    if (this.currentProject && this.currentProject.id === projectId) {
      this.currentProject = null;
      // 대시보드로 이동
      this.router.navigateTo('dashboard');
    }
    
    // UI 새로고침
    this.refreshProjectList();
    
    // 알림 표시
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message: '프로젝트가 삭제되었습니다.',
      type: 'info'
    });
  }

  /**
   * 프로젝트 선택 처리
   */
  handleProjectSelected(project) {
    this.currentProject = project;
    // 에디터 페이지로 이동
    this.router.navigateTo('editor', { projectId: project.id });
  }

  /**
   * 다이어그램 생성 처리
   */
  handleDiagramCreated(diagram) {
    // 현재 프로젝트에 다이어그램 추가
    if (this.currentProject && this.currentProject.id === diagram.project_id) {
      if (!this.currentProject.diagrams) {
        this.currentProject.diagrams = [];
      }
      this.currentProject.diagrams.push(diagram);
      
      // Explorer 새로고침
      this.refreshExplorer();
    }
    
    // 알림 표시
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message: `다이어그램 "${diagram.name}"가 생성되었습니다.`,
      type: 'success'
    });
  }

  /**
   * 다이어그램 열기 처리
   */
  handleDiagramOpened(diagram) {
    // 현재 다이어그램 상태 업데이트
    if (this.bpmnEditor) {
      this.bpmnEditor.currentDiagram = diagram;
    }
  }

  /**
   * 다이어그램 닫기 처리
   */
  handleDiagramClosed(diagram) {
    // 필요한 정리 작업
    console.log('Diagram closed:', diagram?.name);
  }

  /**
   * 다이어그램 업데이트 처리
   */
  handleDiagramUpdated(data) {
    // 현재 프로젝트의 다이어그램 목록 업데이트
    if (this.currentProject && this.currentProject.diagrams) {
      const diagramIndex = this.currentProject.diagrams.findIndex(d => d.id === data.diagramId);
      if (diagramIndex !== -1) {
        this.currentProject.diagrams[diagramIndex] = { 
          ...this.currentProject.diagrams[diagramIndex], 
          ...data.updates 
        };
        
        // Explorer 새로고침
        this.refreshExplorer();
      }
    }
  }

  /**
   * 다이어그램 삭제 처리
   */
  handleDiagramDeleted(diagramId) {
    // 현재 프로젝트에서 다이어그램 제거
    if (this.currentProject && this.currentProject.diagrams) {
      this.currentProject.diagrams = this.currentProject.diagrams.filter(d => d.id !== diagramId);
      
      // Explorer 새로고침
      this.refreshExplorer();
    }
    
    // 알림 표시
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message: '다이어그램이 삭제되었습니다.',
      type: 'info'
    });
  }

  /**
   * 폴더 생성 처리
   */
  handleFolderCreated(folder) {
    // 현재 프로젝트에 폴더 추가
    if (this.currentProject && this.currentProject.id === folder.project_id) {
      if (!this.currentProject.folders) {
        this.currentProject.folders = [];
      }
      this.currentProject.folders.push(folder);
      
      // Explorer 새로고침
      this.refreshExplorer();
    }
    
    // 알림 표시
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message: `폴더 "${folder.name}"가 생성되었습니다.`,
      type: 'success'
    });
  }

  /**
   * 폴더 업데이트 처리
   */
  handleFolderUpdated(data) {
    // 현재 프로젝트의 폴더 목록 업데이트
    if (this.currentProject && this.currentProject.folders) {
      const folderIndex = this.currentProject.folders.findIndex(f => f.id === data.folderId);
      if (folderIndex !== -1) {
        this.currentProject.folders[folderIndex] = { 
          ...this.currentProject.folders[folderIndex], 
          ...data.updates 
        };
        
        // Explorer 새로고침
        this.refreshExplorer();
      }
    }
  }

  /**
   * 폴더 삭제 처리
   */
  handleFolderDeleted(folderId) {
    // 현재 프로젝트에서 폴더 제거
    if (this.currentProject && this.currentProject.folders) {
      this.currentProject.folders = this.currentProject.folders.filter(f => f.id !== folderId);
      
      // Explorer 새로고침
      this.refreshExplorer();
    }
    
    // 알림 표시
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message: '폴더가 삭제되었습니다.',
      type: 'info'
    });
  }

  /**
   * 페이지 변경 처리
   */
  handlePageChanged(data) {
    // 필요한 페이지별 처리
    console.log('Page changed handled:', data);
  }

  /**
   * 에러 처리
   */
  handleError(errorData) {
    // 에러 로깅
    console.error('Application error:', errorData);
    
    // 사용자에게 에러 표시
    let message = '오류가 발생했습니다.';
    
    if (errorData.type === 'network_error') {
      message = '네트워크 연결을 확인해주세요.';
    } else if (errorData.type === 'auth_error') {
      message = '인증 오류가 발생했습니다. 다시 로그인해주세요.';
    } else if (errorData.error && errorData.error.message) {
      message = errorData.error.message;
    }
    
    eventBus.emit(eventBus.EVENTS.NOTIFICATION_SHOW, {
      message,
      type: 'error'
    });
  }

  // ==================== 헬퍼 메서드들 ====================

  /**
   * 프로젝트 목록 UI 새로고침
   */
  refreshProjectList() {
    // 대시보드 페이지의 프로젝트 목록 새로고침
    if (this.router.isCurrentPage('dashboard')) {
      this.renderProjectList();
    }
  }

  /**
   * Explorer 새로고침
   */
  refreshExplorer() {
    if (this.vscodeLayout && this.vscodeLayout.explorer) {
      const explorerCore = this.vscodeLayout.explorer.explorerCore;
      if (explorerCore && explorerCore.dataProvider && explorerCore.dataProvider.setProjectData) {
        explorerCore.dataProvider.setProjectData(this.currentProject);
        explorerCore.refreshTree();
      }
    }
  }

  /**
   * EventBus 상태 정보
   */
  getEventBusStatus() {
    return eventBus.getStatus();
  }
}

// 전역 인스턴스
let appManager = null;

export function getAppManager() {
  if (!appManager) {
    appManager = new AppManager();
  }
  return appManager;
}