import { Command } from '../lib/CommandManager.js';
import { diagramService } from '../services/DiagramService.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 다이어그램 생성 명령
 */
export class CreateDiagramCommand extends Command {
  constructor(diagramData) {
    super('CreateDiagram', `다이어그램 "${diagramData.name}" 생성`);
    this.diagramData = diagramData;
    this.createdDiagram = null;
  }

  async execute() {
    const result = await diagramService.createDiagram(this.diagramData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.createdDiagram = result.data;
    
    // EventBus로 다이어그램 생성 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_CREATED, { diagram: this.createdDiagram });
    
    return this.createdDiagram;
  }

  async undo() {
    if (!this.createdDiagram) {
      throw new Error('No diagram to undo');
    }
    
    const result = await diagramService.deleteDiagram(this.createdDiagram.id);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 삭제 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_DELETED, { diagramId: this.createdDiagram.id });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.createdDiagram !== null;
  }
}

/**
 * 다이어그램 업데이트 명령
 */
export class UpdateDiagramCommand extends Command {
  constructor(diagramId, updates) {
    super('UpdateDiagram', `다이어그램 업데이트`);
    this.diagramId = diagramId;
    this.updates = updates;
    this.originalData = null;
    this.updatedDiagram = null;
  }

  async execute() {
    // 원본 데이터 백업을 위해 현재 다이어그램 정보 가져오기
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.diagrams) {
      this.originalData = appManager.currentProject.diagrams.find(d => d.id === this.diagramId);
      if (this.originalData) {
        this.originalData = { ...this.originalData };
      }
    }
    
    const result = await diagramService.updateDiagram(this.diagramId, this.updates);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    this.updatedDiagram = result.data;
    
