import { EventEmitter } from 'events';
import { dbManager } from '../../lib/database.js';
import { rbacManager, hasPermission, getUserRoleInProject } from '../../lib/rbac.js';
import $ from 'jquery';

/**
 * 프로젝트 상태 및 관리 전담 클래스
 * 프로젝트 CRUD, 멤버 관리, 프로젝트 목록 표시 등 처리
 */
export class ProjectStateManager extends EventEmitter {
  constructor() {
    super();
    
    // 프로젝트 상태
    this.currentProject = null;
    this.projects = [];
    this.currentUser = null;
    
    // UI 상태
    this.isLoading = false;
    this.lastLoadTime = null;
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupProjectEventListeners();
    this.emit('projectManagerInitialized');
  }

  /**
   * 프로젝트 이벤트 리스너 설정
   */
  setupProjectEventListeners() {
    // 외부에서 오는 요청들 처리
    this.on('userUpdated', (user) => {
      this.currentUser = user;
      if (user) {
        this.loadProjects();
      } else {
        this.clearProjects();
      }
    });
    
    this.on('projectsLoadRequested', () => {
      this.loadProjects();
    });
    
    this.on('createProjectRequested', () => {
      this.showCreateProjectModal();
    });
    
    this.on('projectOpenRequested', (projectId) => {
      this.openProject(projectId);
    });
    
    this.on('projectDataLoadRequested', (project) => {
      this.loadProjectData(project);
    });
    
    this.on('inviteUsersRequested', () => {
      this.showProjectMembersModal();
    });
  }

