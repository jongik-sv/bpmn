import { EventEmitter } from 'events';
import { dbManager } from '../lib/database.js';
import { eventBus } from '../lib/EventBus.js';

/**
 * 다이어그램 관련 비즈니스 로직을 담당하는 서비스 클래스
 * UI 컴포넌트와 데이터베이스 사이의 중간 계층 역할
 */
export class DiagramService extends EventEmitter {
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
   * 다이어그램 생성
   */
  async createDiagram(diagramData) {
    try {
      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      if (!this.currentProject) {
        throw new Error('프로젝트가 선택되지 않았습니다.');
      }

      // 다이어그램 데이터 검증
      if (!diagramData.name || !diagramData.name.trim()) {
        throw new Error('다이어그램 이름은 필수입니다.');
      }

      const newDiagramData = {
        name: diagramData.name.trim(),
        project_id: this.currentProject.id,
        folder_id: diagramData.folder_id || null,
        description: diagramData.description || '',
        bpmn_xml: diagramData.bpmn_xml || this.getDefaultBpmnXml(),
        created_by: this.currentUser.id,
        last_modified_by: this.currentUser.id
      };

      console.log('✨ DiagramService: Creating diagram:', newDiagramData.name);
      const result = await dbManager.createDiagram(newDiagramData);

      if (result.error) {
        this.emit('error', { operation: 'createDiagram', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('diagramCreated', { diagram: result.data });
      eventBus.emit(eventBus.EVENTS.DIAGRAM_CREATED, { diagram: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ DiagramService: Failed to create diagram:', error);
      this.emit('error', { operation: 'createDiagram', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 다이어그램 조회
   */
  async getDiagram(diagramId) {
    try {
      if (!diagramId) {
        throw new Error('다이어그램 ID가 없습니다.');
      }

      console.log('📋 DiagramService: Loading diagram:', diagramId);
      const result = await dbManager.getDiagram(diagramId);

      if (result.error) {
        this.emit('error', { operation: 'getDiagram', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('diagramLoaded', { diagram: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ DiagramService: Failed to load diagram:', error);
      this.emit('error', { operation: 'getDiagram', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 다이어그램 업데이트
   */
  async updateDiagram(diagramId, updates) {
    try {
      if (!diagramId) {
        throw new Error('다이어그램 ID가 없습니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const updateData = {
        ...updates,
        last_modified_by: this.currentUser.id,
        updated_at: new Date().toISOString()
      };

      console.log('📝 DiagramService: Updating diagram:', diagramId);
      const result = await dbManager.updateDiagram(diagramId, updateData);

      if (result.error) {
        this.emit('error', { operation: 'updateDiagram', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('diagramUpdated', { diagramId, updates: updateData, result: result.data });
      eventBus.emit(eventBus.EVENTS.DIAGRAM_UPDATED, { diagramId, updates: updateData, result: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ DiagramService: Failed to update diagram:', error);
      this.emit('error', { operation: 'updateDiagram', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 다이어그램 삭제
   */
  async deleteDiagram(diagramId) {
    try {
      if (!diagramId) {
        throw new Error('다이어그램 ID가 없습니다.');
      }

      if (!this.currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      console.log('🗑️ DiagramService: Deleting diagram:', diagramId);
      const result = await dbManager.deleteDiagram(diagramId);

      if (result.error) {
        this.emit('error', { operation: 'deleteDiagram', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('diagramDeleted', { diagramId });
      eventBus.emit(eventBus.EVENTS.DIAGRAM_DELETED, { diagramId });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ DiagramService: Failed to delete diagram:', error);
      this.emit('error', { operation: 'deleteDiagram', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 다이어그램 이름 변경
   */
  async renameDiagram(diagramId, newName) {
    try {
      if (!newName || !newName.trim()) {
        throw new Error('새 이름은 필수입니다.');
      }

      return await this.updateDiagram(diagramId, { 
        name: newName.trim() 
      });

    } catch (error) {
      console.error('❌ DiagramService: Failed to rename diagram:', error);
      this.emit('error', { operation: 'renameDiagram', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 다이어그램 이동 (폴더 변경)
   */
  async moveDiagram(diagramId, newFolderId) {
    try {
      return await this.updateDiagram(diagramId, { 
        folder_id: newFolderId 
      });

    } catch (error) {
      console.error('❌ DiagramService: Failed to move diagram:', error);
      this.emit('error', { operation: 'moveDiagram', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 프로젝트의 모든 다이어그램 조회
   */
  async getProjectDiagrams(projectId = null) {
    try {
      const targetProjectId = projectId || this.currentProject?.id;
      if (!targetProjectId) {
        throw new Error('프로젝트 ID가 없습니다.');
      }

      console.log('📂 DiagramService: Loading project diagrams for:', targetProjectId);
      const result = await dbManager.getProjectDiagrams(targetProjectId);

      if (result.error) {
        this.emit('error', { operation: 'getProjectDiagrams', error: result.error });
        throw new Error(result.error.message || result.error);
      }

      this.emit('projectDiagramsLoaded', { projectId: targetProjectId, diagrams: result.data });
      return { success: true, data: result.data };

    } catch (error) {
      console.error('❌ DiagramService: Failed to load project diagrams:', error);
      this.emit('error', { operation: 'getProjectDiagrams', error });
      return { success: false, error: error.message };
    }
  }

  /**
   * 기본 BPMN XML 생성
   */
  getDefaultBpmnXml() {
    const timestamp = Date.now();
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_${timestamp}" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_${timestamp}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_${timestamp}">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="99" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
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
    console.log('🗑️ DiagramService destroyed');
  }
}

// 싱글톤 인스턴스
export const diagramService = new DiagramService();
export default diagramService;