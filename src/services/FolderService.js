import { EventEmitter } from 'events';
import { dbManager } from '../lib/database.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 폴더 관련 비즈니스 로직을 담당하는 서비스 클래스
 * UI 컴포넌트와 데이터베이스 사이의 중간 계층 역할
 */
export class FolderService extends EventEmitter {
  constructor() {
    super();
    this.currentUser = null;
    this.currentProject = null;
  }

  /**
   * 현재 사용자 설정
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * 현재 프로젝트 설정
   */
  setCurrentProject(project) {
    this.currentProject = project;
  }

  /**
   * 폴더 생성
   */
  async createFolder(folderData) {
    try {
      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      if (!this.currentProject) {
        throw new Error('프로젝트가 선택되지 않았습니다.');
      }

      // 폴더 데이터 검증
      if (!folderData.name || !folderData.name.trim()) {
        throw new Error('폴더 이름은 필수입니다.');
      }

      const newFolderData = {
        name: folderData.name.trim(),
        project_id: this.currentProject.id,
        parent_id: folderData.parent_id || null,
        description: folderData.description || '',
        created_by: this.currentUser.id
      };

      console.log('📁 FolderService: Creating folder:', newFolderData.name);
      const result = await dbManager.createFolder(newFolderData);

      if (result.error) {
        this.emit('error', { operation: 'createFolder', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('folderCreated', { folder: result.data });
      eventBus.emit(eventBus.EVENTS.FOLDER_CREATED, { folder: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ FolderService: Failed to create folder:', error);
      this.emit('error', { operation: 'createFolder', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 폴더 이름 변경
   */
  async renameFolder(folderId, newName) {
    try {
      if (!folderId) {
        throw new Error('폴더 ID가 없습니다.');
      }

      if (!newName || !newName.trim()) {
        throw new Error('새 이름은 필수입니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      console.log('📝 FolderService: Renaming folder:', folderId, 'to:', newName);
      const result = await dbManager.renameFolder(folderId, newName.trim());

      if (result.error) {
        this.emit('error', { operation: 'renameFolder', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('folderRenamed', { folderId, newName: newName.trim(), result: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ FolderService: Failed to rename folder:', error);
      this.emit('error', { operation: 'renameFolder', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 폴더 업데이트
   */
  async updateFolder(folderId, updates) {
    try {
      if (!folderId) {
        throw new Error('폴더 ID가 없습니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      console.log('📝 FolderService: Updating folder:', folderId);
      const result = await dbManager.updateFolder(folderId, updateData);

      if (result.error) {
        this.emit('error', { operation: 'updateFolder', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('folderUpdated', { folderId, updates: updateData, result: result.data });
      eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { folderId, updates: updateData, result: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ FolderService: Failed to update folder:', error);
      this.emit('error', { operation: 'updateFolder', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 폴더 삭제
   */
  async deleteFolder(folderId) {
    try {
      if (!folderId) {
        throw new Error('폴더 ID가 없습니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      console.log('🗑️ FolderService: Deleting folder:', folderId);
      const result = await dbManager.deleteFolder(folderId);

      if (result.error) {
        this.emit('error', { operation: 'deleteFolder', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('folderDeleted', { folderId });
      eventBus.emit(eventBus.EVENTS.FOLDER_DELETED, { folderId });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ FolderService: Failed to delete folder:', error);
      this.emit('error', { operation: 'deleteFolder', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 폴더 이동 (부모 폴더 변경)
   */
  async moveFolder(folderId, newParentId) {
    try {
      return await this.updateFolder(folderId, { 
        parent_id: newParentId 
      });

    } catch (error) {
      console.error('❌ FolderService: Failed to move folder:', error);
      this.emit('error', { operation: 'moveFolder', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트의 모든 폴더 조회
   */
  async getProjectFolders(projectId = null) {
    try {
      const targetProjectId = projectId || this.currentProject?.id;
      if (!targetProjectId) {
        throw new Error('프로젝트 ID가 없습니다.');
      }

      console.log('📂 FolderService: Loading project folders for:', targetProjectId);
      const result = await dbManager.getProjectFolders(targetProjectId);

      if (result.error) {
        this.emit('error', { operation: 'getProjectFolders', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('projectFoldersLoaded', { projectId: targetProjectId, folders: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ FolderService: Failed to load project folders:', error);
      this.emit('error', { operation: 'getProjectFolders', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 폴더 계층 구조 검증 (순환 참조 방지)
   */
  validateFolderHierarchy(folderId, newParentId, allFolders) {
    if (!newParentId) return true; // 루트로 이동하는 경우는 항상 유효
    if (folderId === newParentId) return false; // 자기 자신을 부모로 설정 불가

    // 새 부모가 현재 폴더의 하위 폴더인지 확인
    let current = newParentId;
    const visited = new Set();
    
    while (current && !visited.has(current)) {
      visited.add(current);
      const parentFolder = allFolders.find(f => f.id === current);
      if (!parentFolder) break;
      
      if (parentFolder.parent_id === folderId) {
        return false; // 순환 참조 발견
      }
      
      current = parentFolder.parent_id;
    }

    return true;
  }

  /**
   * 서비스 상태 확인
   */
  getServiceStatus() {
    return {
      isReady: !!this.currentUser && !!this.currentProject,
      currentUser: this.currentUser?.email || null,
      currentProject: this.currentProject?.name || null,
      hasDatabase: !!dbManager
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.currentUser = null;
    this.currentProject = null;
    this.removeAllListeners();
    console.log('🗑️ FolderService destroyed');
  }
}

// 싱글톤 인스턴스
export const folderService = new FolderService();
export default folderService;