    // EventBus로 다이어그램 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { 
      diagramId: this.diagramId, 
      updates: this.updates,
      result: this.updatedDiagram
    });
    
    return this.updatedDiagram;
  }

  async undo() {
    if (!this.originalData) {
      throw new Error('No original data to restore');
    }
    
    // 원본 데이터로 복원
    const restoreUpdates = {
      name: this.originalData.name,
      description: this.originalData.description,
      bpmn_xml: this.originalData.bpmn_xml,
      folder_id: this.originalData.folder_id,
      // 필요한 다른 필드들도 추가
    };
    
    const result = await diagramService.updateDiagram(this.diagramId, restoreUpdates);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { 
      diagramId: this.diagramId, 
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
 * 다이어그램 삭제 명령
 */
export class DeleteDiagramCommand extends Command {
  constructor(diagramId) {
    super('DeleteDiagram', `다이어그램 삭제`);
    this.diagramId = diagramId;
    this.deletedDiagram = null;
  }

  async execute() {
    // 삭제 전 다이어그램 정보 백업
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.diagrams) {
      this.deletedDiagram = appManager.currentProject.diagrams.find(d => d.id === this.diagramId);
      if (this.deletedDiagram) {
        this.deletedDiagram = { ...this.deletedDiagram };
      }
    }
    
    const result = await diagramService.deleteDiagram(this.diagramId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 삭제 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_DELETED, { diagramId: this.diagramId });
    
    return result.data;
  }

  async undo() {
    if (!this.deletedDiagram) {
      throw new Error('No diagram data to restore');
    }
    
    // 다이어그램 재생성 (삭제 취소)
    const restoreData = {
      name: this.deletedDiagram.name,
      description: this.deletedDiagram.description,
      folder_id: this.deletedDiagram.folder_id,
      bpmn_xml: this.deletedDiagram.bpmn_xml,
    };
    
    const result = await diagramService.createDiagram(restoreData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 생성 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_CREATED, { diagram: result.data });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo() && this.deletedDiagram !== null;
  }
}

/**
 * 다이어그램 이름 변경 명령
 */
export class RenameDiagramCommand extends Command {
  constructor(diagramId, newName) {
    super('RenameDiagram', `다이어그램 이름 변경`);
    this.diagramId = diagramId;
    this.newName = newName;
    this.originalName = null;
  }

  async execute() {
    // 원본 이름 백업
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.diagrams) {
      const diagram = appManager.currentProject.diagrams.find(d => d.id === this.diagramId);
      if (diagram) {
        this.originalName = diagram.name;
      }
    }
    
    const result = await diagramService.renameDiagram(this.diagramId, this.newName);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { 
      diagramId: this.diagramId, 
      updates: { name: this.newName },
      result: result.data
    });
    
    return result.data;
  }

  async undo() {
    if (!this.originalName) {
      throw new Error('No original name to restore');
    }
    
    const result = await diagramService.renameDiagram(this.diagramId, this.originalName);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { 
      diagramId: this.diagramId, 
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
 * 다이어그램 이동 명령
 */
export class MoveDiagramCommand extends Command {
  constructor(diagramId, newFolderId) {
    super('MoveDiagram', `다이어그램 이동`);
    this.diagramId = diagramId;
    this.newFolderId = newFolderId;
    this.originalFolderId = null;
  }

  async execute() {
    // 원본 폴더 ID 백업
    const appManager = window.appManager;
    if (appManager && appManager.currentProject && appManager.currentProject.diagrams) {
      const diagram = appManager.currentProject.diagrams.find(d => d.id === this.diagramId);
      if (diagram) {
        this.originalFolderId = diagram.folder_id;
      }
    }
    
    const result = await diagramService.moveDiagram(this.diagramId, this.newFolderId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { 
      diagramId: this.diagramId, 
      updates: { folder_id: this.newFolderId },
      result: result.data
    });
    
    return result.data;
  }

  async undo() {
    const result = await diagramService.moveDiagram(this.diagramId, this.originalFolderId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // EventBus로 다이어그램 업데이트 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { 
      diagramId: this.diagramId, 
      updates: { folder_id: this.originalFolderId },
      result: result.data
    });
    
    return result.data;
  }

  canUndo() {
    return super.canUndo();
  }
}

/**
 * 다이어그램 열기 명령
 */
export class OpenDiagramCommand extends Command {
  constructor(diagram) {
    super('OpenDiagram', `다이어그램 "${diagram.name}" 열기`);
    this.diagram = diagram;
    this.previousDiagram = null;
  }

  async execute() {
    const appManager = window.appManager;
    if (!appManager || !appManager.bpmnEditor) {
      throw new Error('BPMN Editor not found');
    }
    
    // 이전 다이어그램 백업
    this.previousDiagram = appManager.bpmnEditor.getCurrentDiagram();
    
    // 다이어그램 열기
    await appManager.bpmnEditor.openDiagram(this.diagram);
    
    // EventBus로 다이어그램 열기 이벤트 발생
    eventBus.emit(eventBus.EVENTS.DIAGRAM_OPENED, { diagram: this.diagram });
    
    return this.diagram;
  }

  async undo() {
    const appManager = window.appManager;
    if (!appManager || !appManager.bpmnEditor) {
      throw new Error('BPMN Editor not found');
    }
    
    if (this.previousDiagram) {
      // 이전 다이어그램으로 복원
      await appManager.bpmnEditor.openDiagram(this.previousDiagram);
      eventBus.emit(eventBus.EVENTS.DIAGRAM_OPENED, { diagram: this.previousDiagram });
    } else {
      // 다이어그램 닫기
      await appManager.bpmnEditor.closeDiagram();
      eventBus.emit(eventBus.EVENTS.DIAGRAM_CLOSED, { diagram: this.diagram });
    }
    
    return this.previousDiagram;
  }

  canUndo() {
    return super.canUndo();
  }
}

/**
 * 다이어그램 명령들을 쉽게 사용할 수 있는 팩토리 함수들
 */
export const DiagramCommandFactory = {
  /**
   * 다이어그램 생성 명령 생성
   */
  createDiagram(diagramData) {
    return new CreateDiagramCommand(diagramData);
  },

  /**
   * 다이어그램 업데이트 명령 생성
   */
  updateDiagram(diagramId, updates) {
    return new UpdateDiagramCommand(diagramId, updates);
  },

  /**
   * 다이어그램 삭제 명령 생성
   */
  deleteDiagram(diagramId) {
    return new DeleteDiagramCommand(diagramId);
  },

  /**
   * 다이어그램 이름 변경 명령 생성
   */
  renameDiagram(diagramId, newName) {
    return new RenameDiagramCommand(diagramId, newName);
  },

  /**
   * 다이어그램 이동 명령 생성
   */
  moveDiagram(diagramId, newFolderId) {
    return new MoveDiagramCommand(diagramId, newFolderId);
  },

  /**
   * 다이어그램 열기 명령 생성
   */
  openDiagram(diagram) {
    return new OpenDiagramCommand(diagram);
  }
};