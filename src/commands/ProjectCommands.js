import { Command } from '../lib/CommandManager.js';
import { projectService } from '../services/ProjectService.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 프로젝트 생성 명령
 */
export class CreateProjectCommand extends Command {
  constructor(projectData) {
    super('CreateProject', `프로젝트 "${projectData.name}" 생성`);
    this.projectData = projectData;
    this.createdProject = null;
  }

  async execute() {
    const result = await projectService.createProject(this.projectData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.createdProject = result.data;
    
    // EventBus로 프로젝트 생성 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_CREATED, { project: this.createdProject });
    
    return this.createdProject;
  }

  async undo() {
    if (!this.createdProject) {
      throw new Error('No project to undo');
    }
    
    const result = await projectService.deleteProject(this.createdProject.id);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 프로젝트 삭제 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_DELETED, { projectId: this.createdProject.id });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.createdProject !== null;
  }
}

/**
 * 프로젝트 업데이트 명령
 */
export class UpdateProjectCommand extends Command {
  constructor(projectId, updates) {
    super('UpdateProject', `프로젝트 업데이트`);
    this.projectId = projectId;
    this.updates = updates;
    this.originalData = null;
    this.updatedProject = null;
  }

  async execute() {
    // 원본 데이터 백업을 위해 현재 프로젝트 정보 가져오기
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.id === this.projectId) {
      this.originalData = { ...appManager.currentProject };
    }
    
    const result = await projectService.updateProject(this.projectId, this.updates);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.updatedProject = result.data;
    
    // EventBus로 프로젝트 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_UPDATED, { 
      projectId: this.projectId, 
      updates: this.updates,
      result: this.updatedProject
    });
    
    return this.updatedProject;
  }

  async undo() {
    if (!this.originalData) {
      throw new Error('No original data to restore');
    }
    
    // 원본 데이터로 복원
    const restoreUpdates = {
      name: this.originalData.name,
      description: this.originalData.description,
      // 필요한 다른 필드들도 추가
    };
    
    const result = await projectService.updateProject(this.projectId, restoreUpdates);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 프로젝트 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_UPDATED, { 
      projectId: this.projectId, 
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
 * 프로젝트 삭제 명령
 */
export class DeleteProjectCommand extends Command {
  constructor(projectId) {
    super('DeleteProject', `프로젝트 삭제`);
    this.projectId = projectId;
    this.deletedProject = null;
  }

  async execute() {
    // 삭제 전 프로젝트 정보 백업
    const appManager = window.appManager;
    if (appManager && appManager.projects) {
      this.deletedProject = appManager.projects.find(p => p.id === this.projectId);
    }
    
    const result = await projectService.deleteProject(this.projectId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 프로젝트 삭제 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_DELETED, { projectId: this.projectId });
    
    return result.data;
  }

  async undo() {
    if (!this.deletedProject) {
      throw new Error('No project data to restore');
    }
    
    // 프로젝트 재생성 (삭제 취소)
    const restoreData = {
      name: this.deletedProject.name,
      description: this.deletedProject.description,
      // 필요한 다른 필드들도 추가
    };
    
    const result = await projectService.createProject(restoreData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 프로젝트 생성 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_CREATED, { project: result.data });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.deletedProject !== null;
  }
}

/**
 * 프로젝트 선택 명령
 */
export class SelectProjectCommand extends Command {
  constructor(project) {
    super('SelectProject', `프로젝트 "${project.name}" 선택`);
    this.project = project;
    this.previousProject = null;
  }

  async execute() {
    const appManager = window.appManager;
    if (!appManager) {
      throw new Error('AppManager not found');
    }
    
    // 이전 프로젝트 백업
    this.previousProject = appManager.currentProject;
    
    // 프로젝트 선택
    appManager.currentProject = this.project;
    
    // EventBus로 프로젝트 선택 이벤트 발생
    eventBus.emit(eventBus.EVENTS.PROJECT_SELECTED, { project: this.project });
    
    return this.project;
  }

  async undo() {
    const appManager = window.appManager;
    if (!appManager) {
      throw new Error('AppManager not found');
    }
    
    // 이전 프로젝트로 복원
    appManager.currentProject = this.previousProject;
    
    if (this.previousProject) {
      // EventBus로 프로젝트 선택 이벤트 발생
      eventBus.emit(eventBus.EVENTS.PROJECT_SELECTED, { project: this.previousProject });
    }
    
    return this.previousProject;
  }

  canUndo() {
    return super.canUndo();
  }
}

/**
 * 프로젝트 명령들을 쉽게 사용할 수 있는 팩토리 함수들
 */
export const ProjectCommandFactory = {
  /**
   * 프로젝트 생성 명령 생성
   */
  createProject(projectData) {
    return new CreateProjectCommand(projectData);
  },

  /**
   * 프로젝트 업데이트 명령 생성
   */
  updateProject(projectId, updates) {
    return new UpdateProjectCommand(projectId, updates);
  },

  /**
   * 프로젝트 삭제 명령 생성
   */
  deleteProject(projectId) {
    return new DeleteProjectCommand(projectId);
  },

  /**
   * 프로젝트 선택 명령 생성
   */
  selectProject(project) {
    return new SelectProjectCommand(project);
  }
};