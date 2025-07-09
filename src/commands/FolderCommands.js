import { Command } from '../lib/CommandManager.js';
import { folderService } from '../services/FolderService.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 폴더 생성 명령
 */
export class CreateFolderCommand extends Command {
  constructor(folderData) {
    super('CreateFolder', `폴더 "${folderData.name}" 생성`);
    this.folderData = folderData;
    this.createdFolder = null;
  }

  async execute() {
    const result = await folderService.createFolder(this.folderData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.createdFolder = result.data;
    
    // EventBus로 폴더 생성 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_CREATED, { folder: this.createdFolder });
    
    return this.createdFolder;
  }

  async undo() {
    if (!this.createdFolder) {
      throw new Error('No folder to undo');
    }
    
    const result = await folderService.deleteFolder(this.createdFolder.id);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 삭제 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_DELETED, { folderId: this.createdFolder.id });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.createdFolder !== null;
  }
}

/**
 * 폴더 업데이트 명령
 */
export class UpdateFolderCommand extends Command {
  constructor(folderId, updates) {
    super('UpdateFolder', `폴더 업데이트`);
    this.folderId = folderId;
    this.updates = updates;
    this.originalData = null;
    this.updatedFolder = null;
  }

  async execute() {
    // 원본 데이터 백업을 위해 현재 폴더 정보 가져오기
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.folders) {
      this.originalData = appManager.currentProject.folders.find(f => f.id === this.folderId);
      if (this.originalData) {
        this.originalData = { ...this.originalData };
      }
    }
    
    const result = await folderService.updateFolder(this.folderId, this.updates);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.updatedFolder = result.data;
    
    // EventBus로 폴더 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { 
      folderId: this.folderId, 
      updates: this.updates,
      result: this.updatedFolder
    });
    
    return this.updatedFolder;
  }

  async undo() {
    if (!this.originalData) {
      throw new Error('No original data to restore');
    }
    
    // 원본 데이터로 복원
    const restoreUpdates = {
      name: this.originalData.name,
      description: this.originalData.description,
      parent_id: this.originalData.parent_id,
      // 필요한 다른 필드들도 추가
    };
    
    const result = await folderService.updateFolder(this.folderId, restoreUpdates);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { 
      folderId: this.folderId, 
      updates: restoreUpdates,
      result: result.data
    });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.originalData !== null;
  }
}

/**
 * 폴더 삭제 명령
 */
export class DeleteFolderCommand extends Command {
  constructor(folderId) {
    super('DeleteFolder', `폴더 삭제`);
    this.folderId = folderId;
    this.deletedFolder = null;
  }

  async execute() {
    // 삭제 전 폴더 정보 백업
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.folders) {
      this.deletedFolder = appManager.currentProject.folders.find(f => f.id === this.folderId);
      if (this.deletedFolder) {
        this.deletedFolder = { ...this.deletedFolder };
      }
    }
    
    const result = await folderService.deleteFolder(this.folderId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 삭제 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_DELETED, { folderId: this.folderId });
    
    return result.data;
  }

  async undo() {
    if (!this.deletedFolder) {
      throw new Error('No folder data to restore');
    }
    
    // 폴더 재생성 (삭제 취소)
    const restoreData = {
      name: this.deletedFolder.name,
      description: this.deletedFolder.description,
      parent_id: this.deletedFolder.parent_id,
      project_id: this.deletedFolder.project_id,
    };
    
    const result = await folderService.createFolder(restoreData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 생성 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_CREATED, { folder: result.data });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.deletedFolder !== null;
  }
}

/**
 * 폴더 이름 변경 명령
 */
export class RenameFolderCommand extends Command {
  constructor(folderId, newName) {
    super('RenameFolder', `폴더 이름 변경`);
    this.folderId = folderId;
    this.newName = newName;
    this.originalName = null;
  }

  async execute() {
    // 원본 이름 백업
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.folders) {
      const folder = appManager.currentProject.folders.find(f => f.id === this.folderId);
      if (folder) {
        this.originalName = folder.name;
      }
    }
    
    const result = await folderService.updateFolder(this.folderId, { name: this.newName });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { 
      folderId: this.folderId, 
      updates: { name: this.newName },
      result: result.data
    });
    
    return result.data;
  }

  async undo() {
    if (!this.originalName) {
      throw new Error('No original name to restore');
    }
    
    const result = await folderService.updateFolder(this.folderId, { name: this.originalName });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { 
      folderId: this.folderId, 
      updates: { name: this.originalName },
      result: result.data
    });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.originalName !== null;
  }
}

/**
 * 폴더 이동 명령
 */
export class MoveFolderCommand extends Command {
  constructor(folderId, newParentId) {
    super('MoveFolder', `폴더 이동`);
    this.folderId = folderId;
    this.newParentId = newParentId;
    this.originalParentId = null;
  }

  async execute() {
    // 원본 부모 폴더 ID 백업
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.folders) {
      const folder = appManager.currentProject.folders.find(f => f.id === this.folderId);
      if (folder) {
        this.originalParentId = folder.parent_id;
      }
    }
    
    const result = await folderService.moveFolder(this.folderId, this.newParentId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { 
      folderId: this.folderId, 
      updates: { parent_id: this.newParentId },
      result: result.data
    });
    
    return result.data;
  }

  async undo() {
    const result = await folderService.moveFolder(this.folderId, this.originalParentId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 폴더 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.FOLDER_UPDATED, { 
      folderId: this.folderId, 
      updates: { parent_id: this.originalParentId },
      result: result.data
    });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo();
  }
}

/**
 * 폴더 명령들을 쉽게 사용할 수 있는 팩토리 함수들
 */
export const FolderCommandFactory = {
  /**
   * 폴더 생성 명령 생성
   */
  createFolder(folderData) {
    return new CreateFolderCommand(folderData);
  },

  /**
   * 폴더 업데이트 명령 생성
   */
  updateFolder(folderId, updates) {
    return new UpdateFolderCommand(folderId, updates);
  },

  /**
   * 폴더 삭제 명령 생성
   */
  deleteFolder(folderId) {
    return new DeleteFolderCommand(folderId);
  },

  /**
   * 폴더 이름 변경 명령 생성
   */
  renameFolder(folderId, newName) {
    return new RenameFolderCommand(folderId, newName);
  },

  /**
   * 폴더 이동 명령 생성
   */
  moveFolder(folderId, newParentId) {
    return new MoveFolderCommand(folderId, newParentId);
  }
};