  /**
   * 프로젝트 목록 로드
   */
  async loadProjects() {
    if (!this.currentUser) {
      console.warn('No current user for loading projects');
      this.clearProjects();
      return;
    }

    if (this.isLoading) {
      console.log('Projects already loading, skipping...');
      return;
    }

    try {
      this.isLoading = true;
      console.log('📂 Loading projects for user:', this.currentUser.id);
      
      const { data, error } = await dbManager.getUserProjects(this.currentUser.id);
      
      if (error) {
        console.error('Error loading projects:', error);
        this.emit('projectsLoadError', error);
        return;
      }

      this.projects = data || [];
      this.lastLoadTime = Date.now();
      
      console.log(`✅ Loaded ${this.projects.length} projects`);
      
      // 프로젝트 그리드 렌더링
      this.renderProjectsGrid();
      
      this.emit('projectsLoaded', this.projects);
      
    } catch (error) {
      console.error('Load projects error:', error);
      this.emit('projectsLoadError', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 프로젝트 그리드 렌더링
   */
  renderProjectsGrid() {
    const grid = $('#projects-grid');
    if (!grid.length) {
      console.warn('Projects grid element not found');
      return;
    }
    
    // 새 프로젝트 생성 카드
    let html = this.renderCreateProjectCard();
    
    // 기존 프로젝트 카드들
    this.projects.forEach(project => {
      html += this.renderProjectCard(project);
    });
    
    grid.html(html);
    
    // 프로젝트 카드 이벤트 리스너 설정
    this.setupProjectCardEvents();
    
    this.emit('projectsGridRendered', this.projects.length);
  }

  /**
   * 새 프로젝트 생성 카드 렌더링
   */
  renderCreateProjectCard() {
    return `
      <div class="project-card create-project-card" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        border: 2px dashed #3e3e3e;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        background-color: #2a2a2a;
        color: #cccccc;
      ">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 16px; color: #007ACC;">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">새 프로젝트 생성</h3>
        <p style="margin: 0; color: #999999; text-align: center; font-size: 14px;">새로운 BPMN 프로젝트를 시작하세요</p>
      </div>
    `;
  }

  /**
   * 프로젝트 카드 렌더링
   */
  renderProjectCard(project) {
    const role = project.project_members?.[0]?.role || 'viewer';
    const roleText = {
      'owner': '소유자',
      'admin': '관리자', 
      'editor': '편집자',
      'viewer': '뷰어'
    }[role] || '뷰어';
    
    const canEdit = role === 'owner' || role === 'admin';
    
    return `
      <div class="project-card" data-project-id="${project.id}" style="
        background-color: #2a2a2a;
        border: 1px solid #3e3e3e;
        border-radius: 8px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      ">
        <div class="project-card-header" style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        ">
          <h3 style="
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            flex: 1;
            margin-right: 8px;
          ">${this.escapeHtml(project.name)}</h3>
          ${canEdit ? `
            <button class="project-edit-btn" 
                    data-project-id="${project.id}" 
                    title="프로젝트 이름 수정"
                    style="
                      width: 24px;
                      height: 24px;
                      border: none;
                      background: rgba(255, 255, 255, 0.1);
                      color: #cccccc;
                      border-radius: 4px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      transition: background-color 0.2s ease;
                    "
                    onclick="event.stopPropagation();">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          ` : ''}
        </div>
        <p style="
          margin: 0 0 16px 0;
          color: #cccccc;
          font-size: 14px;
          line-height: 1.4;
          min-height: 40px;
        ">${this.escapeHtml(project.description || '설명이 없습니다.')}</p>
        <div class="project-meta" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #999999;
        ">
          <span class="role" style="
            background-color: #007ACC;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 500;
          ">${roleText}</span>
          <span class="date">${this.formatDate(project.updated_at)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 프로젝트 카드 이벤트 설정
   */
  setupProjectCardEvents() {
    // 프로젝트 카드 호버 효과
    $('.project-card').off('mouseenter mouseleave').on('mouseenter', function() {
      $(this).css({
        'transform': 'translateY(-2px)',
        'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.3)',
        'border-color': '#007ACC'
      });
    }).on('mouseleave', function() {
      $(this).css({
        'transform': 'translateY(0)',
        'box-shadow': 'none',
        'border-color': '#3e3e3e'
      });
    });
    
    // 생성 카드 호버 효과
    $('.create-project-card').off('mouseenter mouseleave').on('mouseenter', function() {
      $(this).css({
        'border-color': '#007ACC',
        'background-color': '#2d2d2d'
      });
    }).on('mouseleave', function() {
      $(this).css({
        'border-color': '#3e3e3e',
        'background-color': '#2a2a2a'
      });
    });
    
    // 편집 버튼 호버 효과
    $('.project-edit-btn').off('mouseenter mouseleave').on('mouseenter', function() {
      $(this).css('background-color', 'rgba(255, 255, 255, 0.2)');
    }).on('mouseleave', function() {
      $(this).css('background-color', 'rgba(255, 255, 255, 0.1)');
    });
    
    // 편집 버튼 클릭 이벤트
    $('.project-edit-btn').off('click').on('click', (e) => {
      e.stopPropagation();
      const projectId = $(e.currentTarget).data('project-id');
      this.showEditProjectModal(projectId);
    });
  }

  /**
   * 프로젝트 열기
   */
  async openProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      this.emit('projectNotFound', projectId);
      return;
    }
    
    console.log('📂 Opening project:', project.name);
    this.currentProject = project;
    
    this.emit('projectOpened', project);
  }

  /**
   * 프로젝트 데이터 로드 (폴더, 다이어그램)
   */
  async loadProjectData(project = this.currentProject) {
    if (!project) {
      console.warn('No project to load data for');
      return;
    }

    try {
      console.log('📊 Loading project data for:', project.name);
      
      // 프로젝트의 폴더와 다이어그램 병렬 로드
      const [foldersResult, diagramsResult] = await Promise.all([
        dbManager.getProjectFolders(project.id).catch(err => {
          console.error('Failed to load folders:', err);
          return { data: [], error: err };
        }),
        dbManager.getProjectDiagrams(project.id).catch(err => {
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
          this.emit('dataLoadWarning', '일부 데이터를 불러올 수 없습니다. 로컬 모드로 진행합니다.');
        }
      }

      // 현재 프로젝트에 데이터 할당
      if (this.currentProject && this.currentProject.id === project.id) {
        this.currentProject.folders = foldersResult.data || [];
        this.currentProject.diagrams = diagramsResult.data || [];
        
        console.log(`✅ Loaded ${this.currentProject.folders.length} folders and ${this.currentProject.diagrams.length} diagrams`);
        
        this.emit('projectDataLoaded', {
          project: this.currentProject,
          folders: this.currentProject.folders,
          diagrams: this.currentProject.diagrams
        });
      } else {
        console.warn('Current project changed during data loading');
      }
      
    } catch (error) {
      console.error('Load project data error:', error);
      this.emit('projectDataLoadError', error);
    }
  }

  /**
   * 프로젝트 생성 모달 표시
   */
  showCreateProjectModal() {
    const modalHtml = `
      <div class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      ">
        <div class="modal" style="
          background-color: #2a2a2a;
          border-radius: 8px;
          min-width: 400px;
          max-width: 500px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
          <div class="modal-header" style="
            padding: 20px 24px;
            border-bottom: 1px solid #3e3e3e;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <h3 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">새 프로젝트 생성</h3>
            <button class="close-btn" style="
              background: none;
              border: none;
              color: #cccccc;
              font-size: 24px;
              cursor: pointer;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
            ">&times;</button>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <form id="create-project-form">
              <div class="form-group" style="margin-bottom: 20px;">
                <label for="project-name" style="
                  display: block;
                  margin-bottom: 8px;
                  color: #cccccc;
                  font-size: 14px;
                  font-weight: 500;
                ">프로젝트 이름 *</label>
                <input type="text" 
                       id="project-name" 
                       name="name" 
                       required 
                       placeholder="프로젝트 이름을 입력하세요"
                       style="
                         width: 100%;
                         padding: 12px;
                         border: 1px solid #3e3e3e;
                         border-radius: 4px;
                         background-color: #1e1e1e;
                         color: #ffffff;
                         font-size: 14px;
                         box-sizing: border-box;
                       ">
              </div>
              <div class="form-group" style="margin-bottom: 24px;">
                <label for="project-description" style="
                  display: block;
                  margin-bottom: 8px;
                  color: #cccccc;
                  font-size: 14px;
                  font-weight: 500;
                ">설명</label>
                <textarea id="project-description" 
                          name="description" 
                          placeholder="프로젝트 설명을 입력하세요" 
                          rows="3"
                          style="
                            width: 100%;
                            padding: 12px;
                            border: 1px solid #3e3e3e;
                            border-radius: 4px;
                            background-color: #1e1e1e;
                            color: #ffffff;
                            font-size: 14px;
                            resize: vertical;
                            box-sizing: border-box;
                          "></textarea>
              </div>
              <div class="form-actions" style="
                display: flex;
                gap: 12px;
                justify-content: flex-end;
              ">
                <button type="button" 
                        class="btn btn-secondary close-modal"
                        style="
                          padding: 10px 20px;
                          border: 1px solid #3e3e3e;
                          border-radius: 4px;
                          background-color: transparent;
                          color: #cccccc;
                          cursor: pointer;
                          font-size: 14px;
                        ">취소</button>
                <button type="submit" 
                        class="btn btn-primary"
                        style="
                          padding: 10px 20px;
                          border: none;
                          border-radius: 4px;
                          background-color: #007ACC;
                          color: white;
                          cursor: pointer;
                          font-size: 14px;
                          font-weight: 500;
                        ">생성</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    $('body').append(modalHtml);
    this.setupModalEvents();
    setTimeout(() => $('#project-name').focus(), 100);
    
    this.emit('createProjectModalShown');
  }

  /**
   * 프로젝트 편집 모달 표시
   */
  showEditProjectModal(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found for editing:', projectId);
      return;
    }
    
    // TODO: 프로젝트 편집 모달 구현
    console.log('Edit project modal not yet implemented for:', project.name);
    this.emit('editProjectRequested', project);
  }

  /**
   * 모달 이벤트 설정
   */
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
    
    // ESC 키로 모달 닫기
    $(document).on('keydown.modal', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  /**
   * 프로젝트 생성 처리
   */
  async handleCreateProject() {
    const form = $('#create-project-form');
    const name = form.find('#project-name').val().trim();
    const description = form.find('#project-description').val().trim();

    if (!name) {
      this.emit('validationError', '프로젝트 이름을 입력해주세요.');
      return;
    }

    try {
      this.setFormLoading(true);
      
      const projectData = {
        name,
        description,
        owner_id: this.currentUser.id,
        owner_name: this.currentUser.user_metadata?.display_name || 
                   this.currentUser.email?.split('@')[0] || 
                   'Unknown User',
        owner_email: this.currentUser.email
      };
      
      console.log('📝 Creating project:', projectData);
      const result = await dbManager.createProject(projectData);

      if (result.error) {
        console.warn('Project creation returned error:', result.error);
        this.emit('projectCreateWarning', '프로젝트 생성 중 문제가 발생했지만 로컬에 저장되었습니다.');
      } else if (result.data) {
        this.emit('projectCreateSuccess', '프로젝트가 생성되었습니다.');
      } else {
        throw new Error('프로젝트 생성에 실패했습니다.');
      }

      // 프로젝트 목록 새로고침
      await this.loadProjects();
      this.closeModal();
      
      this.emit('projectCreated', result.data);

    } catch (error) {
      console.error('Create project error:', error);
      this.emit('projectCreateError', error.message || '프로젝트 생성에 실패했습니다.');
    } finally {
      this.setFormLoading(false);
    }
  }

  /**
   * 프로젝트 멤버 모달 표시
   */
  showProjectMembersModal() {
    if (!this.currentProject || !this.currentUser) {
      this.emit('validationError', '프로젝트와 사용자 정보가 필요합니다.');
      return;
    }

    // 권한 확인
    const userRole = getUserRoleInProject(this.currentUser.id, this.currentProject.id);
    if (!hasPermission(userRole, 'members.view')) {
      this.emit('permissionError', '멤버 목록을 볼 권한이 없습니다.');
      return;
    }

    // 글로벌 모달 사용
    if (window.projectMembersModal) {
      window.projectMembersModal.show(this.currentProject, this.currentUser);
      this.emit('projectMembersModalShown');
    } else {
      console.error('Project members modal not available');
      this.emit('projectMembersModalError', 'Project members modal not available');
    }
  }

  /**
   * 모달 닫기
   */
  closeModal() {
    $('.modal-overlay').remove();
    $(document).off('keydown.modal');
    this.emit('modalClosed');
  }

  /**
   * 폼 로딩 상태 설정
   */
  setFormLoading(loading) {
    const submitBtn = $('.btn-primary');
    const form = $('#create-project-form');
    
    if (loading) {
      submitBtn.prop('disabled', true).text('생성 중...');
      form.find('input, textarea').prop('disabled', true);
    } else {
      submitBtn.prop('disabled', false).text('생성');
      form.find('input, textarea').prop('disabled', false);
    }
  }

  /**
   * 프로젝트 목록 지우기
   */
  clearProjects() {
    this.projects = [];
    this.currentProject = null;
    this.renderProjectsGrid();
    this.emit('projectsCleared');
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(dateString) {
    if (!dateString) return '알 수 없음';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        return '방금 전';
      } else if (diffInHours < 24) {
        return `${diffInHours}시간 전`;
      } else if (diffInHours < 24 * 7) {
        const days = Math.floor(diffInHours / 24);
        return `${days}일 전`;
      } else {
        return date.toLocaleDateString('ko-KR');
      }
    } catch (error) {
      return '알 수 없음';
    }
  }

  /**
   * HTML 이스케이프
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 현재 프로젝트 반환
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * 프로젝트 목록 반환
   */
  getProjects() {
    return [...this.projects];
  }

  /**
   * 프로젝트 상태 정보 반환
   */
  getProjectStatus() {
    return {
      currentProject: this.currentProject ? {
        id: this.currentProject.id,
        name: this.currentProject.name,
        hasData: !!(this.currentProject.folders || this.currentProject.diagrams)
      } : null,
      projectsCount: this.projects.length,
      isLoading: this.isLoading,
      lastLoadTime: this.lastLoadTime,
      hasUser: !!this.currentUser
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 모달 정리
    this.closeModal();
    
    // 상태 초기화
    this.currentProject = null;
    this.projects = [];
    this.currentUser = null;
    this.isLoading = false;
    this.lastLoadTime = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    console.log('🗑️ ProjectStateManager destroyed');
  }
}