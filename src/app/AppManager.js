import $ from 'jquery';
import { getCurrentUser, onAuthStateChange } from '../lib/supabase.js';
import { showSupabaseLoginModal } from '../components/SupabaseLoginModal.js';
import { dbManager } from '../lib/database.js';
import { BpmnEditor } from '../editor/BpmnEditor.js';

/**
 * 전체 애플리케이션 흐름을 관리하는 클래스
 */
export class AppManager {
  constructor() {
    this.currentUser = null;
    this.currentProject = null;
    this.currentPage = 'landing';
    this.projects = [];
    
    // 페이지 요소들
    this.landingPage = $('#landing-page');
    this.dashboardPage = $('#dashboard-page');
    this.editorPage = $('#editor-page');
    
    // BPMN 에디터
    this.bpmnEditor = null;
    
    this.initialize();
  }

  async initialize() {
    console.log('AppManager initializing...');
    
    // 인증 상태 확인
    await this.initializeAuth();
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    console.log('AppManager initialized');
  }

  async initializeAuth() {
    // 현재 사용자 확인
    this.currentUser = await getCurrentUser();
    console.log('Current user on init:', this.currentUser);
    
    // 인증 상태에 따라 페이지 표시
    if (this.currentUser) {
      this.showDashboard();
    } else {
      this.showLanding();
    }
    
    // 인증 상태 변경 감지
    onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.email || 'no user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        this.currentUser = session.user;
        this.onUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.onUserSignedOut();
      }
    });
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
      this.showInviteUsersModal();
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
  }

  // 페이지 전환 메서드들
  showLanding() {
    this.currentPage = 'landing';
    this.landingPage.show();
    this.dashboardPage.hide();
    this.editorPage.hide();
  }

  async showDashboard() {
    this.currentPage = 'dashboard';
    this.landingPage.hide();
    this.dashboardPage.show();
    this.editorPage.hide();
    
    // 사용자 이름 표시
    if (this.currentUser) {
      const displayName = this.currentUser.user_metadata?.display_name || 
                         this.currentUser.email?.split('@')[0] || 
                         '사용자';
      $('#user-name').text(displayName);
      
      // 프로젝트 목록 로드
      await this.loadProjects();
    }
  }

  showEditor(project) {
    this.currentPage = 'editor';
    this.currentProject = project;
    
    this.landingPage.hide();
    this.dashboardPage.hide();
    this.editorPage.show();
    
    // 프로젝트 이름 표시
    $('#current-project-name').text(project.name);
    
    // BPMN 에디터 초기화
    this.initializeBpmnEditor();
    
    // 파일 트리 로드
    this.loadFileTree();
  }

  // 인증 관련 메서드들
  onUserSignedIn(user) {
    console.log('User signed in:', user.email);
    this.currentUser = user;
    
    // BPMN 에디터에 사용자 설정
    if (this.bpmnEditor) {
      this.bpmnEditor.setUser(user);
    }
    
    this.showDashboard();
  }

  onUserSignedOut() {
    console.log('User signed out');
    this.currentUser = null;
    this.currentProject = null;
    
    // BPMN 에디터에서 사용자 제거
    if (this.bpmnEditor) {
      this.bpmnEditor.setUser(null);
    }
    
    this.showLanding();
  }

  showLoginModal(mode = 'login') {
    showSupabaseLoginModal(mode, (user) => {
      console.log('Login successful:', user);
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
      const { data, error } = await dbManager.getUserProjects(this.currentUser.id);
      
      if (error) {
        console.error('Error loading projects:', error);
        return;
      }

      this.projects = data || [];
      this.renderProjectsGrid();
      
    } catch (error) {
      console.error('Load projects error:', error);
    }
  }

  renderProjectsGrid() {
    const grid = $('#projects-grid');
    
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
          <h3>${project.name}</h3>
          <p>${project.description || '설명이 없습니다.'}</p>
          <div class="project-meta">
            <span class="role">${roleText}</span>
            <span class="date">${this.formatDate(project.updated_at)}</span>
          </div>
        </div>
      `;
    });
    
    grid.html(html);
  }

  async openProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      return;
    }
    
    console.log('Opening project:', project.name);
    this.showEditor(project);
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

      console.log('Attempting to create project...');
      const result = await dbManager.createProject({
        name,
        description,
        owner_id: this.currentUser.id
      });

      console.log('Create project result:', result);

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

  showInviteUsersModal() {
    // TODO: 사용자 초대 모달 구현
    console.log('Invite users modal');
    this.showNotification('사용자 초대 기능은 곧 추가될 예정입니다.', 'info');
  }

  loadFileTree() {
    // TODO: 파일 트리 구현
    const fileTree = $('#file-tree');
    fileTree.html(`
      <div class="folder-item">
        <span class="folder-icon">📁</span>
        <span>루트 폴더</span>
      </div>
      <div class="file-item" data-action="new-diagram">
        <span class="file-icon">📄</span>
        <span>새 다이어그램.bpmn</span>
      </div>
    `);
    
    // 파일 항목 클릭 이벤트
    fileTree.find('.file-item').on('click', (e) => {
      const action = $(e.currentTarget).data('action');
      if (action === 'new-diagram') {
        this.openNewDiagram();
      }
    });
  }

  // BPMN 에디터 관련 메서드들
  initializeBpmnEditor() {
    if (!this.bpmnEditor) {
      this.bpmnEditor = new BpmnEditor();
    }
    
    // 현재 사용자 설정
    if (this.currentUser) {
      this.bpmnEditor.setUser(this.currentUser);
    }
    
    // 현재 프로젝트 설정
    if (this.currentProject) {
      this.bpmnEditor.setProject(this.currentProject);
    }
  }

  openNewDiagram() {
    if (!this.bpmnEditor) {
      this.initializeBpmnEditor();
    }
    
    this.bpmnEditor.createNewDiagram();
  }

  openDiagram(diagramData) {
    if (!this.bpmnEditor) {
      this.initializeBpmnEditor();
    }
    
    this.bpmnEditor.openDiagram(diagramData);
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
}

// 전역 인스턴스
let appManager = null;

export function getAppManager() {
  if (!appManager) {
    appManager = new AppManager();
  }
  return appManager;
}