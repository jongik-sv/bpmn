import { EventEmitter } from 'events';
import { dbManager } from '../lib/database.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 프로젝트 관련 비즈니스 로직을 담당하는 서비스 클래스
 * UI 컴포넌트와 데이터베이스 사이의 중간 계층 역할
 */
export class ProjectService extends EventEmitter {
  constructor() {
    super();
    this.currentUser = null;
  }

  /**
   * 현재 사용자 설정
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * 사용자의 프로젝트 목록 조회
   */
  async getUserProjects(userId = null) {
    try {
      const targetUserId = userId || this.currentUser?.id;
      if (!targetUserId) {
        throw new Error('사용자 ID가 없습니다.');
      }

      console.log('🔍 ProjectService: Loading user projects for:', targetUserId);
      const result = await dbManager.getUserProjects(targetUserId);
      
      if (result.error) {
        this.emit('error', { operation: 'getUserProjects', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('projectsLoaded', { projects: result.data, userId: targetUserId });
      eventBus.emit(eventBus.EVENTS.PROJECT_LIST_LOADED, { projects: result.data, userId: targetUserId });
      return { success: true, data: result.data };
      
    } catch (error) {
      console.error('❌ ProjectService: Failed to load user projects:', error);
      this.emit('error', { operation: 'getUserProjects', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트 생성
   */
  async createProject(projectData) {
    try {
      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      // 프로젝트 데이터 검증
      if (!projectData.name || !projectData.name.trim()) {
        throw new Error('프로젝트 이름은 필수입니다.');
      }

      const newProjectData = {
        ...projectData,
        name: projectData.name.trim(),
        created_by: this.currentUser.id,
        owner_id: this.currentUser.id
      };

      console.log('✨ ProjectService: Creating project:', newProjectData.name);
      const result = await dbManager.createProject(newProjectData);

      if (result.error) {
        this.emit('error', { operation: 'createProject', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('projectCreated', { project: result.data });
      eventBus.emit(eventBus.EVENTS.PROJECT_CREATED, { project: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ ProjectService: Failed to create project:', error);
      this.emit('error', { operation: 'createProject', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트 데이터 조회 (폴더 및 다이어그램 포함)
   */
  async getProjectData(projectId) {
    try {
      if (!projectId) {
        throw new Error('프로젝트 ID가 없습니다.');
      }

      console.log('📂 ProjectService: Loading project data for:', projectId);
      
      // 병렬로 데이터 로드
      const [foldersResult, diagramsResult] = await Promise.all([
        dbManager.getProjectFolders(projectId),
        dbManager.getProjectDiagrams(projectId)
      ]);

      if (foldersResult.error) {
        throw new Error(`폴더 로드 실패: ${foldersResult.error.message || foldersResult.error}`);
      }

      if (diagramsResult.error) {
        throw new Error(`다이어그램 로드 실패: ${diagramsResult.error.message || diagramsResult.error}`);
      }

      const projectData = {
        id: projectId,
        folders: foldersResult.data || [],
        diagrams: diagramsResult.data || []
      };

      this.emit('projectDataLoaded', { projectId, projectData });
      return { success: true, data: projectData };

    } catch (error) {
      console.error('❌ ProjectService: Failed to load project data:', error);
      this.emit('error', { operation: 'getProjectData', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트 업데이트
   */
  async updateProject(projectId, updates) {
    try {
      if (!projectId) {
        throw new Error('프로젝트 ID가 없습니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const updateData = {
        ...updates,
        last_modified_by: this.currentUser.id,
        updated_at: new Date().toISOString()
      };

      console.log('📝 ProjectService: Updating project:', projectId);
      const result = await dbManager.updateProject(projectId, updateData);

      if (result.error) {
        this.emit('error', { operation: 'updateProject', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('projectUpdated', { projectId, updates: updateData, result: result.data });
      eventBus.emit(eventBus.EVENTS.PROJECT_UPDATED, { projectId, updates: updateData, result: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ ProjectService: Failed to update project:', error);
      this.emit('error', { operation: 'updateProject', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId) {
    try {
      if (!projectId) {
        throw new Error('프로젝트 ID가 없습니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      console.log('🗑️ ProjectService: Deleting project:', projectId);
      const result = await dbManager.deleteProject(projectId);

      if (result.error) {
        this.emit('error', { operation: 'deleteProject', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('projectDeleted', { projectId });
      eventBus.emit(eventBus.EVENTS.PROJECT_DELETED, { projectId });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ ProjectService: Failed to delete project:', error);
      this.emit('error', { operation: 'deleteProject', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 서비스 상태 확인
   */
  getServiceStatus() {
    return {
      isReady: !!this.currentUser,
      currentUser: this.currentUser?.email || null,
      hasDatabase: !!dbManager
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.currentUser = null;
    this.removeAllListeners();
    console.log('🗑️ ProjectService destroyed');
  }
}

// 싱글톤 인스턴스
export const projectService = new ProjectService();
export default projectService;