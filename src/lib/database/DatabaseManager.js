import { EventEmitter } from 'events';
import { ConnectionManager } from './ConnectionManager.js';
import { ProjectRepository } from './ProjectRepository.js';
import { DiagramRepository } from './DiagramRepository.js';
import { FolderRepository } from './FolderRepository.js';

/**
 * 데이터베이스 관리 메인 오케스트레이터 클래스
 * 4개의 전문화된 저장소를 조합하여 기존 DatabaseManager와 동일한 기능 제공
 */
export class DatabaseManager extends EventEmitter {
  constructor() {
    super();
    
    // 전문화된 저장소들
    this.connectionManager = new ConnectionManager();
    this.projectRepository = new ProjectRepository(this.connectionManager);
    this.diagramRepository = new DiagramRepository(this.connectionManager);
    this.folderRepository = new FolderRepository(this.connectionManager);
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    console.log('🔧 DatabaseManager initialized');
    
    // 레포지토리 간 이벤트 연결 설정
    this.setupRepositoryIntegration();
    
    this.emit('databaseManagerInitialized');
  }

  /**
   * 저장소 간 통신 및 이벤트 연결 설정
   */
  setupRepositoryIntegration() {
    // ConnectionManager 이벤트
    this.connectionManager.on('connectionTestSucceeded', () => {
      this.emit('connectionTestSucceeded');
    });
    
    this.connectionManager.on('connectionTestFailed', (error) => {
      this.emit('connectionTestFailed', error);
    });
    
    this.connectionManager.on('modeChanged', (mode) => {
      console.log(`🔄 Database mode changed to: ${mode}`);
      this.emit('modeChanged', mode);
    });
    
    // ProjectRepository 이벤트
    this.projectRepository.on('projectCreated', (project) => {
      this.emit('projectCreated', project);
    });
    
    this.projectRepository.on('userProjectsLoaded', (data) => {
      this.emit('userProjectsLoaded', data);
    });
    
    this.projectRepository.on('projectMemberAdded', (member) => {
      this.emit('projectMemberAdded', member);
    });
    
    // DiagramRepository 이벤트
    this.diagramRepository.on('diagramCreated', (diagram) => {
      this.emit('diagramCreated', diagram);
    });
    
    this.diagramRepository.on('diagramUpdated', (diagram) => {
      this.emit('diagramUpdated', diagram);
    });
    
    this.diagramRepository.on('projectDiagramsFetched', (data) => {
      this.emit('projectDiagramsFetched', data);
    });
    
    // FolderRepository 이벤트
    this.folderRepository.on('folderCreated', (folder) => {
      this.emit('folderCreated', folder);
    });
    
    this.folderRepository.on('folderUpdated', (folder) => {
      this.emit('folderUpdated', folder);
    });
    
    this.folderRepository.on('projectFoldersFetched', (data) => {
      this.emit('projectFoldersFetched', data);
    });
  }

  // ===== 연결 관리 메소드들 (ConnectionManager 위임) =====

  /**
   * 데이터베이스 연결 테스트
   */
  async testConnection() {
    return await this.connectionManager.testConnection();
  }

  /**
   * 로컬 모드 여부 확인
   */
  isLocalMode() {
    return this.connectionManager.isLocalMode();
  }

  /**
   * 연결 상태 반환
   */
  getConnectionStatus() {
    return this.connectionManager.getConnectionStatus();
  }

  /**
   * 사용자 프로필 업서트
   */
  async upsertProfile(profile) {
    return await this.connectionManager.upsertProfile(profile);
  }

  // ===== 프로젝트 관련 메소드들 (ProjectRepository 위임) =====

  /**
   * 프로젝트 생성
   */
  async createProject(projectData) {
    return await this.projectRepository.createProject(projectData);
  }

  /**
   * 사용자 프로젝트 목록 가져오기
   */
  async getUserProjects(userId) {
    return await this.projectRepository.getUserProjects(userId);
  }

