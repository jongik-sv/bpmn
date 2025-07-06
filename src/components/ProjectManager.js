import $ from 'jquery';
import { dbManager } from '../lib/database.js';
import { getCurrentUser } from '../lib/supabase.js';

/**
 * 프로젝트 관리 컴포넌트
 */
export class ProjectManager {
  constructor() {
    this.currentUser = null;
    this.projects = [];
    this.currentProject = null;
    this.currentDiagram = null;
    this.listeners = new Map();
  }

  /**
   * 프로젝트 매니저 초기화
   */
  async initialize() {
    try {
      this.currentUser = await getCurrentUser();
      if (!this.currentUser) {
        console.log('No user logged in for project manager');
        return;
      }

      await this.loadUserProjects();
      this.setupUI();
      console.log('ProjectManager initialized');
    } catch (error) {
      console.error('ProjectManager initialization error:', error);
    }
  }

  /**
   * 사용자의 프로젝트 목록 로드
   */
  async loadUserProjects() {
    try {
      const { data, error } = await dbManager.getUserProjects(this.currentUser.id);
      
      if (error) {
        console.error('Error loading projects:', error);
        return;
      }

      this.projects = data || [];
      console.log('Loaded projects:', this.projects);
      this.updateProjectList();
    } catch (error) {
      console.error('Load projects error:', error);
    }
  }

  /**
   * 프로젝트 관리 UI 설정
   */
  setupUI() {
    // 프로젝트 관리 영역이 없으면 생성
    if ($('#project-manager').length === 0) {
      this.createProjectManagerUI();
    }
    
    this.setupEventListeners();
  }

  /**
   * 프로젝트 관리 UI 생성
   */
  createProjectManagerUI() {
    const projectManagerHtml = `
      <div id="project-manager" class="project-manager">
        <div class="project-header">
          <h3>프로젝트</h3>
          <button id="create-project-btn" class="btn btn-primary btn-sm">새 프로젝트</button>
        </div>
        <div id="project-list" class="project-list">
          <!-- 프로젝트 목록이 여기에 표시됩니다 -->
        </div>
      </div>
    `;

    // 헤더의 왼쪽에 추가
    $('.app-header .header-left').append(projectManagerHtml);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 새 프로젝트 생성 버튼
    $(document).on('click', '#create-project-btn', () => {
      this.showCreateProjectModal();
    });

    // 프로젝트 선택
    $(document).on('click', '.project-item', (e) => {
      const projectId = $(e.currentTarget).data('project-id');
      this.selectProject(projectId);
    });

    // 프로젝트 컨텍스트 메뉴
    $(document).on('contextmenu', '.project-item', (e) => {
      e.preventDefault();
      const projectId = $(e.currentTarget).data('project-id');
      this.showProjectContextMenu(e, projectId);
    });

    // 새 다이어그램 생성 버튼
    $(document).on('click', '#create-diagram-btn', () => {
      this.showCreateDiagramModal();
    });

    // 다이어그램 선택
    $(document).on('click', '.diagram-item', (e) => {
      const diagramId = $(e.currentTarget).data('diagram-id');
      this.selectDiagram(diagramId);
    });

    // 다이어그램 컨텍스트 메뉴
    $(document).on('contextmenu', '.diagram-item', (e) => {
      e.preventDefault();
      const diagramId = $(e.currentTarget).data('diagram-id');
      this.showDiagramContextMenu(e, diagramId);
    });
  }

  /**
   * 프로젝트 목록 업데이트
   */
  updateProjectList() {
    const projectList = $('#project-list');
    
    if (this.projects.length === 0) {
      projectList.html(`
        <div class="empty-state">
          <p>아직 프로젝트가 없습니다.</p>
          <p>새 프로젝트를 생성해보세요!</p>
        </div>
      `);
      return;
    }

    const projectsHtml = this.projects.map(project => {
      const isSelected = this.currentProject?.id === project.id;
      const role = project.project_members[0]?.role || 'viewer';
      const roleIcon = {
        'owner': '👑',
        'admin': '⚙️',
        'editor': '✏️',
        'viewer': '👁️'
      }[role] || '👁️';

      return `
        <div class="project-item ${isSelected ? 'selected' : ''}" 
             data-project-id="${project.id}">
          <div class="project-info">
            <div class="project-name">${project.name}</div>
            <div class="project-meta">
              <span class="project-role">${roleIcon} ${role}</span>
              <span class="project-updated">${this.formatDate(project.updated_at)}</span>
            </div>
          </div>
          <div class="project-actions">
            <button class="btn-icon" data-action="menu">⋮</button>
          </div>
        </div>
      `;
    }).join('');

    projectList.html(projectsHtml);
  }