  /**
   * 프로젝트 업데이트
   */
  async updateProject(projectId, updates) {
    return await this.projectRepository.updateProject(projectId, updates);
  }

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId) {
    return await this.projectRepository.deleteProject(projectId);
  }

  /**
   * 특정 프로젝트 가져오기
   */
  async getProject(projectId) {
    return await this.projectRepository.getProject(projectId);
  }

  /**
   * 프로젝트 멤버 추가
   */
  async addProjectMember(memberData) {
    return await this.projectRepository.addProjectMember(memberData);
  }

  /**
   * 프로젝트 멤버 목록 가져오기
   */
  async getProjectMembers(projectId) {
    return await this.projectRepository.getProjectMembers(projectId);
  }

  /**
   * 프로젝트 멤버 역할 업데이트
   */
  async updateProjectMemberRole(projectId, userId, newRole) {
    return await this.projectRepository.updateProjectMemberRole(projectId, userId, newRole);
  }

  /**
   * 프로젝트 멤버 제거
   */
  async removeProjectMember(projectId, userId) {
    return await this.projectRepository.removeProjectMember(projectId, userId);
  }

  // ===== 다이어그램 관련 메소드들 (DiagramRepository 위임) =====

  /**
   * 프로젝트 다이어그램 목록 가져오기
   */
  async getProjectDiagrams(projectId) {
    return await this.diagramRepository.getProjectDiagrams(projectId);
  }

  /**
   * 다이어그램 생성
   */
  async createDiagram(diagramData) {
    return await this.diagramRepository.createDiagram(diagramData);
  }

  /**
   * 다이어그램 업데이트
   */
  async updateDiagram(diagramId, updates) {
    return await this.diagramRepository.updateDiagram(diagramId, updates);
  }

  /**
   * 다이어그램 가져오기
   */
  async getDiagram(diagramId) {
    return await this.diagramRepository.getDiagram(diagramId);
  }

  /**
   * 다이어그램 삭제
   */
  async deleteDiagram(diagramId) {
    return await this.diagramRepository.deleteDiagram(diagramId);
  }

  /**
   * 다이어그램 복사
   */
  async copyDiagram(diagramId, newName) {
    return await this.diagramRepository.copyDiagram(diagramId, newName);
  }

  /**
   * 협업 세션 업서트
   */
  async upsertCollaborationSession(sessionData) {
    return await this.diagramRepository.upsertCollaborationSession(sessionData);
  }

  /**
   * 활성 협업 세션 가져오기
   */
  async getActiveCollaborationSessions(diagramId) {
    return await this.diagramRepository.getActiveCollaborationSessions(diagramId);
  }

  /**
   * 활동 로그 생성
   */
  async createActivityLog(logData) {
    return await this.diagramRepository.createActivityLog(logData);
  }

  // ===== 폴더 관련 메소드들 (FolderRepository 위임) =====

  /**
   * 폴더 생성
   */
  async createFolder(folderData) {
    return await this.folderRepository.createFolder(folderData);
  }

  /**
   * 프로젝트 폴더 목록 가져오기
   */
  async getProjectFolders(projectId) {
    return await this.folderRepository.getProjectFolders(projectId);
  }

  /**
   * 폴더 업데이트
   */
  async updateFolder(folderId, updates) {
    return await this.folderRepository.updateFolder(folderId, updates);
  }

  /**
   * 폴더 삭제
   */
  async deleteFolder(folderId) {
    return await this.folderRepository.deleteFolder(folderId);
  }

  /**
   * 폴더 이름 변경
   */
  async renameFolder(folderId, newName) {
    return await this.folderRepository.renameFolder(folderId, newName);
  }

  /**
   * 특정 폴더 가져오기
   */
  async getFolder(folderId) {
    return await this.folderRepository.getFolder(folderId);
  }

  /**
   * 폴더 이동
   */
  async moveFolder(folderId, newParentId) {
    return await this.folderRepository.moveFolder(folderId, newParentId);
  }

  /**
   * 폴더 통계 정보
   */
  async getFolderStats(folderId) {
    return await this.folderRepository.getFolderStats(folderId);
  }

  // ===== 순서 관리 메소드들 =====

  /**
   * 혼합 항목 순서 업데이트 (폴더 + 다이어그램)
   */
  async updateItemOrder(items) {
    // FolderRepository에서 혼합 순서 업데이트 처리
    return await this.folderRepository.updateItemOrder(items);
  }

  /**
   * 폴더 순서 업데이트
   */
  async updateFolderOrder(folders) {
    return await this.folderRepository.updateFolderOrder(folders);
  }

  /**
   * 다이어그램 순서 업데이트
   */
  async updateDiagramOrder(diagrams) {
    return await this.diagramRepository.updateDiagramOrder(diagrams);
  }

  // ===== 고급 기능들 =====

  /**
   * 배치 작업 실행 (여러 작업을 하나의 트랜잭션으로)
   */
  async executeBatch(operations) {
    return await this.connectionManager.executeBatch(operations);
  }

  /**
   * 프로젝트 전체 데이터 가져오기 (폴더 + 다이어그램)
   */
  async getProjectData(projectId) {
    try {
      console.log('📊 Loading complete project data for:', projectId);
      
      // 폴더와 다이어그램 병렬 로드
      const [foldersResult, diagramsResult] = await Promise.all([
        this.getProjectFolders(projectId),
        this.getProjectDiagrams(projectId)
      ]);
      
      const result = {
        folders: foldersResult.data || [],
        diagrams: diagramsResult.data || [],
        errors: []
      };
      
      if (foldersResult.error) {
        result.errors.push({ type: 'folders', error: foldersResult.error });
      }
      
      if (diagramsResult.error) {
        result.errors.push({ type: 'diagrams', error: diagramsResult.error });
      }
      
      console.log(`✅ Project data loaded: ${result.folders.length} folders, ${result.diagrams.length} diagrams`);
      this.emit('projectDataLoaded', { projectId, ...result });
      
      return { data: result, error: result.errors.length > 0 ? result.errors : null };
      
    } catch (error) {
      console.error('Project data load error:', error);
      return { data: null, error };
    }
  }

  /**
   * 프로젝트 데이터 검색
   */
  async searchProjectContent(projectId, searchTerm) {
    try {
      console.log('🔍 Searching project content:', { projectId, searchTerm });
      
      // 프로젝트 데이터 가져오기
      const { data: projectData, error } = await this.getProjectData(projectId);
      
      if (error) {
        return { data: [], error };
      }
      
      const results = [];
      const term = searchTerm.toLowerCase();
      
      // 폴더 검색
      projectData.folders.forEach(folder => {
        if (folder.name.toLowerCase().includes(term)) {
          results.push({
            type: 'folder',
            id: folder.id,
            name: folder.name,
            match: 'name'
          });
        }
      });
      
      // 다이어그램 검색
      projectData.diagrams.forEach(diagram => {
        if (diagram.name.toLowerCase().includes(term)) {
          results.push({
            type: 'diagram',
            id: diagram.id,
            name: diagram.name,
            match: 'name'
          });
        }
        
        if (diagram.description && diagram.description.toLowerCase().includes(term)) {
          results.push({
            type: 'diagram',
            id: diagram.id,
            name: diagram.name,
            match: 'description'
          });
        }
      });
      
      this.emit('projectContentSearched', { projectId, searchTerm, results });
      return { data: results, error: null };
      
    } catch (error) {
      console.error('Project content search error:', error);
      return { data: [], error };
    }
  }

  /**
   * 프로젝트 내보내기 (JSON 형태)
   */
  async exportProject(projectId) {
    try {
      console.log('📤 Exporting project:', projectId);
      
      const [projectResult, projectDataResult] = await Promise.all([
        this.getProject(projectId),
        this.getProjectData(projectId)
      ]);
      
      if (projectResult.error || projectDataResult.error) {
        return { data: null, error: projectResult.error || projectDataResult.error };
      }
      
      const exportData = {
        project: projectResult.data,
        folders: projectDataResult.data.folders,
        diagrams: projectDataResult.data.diagrams,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      this.emit('projectExported', { projectId, exportData });
      return { data: exportData, error: null };
      
    } catch (error) {
      console.error('Project export error:', error);
      return { data: null, error };
    }
  }

  // ===== 레거시 호환성 메소드들 =====

  /**
   * 강제 로컬 모드 상태 (기존 호환성)
   */
  get forceLocalMode() {
    return this.connectionManager.isLocalMode();
  }

  /**
   * Supabase 인스턴스 (기존 호환성)
   */
  get supabase() {
    return this.connectionManager.supabase;
  }

  // ===== 개발자 도구 메소드들 =====

  /**
   * 로컬 모드로 전환
   */
  enableLocalMode() {
    this.connectionManager.enableLocalMode();
  }

  /**
   * 데이터베이스 모드로 전환
   */
  enableDatabaseMode() {
    this.connectionManager.enableDatabaseMode();
  }

  /**
   * 즉시 데이터베이스 모드로 전환
   */
  switchToDatabaseModeImmediate() {
    return this.connectionManager.switchToDatabaseModeImmediate();
  }

  /**
   * 로컬 데이터 정리
   */
  clearLocalData() {
    this.connectionManager.clearLocalData();
  }

  /**
   * 디버그 정보 반환
   */
  getDebugInfo() {
    return this.connectionManager.getDebugInfo();
  }

  /**
   * 상태 정보 반환 (모든 컴포넌트)
   */
  getFullStatus() {
    return {
      connection: this.connectionManager.getConnectionStatus(),
      debug: this.connectionManager.getDebugInfo(),
      repositories: {
        project: !!this.projectRepository,
        diagram: !!this.diagramRepository,
        folder: !!this.folderRepository
      },
      mode: this.connectionManager.isLocalMode() ? 'local' : 'database'
    };
  }

  /**
   * 연결 재시도
   */
  async retryConnection() {
    return await this.connectionManager.retryConnection();
  }

  /**
   * 리소스 정리
   */
  destroy() {
    console.log('🗑️ Destroying DatabaseManager...');
    
    // 저장소들 정리
    this.connectionManager?.destroy();
    this.projectRepository?.destroy();
    this.diagramRepository?.destroy();
    this.folderRepository?.destroy();
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    console.log('✅ DatabaseManager destroyed');
  }
}