  /**
   * 새 프로젝트 생성 모달 표시
   */
  showCreateProjectModal() {
    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal create-project-modal">
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

    // 이벤트 리스너
    $('.modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    $('.close-btn, .close-modal').on('click', () => {
      this.closeModal();
    });

    $('#create-project-form').on('submit', (e) => {
      e.preventDefault();
      this.handleCreateProject();
    });

    // 포커스
    setTimeout(() => $('#project-name').focus(), 100);
  }

  /**
   * 프로젝트 생성 처리
   */
  async handleCreateProject() {
    const form = $('#create-project-form');
    const name = form.find('#project-name').val().trim();
    const description = form.find('#project-description').val().trim();

    if (!name) {
      this.showError('프로젝트 이름을 입력해주세요.');
      return;
    }

    try {
      this.setFormLoading(true);

      const { data, error } = await dbManager.createProject({
        name,
        description,
        owner_id: this.currentUser.id
      });

      if (error) {
        throw new Error(error.message);
      }

      // 프로젝트 목록 새로고침
      await this.loadUserProjects();
      
      // 새 프로젝트 선택
      this.selectProject(data.id);
      
      this.closeModal();
      this.showNotification('프로젝트가 생성되었습니다.', 'success');

    } catch (error) {
      console.error('Create project error:', error);
      this.showError(error.message || '프로젝트 생성에 실패했습니다.');
    } finally {
      this.setFormLoading(false);
    }
  }

  /**
   * 프로젝트 선택
   */
  async selectProject(projectId) {
    try {
      const project = this.projects.find(p => p.id === projectId);
      if (!project) {
        console.error('Project not found:', projectId);
        return;
      }

      this.currentProject = project;
      this.updateProjectList();
      
      // 다이어그램 목록 로드
      await this.loadProjectDiagrams();
      
      this.emit('projectSelected', { project: this.currentProject });
      console.log('Project selected:', project.name);

    } catch (error) {
      console.error('Select project error:', error);
    }
  }

  /**
   * 프로젝트의 다이어그램 목록 로드
   */
  async loadProjectDiagrams() {
    if (!this.currentProject) return;

    try {
      const { data, error } = await dbManager.getProjectDiagrams(this.currentProject.id);
      
      if (error) {
        console.error('Error loading diagrams:', error);
        return;
      }

      this.currentProject.diagrams = data || [];
      this.updateDiagramList();
      
    } catch (error) {
      console.error('Load diagrams error:', error);
    }
  }

  /**
   * 다이어그램 목록 업데이트
   */
  updateDiagramList() {
    if (!this.currentProject) return;
    
    // 다이어그램 목록 섹션이 없으면 생성
    if ($('#diagram-list').length === 0) {
      $('#project-manager').append(`
        <div class="diagram-section">
          <div class="diagram-header">
            <h4>다이어그램</h4>
            <button id="create-diagram-btn" class="btn btn-primary btn-sm">새 다이어그램</button>
          </div>
          <div id="diagram-list" class="diagram-list">
            <!-- 다이어그램 목록이 여기에 표시됩니다 -->
          </div>
        </div>
      `);
    }
    
    const diagramList = $('#diagram-list');
    const diagrams = this.currentProject.diagrams || [];
    
    if (diagrams.length === 0) {
      diagramList.html(`
        <div class="empty-state">
          <p>다이어그램이 없습니다.</p>
          <p>새 다이어그램을 생성해보세요!</p>
        </div>
      `);
      return;
    }
    
    const diagramsHtml = diagrams.map(diagram => {
      const isSelected = this.currentDiagram?.id === diagram.id;
      return `
        <div class="diagram-item ${isSelected ? 'selected' : ''}" 
             data-diagram-id="${diagram.id}">
          <div class="diagram-info">
            <div class="diagram-name">${diagram.name}</div>
            <div class="diagram-meta">
              <span class="diagram-updated">${this.formatDate(diagram.updated_at)}</span>
            </div>
          </div>
          <div class="diagram-actions">
            <button class="btn-icon" data-action="menu">⋮</button>
          </div>
        </div>
      `;
    }).join('');
    
    diagramList.html(diagramsHtml);
    console.log('Diagrams loaded:', diagrams.length);
  }

  /**
   * 새 다이어그램 생성 모달 표시
   */
  showCreateDiagramModal() {
    if (!this.currentProject) {
      this.showError('프로젝트를 먼저 선택해주세요.');
      return;
    }

    const modalHtml = `
      <div class="modal-overlay">
        <div class="modal create-diagram-modal">
          <div class="modal-header">
            <h3>새 다이어그램 생성</h3>
            <button class="close-btn">&times;</button>
          </div>
          <div class="modal-body">
            <form id="create-diagram-form">
              <div class="form-group">
                <label for="diagram-name">다이어그램 이름 *</label>
                <input type="text" id="diagram-name" name="name" required 
                       placeholder="다이어그램 이름을 입력하세요">
              </div>
              <div class="form-group">
                <label for="diagram-description">설명</label>
                <textarea id="diagram-description" name="description" 
                          placeholder="다이어그램 설명을 입력하세요" rows="3"></textarea>
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

    // 이벤트 리스너
    $('.modal-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    $('.close-btn, .close-modal').on('click', () => {
      this.closeModal();
    });

    $('#create-diagram-form').on('submit', (e) => {
      e.preventDefault();
      this.handleCreateDiagram();
    });

    setTimeout(() => $('#diagram-name').focus(), 100);
  }

  /**
   * 다이어그램 생성 처리
   */
  async handleCreateDiagram() {
    const form = $('#create-diagram-form');
    const name = form.find('#diagram-name').val().trim();
    const description = form.find('#diagram-description').val().trim();

    if (!name) {
      this.showError('다이어그램 이름을 입력해주세요.');
      return;
    }

    try {
      this.setFormLoading(true);

      // 기본 BPMN XML
      const defaultBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
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
</bpmn:definitions>`;

      const { data, error } = await dbManager.createDiagram({
        project_id: this.currentProject.id,
        name,
        description,
        bpmn_xml: defaultBpmnXml,
        created_by: this.currentUser.id
      });

      if (error) {
        throw new Error(error.message);
      }

      // 다이어그램 목록 새로고침
      await this.loadProjectDiagrams();
      
      // 새 다이어그램 선택
      this.selectDiagram(data.id);
      
      this.closeModal();
      this.showNotification('다이어그램이 생성되었습니다.', 'success');

    } catch (error) {
      console.error('Create diagram error:', error);
      this.showError(error.message || '다이어그램 생성에 실패했습니다.');
    } finally {
      this.setFormLoading(false);
    }
  }

  /**
   * 다이어그램 선택
   */
  async selectDiagram(diagramId) {
    try {
      const diagram = this.currentProject.diagrams.find(d => d.id === diagramId);
      if (!diagram) {
        console.error('Diagram not found:', diagramId);
        return;
      }

      this.currentDiagram = diagram;
      this.updateDiagramList();
      
      this.emit('diagramSelected', { diagram: this.currentDiagram });
      console.log('Diagram selected:', diagram.name);

    } catch (error) {
      console.error('Select diagram error:', error);
    }
  }

  /**
   * 프로젝트 컨텍스트 메뉴 표시
   */
  showProjectContextMenu(event, projectId) {
    // 컨텍스트 메뉴 구현 (추후 확장)
    console.log('Project context menu:', projectId);
  }

  /**
   * 다이어그램 컨텍스트 메뉴 표시
   */
  showDiagramContextMenu(event, diagramId) {
    // 컨텍스트 메뉴 구현 (추후 확장)
    console.log('Diagram context menu:', diagramId);
  }

  /**
   * 현재 다이어그램 정보 가져오기
   */
  getCurrentDiagram() {
    return this.currentDiagram;
  }

  /**
   * 유틸리티 함수들
   */
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

  showError(message) {
    // 간단한 에러 표시 (기존 알림 시스템 활용)
    if (window.bpmnEditor && window.bpmnEditor.showNotification) {
      window.bpmnEditor.showNotification(message, 'error');
    } else {
      alert(message);
    }
  }

  showNotification(message, type) {
    if (window.bpmnEditor && window.bpmnEditor.showNotification) {
      window.bpmnEditor.showNotification(message, type);
    }
  }

  closeModal() {
    $('.modal-overlay').fadeOut(() => {
      $('.modal-overlay').remove();
    });
  }

  /**
   * 이벤트 시스템
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event ${event} callback error:`, error);
        }
      });
    }
  }

  /**
   * 현재 프로젝트 정보 가져오기
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * 프로젝트 매니저 정리
   */
  destroy() {
    $('#project-manager').remove();
    this.listeners.clear();
  }
}

// 전역 인스턴스
let globalProjectManager = null;

/**
 * 프로젝트 매니저 인스턴스 가져오기
 */
export function getProjectManager() {
  if (!globalProjectManager) {
    globalProjectManager = new ProjectManager();
  }
  return globalProjectManager;
}