// 싱글톤 인스턴스
export const dbManager = new DatabaseManager();

// 편의 함수들 (기존 호환성)
export const testDatabaseConnection = () => dbManager.testConnection();
export const createProject = (projectData) => dbManager.createProject(projectData);
export const getUserProjects = (userId) => dbManager.getUserProjects(userId);
export const createDiagram = (diagramData) => dbManager.createDiagram(diagramData);
export const updateDiagram = (diagramId, updates) => dbManager.updateDiagram(diagramId, updates);
export const getDiagram = (diagramId) => dbManager.getDiagram(diagramId);
export const getProjectDiagrams = (projectId) => dbManager.getProjectDiagrams(projectId);
export const createFolder = (folderData) => dbManager.createFolder(folderData);
export const getProjectFolders = (projectId) => dbManager.getProjectFolders(projectId);
export const deleteFolder = (folderId) => dbManager.deleteFolder(folderId);
export const renameFolder = (folderId, newName) => dbManager.renameFolder(folderId, newName);
export const updateFolder = (folderId, updates) => dbManager.updateFolder(folderId, updates);
export const deleteDiagram = (diagramId) => dbManager.deleteDiagram(diagramId);
export const updateItemOrder = (items) => dbManager.updateItemOrder(items);

// 개발자 도구용 전역 함수들 (기존 호환성)
window.enableLocalMode = () => {
  dbManager.enableLocalMode();
  console.log('🔧 Local mode enabled. Please refresh the page.');
  location.reload();
};

window.disableLocalMode = () => {
  dbManager.enableDatabaseMode();
  console.log('🌐 Database mode enabled. Please refresh the page.');
  location.reload();
};

window.switchToDatabaseMode = () => {
  const status = dbManager.switchToDatabaseModeImmediate();
  console.log('🌐 Switched to database mode immediately');
  console.log('🔧 Current status:', status);
};

window.clearLocalData = () => {
  dbManager.clearLocalData();
  console.log('🧹 Local data cleared.');
};

window.checkDatabaseStatus = () => {
  const status = dbManager.getFullStatus();
  console.log('=== DATABASE STATUS ===');
  console.log('Mode:', status.mode);
  console.log('Connection:', status.connection);
  console.log('Repositories:', status.repositories);
  console.log('Debug Info:', status.debug);
  console.log('========================');
};