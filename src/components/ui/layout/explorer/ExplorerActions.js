import { EventEmitter } from 'events';

/**
 * Explorer 액션 처리 전담 클래스
 * 컨텍스트 메뉴, 액션 버튼, 파일/폴더 생성/삭제/이동 등의 작업 관리
 */
export class ExplorerActions extends EventEmitter {
  constructor(explorerCore, dataProvider) {
    super();
    
    this.explorerCore = explorerCore;
    this.dataProvider = dataProvider;
    this.container = explorerCore.getContainer();
    
    // 상태 관리
    this.clipboard = null; // 잘라내기/복사 아이템
    this.clipboardOperation = null; // 'cut' 또는 'copy'
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupContextMenu();
  }

  /**
   * 컨텍스트 메뉴 설정
   */
  setupContextMenu() {
    // 컨텍스트 메뉴는 ExplorerEventHandler에서 이벤트를 받아 처리
    this.emit('contextMenuSetup');
  }

  /**
   * 컨텍스트 메뉴 액션 처리
   */
  async handleContextMenuAction(action, item) {
    console.log('📋 Context menu action:', action, 'for item:', item.label);
    
    try {
      switch (action) {
        case 'open':
          this.emit('openRequested', item);
          break;
        case 'new-file':
          await this.createNewFile(item);
          break;
        case 'new-folder':
          await this.createNewFolder(item);
          break;
        case 'rename':
          await this.renameItem(item);
          break;
        case 'delete':
          await this.deleteItem(item);
          break;
        case 'cut':
          this.cutItem(item);
          break;
        case 'copy':
          this.copyItem(item);
          break;
        case 'paste':
          await this.pasteItem(item);
          break;
        case 'export':
          await this.exportItem(item);
          break;
        case 'properties':
          this.showProperties(item);
          break;
        case 'collapse-all':
          this.explorerCore.collapseAll();
          break;
        case 'refresh':
          await this.refreshProjectData();
          break;
        default:
          console.log('🔍 Unknown context menu action:', action);
      }
    } catch (error) {
      console.error('❌ Error handling context menu action:', error);
      this.emit('actionError', { action, item, error });
    }
  }

  /**
   * 새 다이어그램 생성
   */
  async createNewFile(parentFolder = null) {
    try {
      const parent = parentFolder || this.explorerCore.getSelectedItems()[0] || this.dataProvider.root;
      console.log('📄 Creating new BPMN diagram in:', parent?.label || 'root');
      
      // 파일 이름 입력받기 (중복 체크)
      let fileName;
      let attempt = 0;
      do {
        const defaultName = attempt === 0 ? 'new-diagram' : `new-diagram-${attempt}`;
        fileName = prompt('새 다이어그램의 이름을 입력하세요:', defaultName);
        
        if (!fileName || !fileName.trim()) {
          return;
        }
        
        fileName = fileName.trim();
        
        // 중복 확인
        if (this.checkDuplicateName(fileName, 'diagram', parent)) {
          alert(`"${fileName}" 이름의 다이어그램이 이미 존재합니다. 다른 이름을 입력해주세요.`);
          attempt++;
          fileName = null; // 루프 계속
        }
      } while (!fileName && attempt < 10);
      
      // AppManager를 통해 다이어그램 생성
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        console.error('❌ AppManager or current project not found');
        return;
      }
      
      // 부모 폴더 ID 확인
      let folderId = null;
      if (parent && parent.folderId) {
        folderId = parent.folderId;
      }
      
      console.log('🔧 Creating diagram with folderId:', folderId);
      
      // 다이어그램 생성
      const { dbManager } = await import('../../../../lib/database.js');
      
      const diagramData = {
        name: fileName.trim(),
        project_id: appManager.currentProject.id,
        folder_id: folderId,
        bpmn_xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_${Date.now()}" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_${Date.now()}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_${Date.now()}">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="99" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
        created_by: appManager.currentUser?.id
      };
      
      const result = await dbManager.createDiagram(diagramData);
      
      if (result.error) {
        console.error('❌ Failed to create diagram:', result.error);
        alert('다이어그램 생성에 실패했습니다.');
        return;
      }
      
      console.log('✅ Diagram created successfully:', result.data);
      
      // 프로젝트 데이터 새로고침 후 트리 업데이트
      await this.refreshProjectData();
      
      // 생성된 다이어그램 자동으로 열기
      if (appManager.bpmnEditor && result.data) {
        await appManager.bpmnEditor.openDiagram({
          id: result.data.id,
          name: result.data.name,
          content: result.data.bpmn_xml
        });
      }
      
      this.emit('fileCreated', result.data);
      
    } catch (error) {
      console.error('❌ Error creating file:', error);
      alert('다이어그램 생성 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'createFile', error });
    }
  }

  /**
   * 새 폴더 생성
   */
  async createNewFolder(parentFolder = null) {
    try {
      const parent = parentFolder || this.explorerCore.getSelectedItems()[0] || this.dataProvider.root;
      console.log('📁 Creating new folder in:', parent?.label || 'root');
      
      // 폴더 이름 입력받기 (중복 체크)
      let folderName;
      let attempt = 0;
      do {
        const defaultName = attempt === 0 ? 'new-folder' : `new-folder-${attempt}`;
        folderName = prompt('새 폴더의 이름을 입력하세요:', defaultName);
        
        if (!folderName || !folderName.trim()) {
          return;
        }
        
        folderName = folderName.trim();
        
        // 중복 확인
        if (this.checkDuplicateName(folderName, 'folder', parent)) {
          alert(`"${folderName}" 이름의 폴더가 이미 존재합니다. 다른 이름을 입력해주세요.`);
          attempt++;
          folderName = null; // 루프 계속
        }
      } while (!folderName && attempt < 10);
      
      // AppManager를 통해 폴더 생성
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        console.error('❌ AppManager or current project not found');
        return;
      }
      
      // 부모 폴더 ID 확인
      let parentId = null;
      if (parent && parent.folderId) {
        parentId = parent.folderId;
      }
      
      console.log('🔧 Creating folder with parentId:', parentId);
      
      // 폴더 생성
      const { dbManager } = await import('../../../../lib/database.js');
      
      const folderData = {
        name: folderName.trim(),
        project_id: appManager.currentProject.id,
        parent_id: parentId,
        created_by: appManager.currentUser?.id
      };
      
      const result = await dbManager.createFolder(folderData);
      
      if (result.error) {
        console.error('❌ Failed to create folder:', result.error);
        alert('폴더 생성에 실패했습니다.');
        return;
      }
      
      console.log('✅ Folder created successfully:', result.data);
      
      // 프로젝트 데이터 새로고침 후 트리 업데이트
      await this.refreshProjectData();
      
      this.emit('folderCreated', result.data);
      
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      alert('폴더 생성 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'createFolder', error });
    }
  }

  /**
   * 아이템 이름 변경
   */
  async renameItem(item) {
    try {
      console.log('📝 Renaming item:', item.label, 'type:', item.type);
      
      // 현재 이름을 기본값으로 하여 새 이름 입력받기
      let newName;
      let attempt = 0;
      do {
        newName = prompt('새 이름을 입력하세요:', item.label);
        
        if (!newName || !newName.trim()) {
          return; // 취소 또는 빈 이름
        }
        
        newName = newName.trim();
        
        // 이름이 기존과 같으면 변경하지 않음
        if (newName === item.label) {
          return;
        }
        
        // 중복 확인 (자기 자신은 제외)
        if (this.checkDuplicateNameForRename(newName, item.type, item.parent, item)) {
          alert(`"${newName}" 이름의 ${item.type === 'folder' ? '폴더' : '다이어그램'}가 이미 존재합니다. 다른 이름을 입력해주세요.`);
          attempt++;
          newName = null; // 루프 계속
        }
      } while (!newName && attempt < 10);
      
      if (!newName) {
        return; // 너무 많은 시도 후 포기
      }
      
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        console.error('❌ AppManager or current project not found');
        return;
      }
      
      const { dbManager } = await import('../../../../lib/database.js');
      let result;
      
      if (item.type === 'folder') {
        // 폴더 이름 변경
        result = await dbManager.renameFolder(item.folderId, newName);
      } else {
        // 다이어그램 이름 변경
        const updates = {
          name: newName,
          last_modified_by: appManager.currentUser?.id
        };
        result = await dbManager.updateDiagram(item.diagramId, updates);
      }
      
      if (result.error) {
        console.error('❌ Failed to rename item:', result.error);
        alert(`${item.type === 'folder' ? '폴더' : '다이어그램'} 이름 변경에 실패했습니다.`);
        return;
      }
      
      console.log('✅ Item renamed successfully:', result.data);
      
      // 프로젝트 데이터 새로고침 후 트리 업데이트
      await this.refreshProjectData();
      
      // 현재 열린 다이어그램이 이름 변경된 다이어그램인 경우 에디터 제목 업데이트
      if (item.type === 'diagram' && appManager.bpmnEditor && appManager.bpmnEditor.currentDiagram) {
        if (appManager.bpmnEditor.currentDiagram.id === item.diagramId) {
          appManager.bpmnEditor.currentDiagram.name = newName;
          appManager.bpmnEditor.updateEditorTitle();
        }
      }
      
      this.emit('itemRenamed', { item, newName, result: result.data });
      
    } catch (error) {
      console.error('❌ Error renaming item:', error);
      alert('이름 변경 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'rename', item, error });
    }
  }

  /**
   * 아이템 삭제
   */
  async deleteItem(item) {
    try {
      console.log('🗑️ Deleting item:', item.label, 'type:', item.type);
      
      // 삭제 확인
      const itemType = item.type === 'folder' ? '폴더' : '다이어그램';
      const confirmMessage = item.type === 'folder' 
        ? `"${item.label}" 폴더와 내부의 모든 파일을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`
        : `"${item.label}" 다이어그램을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`;
          
      if (!confirm(confirmMessage)) {
        return; // 사용자가 취소함
      }
      
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        console.error('❌ AppManager or current project not found');
        return;
      }
      
      const { dbManager } = await import('../../../../lib/database.js');
      let result;
      
      if (item.type === 'folder') {
        // 폴더 삭제 (하위 항목들도 함께 삭제됨)
        result = await dbManager.deleteFolder(item.folderId);
        
        // 만약 현재 열린 다이어그램이 삭제되는 폴더 내에 있다면 에디터 닫기
        if (appManager.bpmnEditor && appManager.bpmnEditor.currentDiagram) {
          const currentDiagram = appManager.bpmnEditor.currentDiagram;
          const diagramsInFolder = this.getDiagramsInFolder(item.folderId);
          
          if (diagramsInFolder.some(d => d.id === currentDiagram.id)) {
            console.log('📝 Closing diagram as its folder is being deleted');
            await appManager.bpmnEditor.closeDiagram();
          }
        }
      } else {
        // 다이어그램 삭제
        result = await dbManager.deleteDiagram(item.diagramId);
        
        // 현재 열린 다이어그램이 삭제되는 다이어그램인 경우 에디터 닫기
        if (appManager.bpmnEditor && appManager.bpmnEditor.currentDiagram) {
          if (appManager.bpmnEditor.currentDiagram.id === item.diagramId) {
            console.log('📝 Closing current diagram as it is being deleted');
            await appManager.bpmnEditor.closeDiagram();
          }
        }
      }
      
      if (result.error) {
        console.error('❌ Failed to delete item:', result.error);
        alert(`${itemType} 삭제에 실패했습니다: ${result.error.message || result.error}`);
        return;
      }
      
      console.log(`✅ ${itemType} deleted successfully:`, result.data);
      
      // 프로젝트 데이터 새로고침 후 트리 업데이트
      await this.refreshProjectData();
      
      // 선택된 항목 초기화
      const selectedItems = this.explorerCore.getSelectedItems();
      if (selectedItems.includes(item)) {
        this.explorerCore.selectItem(item, false); // 선택 해제
      }
      
      if (this.explorerCore.getFocusedItem() === item) {
        this.explorerCore.setFocusedItem(null);
      }
      
      console.log(`✅ ${itemType} "${item.label}" 삭제 완료`);
      this.emit('itemDeleted', { item, result: result.data });
      
    } catch (error) {
      console.error('❌ Error deleting item:', error);
      alert('삭제 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'delete', item, error });
    }
  }

  /**
   * 아이템 잘라내기
   */
  cutItem(item) {
    this.clipboard = item;
    this.clipboardOperation = 'cut';
    
    // UI에서 잘라내기 상태 표시
    const element = this.container.querySelector(`[data-item-id="${item.id}"]`);
    if (element) {
      element.classList.add('cut-item');
    }
    
    console.log('✂️ Item cut:', item.label);
    this.emit('itemCut', item);
  }

  /**
   * 아이템 복사
   */
  copyItem(item) {
    this.clipboard = item;
    this.clipboardOperation = 'copy';
    
    console.log('📋 Item copied:', item.label);
    this.emit('itemCopied', item);
  }

  /**
   * 아이템 붙여넣기
   */
  async pasteItem(targetItem) {
    if (!this.clipboard || !this.clipboardOperation) {
      console.log('❌ No item in clipboard');
      return;
    }
    
    try {
      console.log('📋 Pasting item:', this.clipboard.label, 'to:', targetItem?.label || 'root');
      
      const targetFolder = targetItem && targetItem.type === 'folder' ? targetItem : targetItem?.parent || this.dataProvider.root;
      
      if (this.clipboardOperation === 'cut') {
        // 이동
        await this.moveItem(this.clipboard, targetFolder);
        
        // 잘라내기 상태 해제
        const element = this.container.querySelector(`[data-item-id="${this.clipboard.id}"]`);
        if (element) {
          element.classList.remove('cut-item');
        }
      } else if (this.clipboardOperation === 'copy') {
        // 복사 (구현 필요)
        await this.duplicateItem(this.clipboard, targetFolder);
      }
      
      // 클립보드 초기화
      this.clipboard = null;
      this.clipboardOperation = null;
      
      this.emit('itemPasted', { clipboard: this.clipboard, target: targetFolder });
      
    } catch (error) {
      console.error('❌ Error pasting item:', error);
      alert('붙여넣기 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'paste', error });
    }
  }

  /**
   * 아이템 내보내기
   */
  async exportItem(item) {
    try {
      console.log('📤 Exporting item:', item.label);
      
      if (item.type === 'diagram') {
        // BPMN 다이어그램 내보내기
        const appManager = window.appManager;
        if (appManager && appManager.bpmnEditor) {
          // 현재 열린 다이어그램인지 확인
          if (appManager.bpmnEditor.currentDiagram?.id === item.diagramId) {
            // 현재 열린 다이어그램 내보내기
            appManager.bpmnEditor.exportDiagram('bpmn');
          } else {
            // 다른 다이어그램이면 XML 데이터로 직접 내보내기
            const diagramData = item.diagramData;
            if (diagramData && diagramData.bpmn_xml) {
              this.downloadFile(diagramData.bpmn_xml, `${item.label}.bpmn`, 'application/xml');
            }
          }
        }
      } else if (item.type === 'folder') {
        // 폴더 내 모든 다이어그램 일괄 내보내기
        await this.exportFolder(item);
      }
      
      this.emit('itemExported', item);
      
    } catch (error) {
      console.error('❌ Error exporting item:', error);
      alert('내보내기 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'export', item, error });
    }
  }

  /**
   * 속성 표시
   */
  showProperties(item) {
    console.log('ℹ️ Showing properties for:', item.label);
    
    const properties = {
      name: item.label,
      type: item.type === 'folder' ? '폴더' : '다이어그램',
      created: item.created_at || '알 수 없음',
      modified: item.updated_at || '알 수 없음'
    };
    
    if (item.type === 'diagram') {
      properties.size = item.diagramData?.bpmn_xml?.length || 0;
    }
    
    const message = Object.entries(properties)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    alert(`속성\n\n${message}`);
    this.emit('propertiesShown', { item, properties });
  }

  /**
   * 프로젝트 데이터 새로고침
   */
  async refreshProjectData() {
    try {
      console.log('🔄 Refreshing project data...');
      
      const appManager = window.appManager;
      if (!appManager) {
        console.error('❌ AppManager not found');
        return;
      }
      
      // AppManager의 loadProjectData를 호출하여 최신 데이터 로드
      await appManager.loadProjectData();
      
      // VSCodeLayout의 BPMN 프로젝트 구조 재생성
      if (appManager.vscodeLayout) {
        await appManager.vscodeLayout.setupBPMNIntegration();
      }
      
      console.log('✅ Project data refreshed');
      this.emit('projectDataRefreshed');
      
    } catch (error) {
      console.error('❌ Failed to refresh project data:', error);
      this.emit('actionError', { action: 'refresh', error });
    }
  }

  // =============== 헬퍼 메서드들 ===============

  /**
   * 중복 이름 확인
   */
  checkDuplicateName(name, type, parentItem) {
    try {
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        return false;
      }
      
      const { folders, diagrams } = appManager.currentProject;
      
      // 부모 폴더 ID 확인
      let parentId = null;
      if (parentItem && parentItem.folderId) {
        parentId = parentItem.folderId;
      }
      
      if (type === 'folder') {
        // 같은 부모 폴더 내에서 중복 폴더명 확인
        return folders.some(folder => 
          folder.name === name && folder.parent_id === parentId
        );
      } else if (type === 'diagram') {
        // 같은 폴더 내에서 중복 다이어그램명 확인
        return diagrams.some(diagram => 
          diagram.name === name && diagram.folder_id === parentId
        );
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking duplicate name:', error);
      return false;
    }
  }

  /**
   * 이름 변경시 중복 이름 확인
   */
  checkDuplicateNameForRename(name, type, parentItem, currentItem) {
    try {
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        return false;
      }
      
      const { folders, diagrams } = appManager.currentProject;
      
      // 부모 폴더 ID 확인
      let parentId = null;
      if (parentItem && parentItem.folderId) {
        parentId = parentItem.folderId;
      }
      
      if (type === 'folder') {
        // 같은 부모 폴더 내에서 중복 폴더명 확인 (자기 자신 제외)
        return folders.some(folder => 
          folder.name === name && 
          folder.parent_id === parentId && 
          folder.id !== currentItem.folderId
        );
      } else if (type === 'diagram') {
        // 같은 폴더 내에서 중복 다이어그램명 확인 (자기 자신 제외)
        return diagrams.some(diagram => 
          diagram.name === name && 
          diagram.folder_id === parentId && 
          diagram.id !== currentItem.diagramId
        );
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking duplicate name for rename:', error);
      return false;
    }
  }

  /**
   * 폴더 내 다이어그램 목록 반환
   */
  getDiagramsInFolder(folderId) {
    try {
      const appManager = window.appManager;
      if (!appManager || !appManager.currentProject) {
        return [];
      }
      
      const { diagrams } = appManager.currentProject;
      return diagrams.filter(diagram => diagram.folder_id === folderId);
    } catch (error) {
      console.error('❌ Error getting diagrams in folder:', error);
      return [];
    }
  }

  /**
   * 아이템 이동
   */
  async moveItem(item, newParent) {
    try {
      console.log('📁 Moving item:', item.label, 'to:', newParent.label || 'root');
      
      // 자기 자신이나 자기 자신의 자식으로 이동하는 것을 방지
      if (item === newParent || this.isDescendantOf(newParent, item)) {
        console.log('❌ Cannot move item to itself or its descendant');
        alert('폴더를 자기 자신이나 하위 폴더로 이동할 수 없습니다.');
        return;
      }
      
      const appManager = window.appManager;
      if (!appManager) {
        console.error('❌ AppManager not found');
        return;
      }
      
      const { dbManager } = await import('../../../../lib/database.js');
      
      // 새 부모 ID 확인
      const newParentId = newParent.folderId || null;
      
      let result;
      if (item.type === 'folder') {
        result = await dbManager.moveFolder(item.folderId, newParentId);
      } else {
        result = await dbManager.moveDiagram(item.diagramId, newParentId);
      }
      
      if (result.error) {
        console.error('❌ Failed to move item:', result.error);
        alert('이동에 실패했습니다.');
        return;
      }
      
      console.log('✅ Item moved successfully');
      await this.refreshProjectData();
      
      this.emit('itemMoved', { item, newParent, result: result.data });
      
    } catch (error) {
      console.error('❌ Error moving item:', error);
      alert('이동 중 오류가 발생했습니다.');
      this.emit('actionError', { action: 'move', item, error });
    }
  }

  /**
   * 아이템 복제
   */
  async duplicateItem(item, targetFolder) {
    // 구현 필요 - 향후 확장
    console.log('📋 Duplicating item not yet implemented:', item.label);
    alert('복사 기능은 아직 구현되지 않았습니다.');
  }

  /**
   * 폴더 내보내기
   */
  async exportFolder(folder) {
    // 구현 필요 - 향후 확장
    console.log('📤 Exporting folder not yet implemented:', folder.label);
    alert('폴더 내보내기 기능은 아직 구현되지 않았습니다.');
  }

  /**
   * 파일 다운로드
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * 하위 항목인지 확인
   */
  isDescendantOf(descendant, ancestor) {
    let current = descendant.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 드롭 핸들러
   */
  async handleDrop(draggedItem, targetItem, dropPosition) {
    try {
      console.log('🎯 Handling drop:', draggedItem.label, 'to:', targetItem?.label, 'position:', dropPosition);
      
      if (dropPosition === 'root') {
        // 루트로 이동
        await this.moveItem(draggedItem, this.dataProvider.root);
      } else if (dropPosition === 'into' && targetItem.type === 'folder') {
        // 폴더 안으로 이동
        await this.moveItem(draggedItem, targetItem);
      } else if (dropPosition === 'before' || dropPosition === 'after') {
        // 같은 레벨에서 순서 변경 또는 폴더간 이동
        if (draggedItem.parent === targetItem.parent) {
          // 같은 부모 - 순서 변경
          await this.reorderItem(draggedItem, targetItem, dropPosition);
        } else {
          // 다른 부모 - 폴더 이동
          const targetFolder = targetItem.parent || this.dataProvider.root;
          await this.moveItem(draggedItem, targetFolder);
        }
      } else {
        // 기본 폴더 이동
        let targetFolder = targetItem;
        
        if (targetItem.type === 'file' || targetItem.type === 'diagram') {
          targetFolder = targetItem.parent || this.dataProvider.root;
        }
        
        if (targetFolder && targetFolder !== draggedItem) {
          await this.moveItem(draggedItem, targetFolder);
        }
      }
      
      this.emit('dropHandled', { draggedItem, targetItem, dropPosition });
      
    } catch (error) {
      console.error('❌ Error handling drop:', error);
      this.emit('actionError', { action: 'drop', error });
    }
  }

  /**
   * 아이템 순서 변경
   */
  async reorderItem(draggedItem, targetItem, position) {
    console.log('🔄 Reordering items not yet implemented');
    // 구현 필요 - sort_order 필드를 사용한 순서 변경
  }

  /**
   * 클립보드 상태 반환
   */
  getClipboardState() {
    return {
      hasItem: !!this.clipboard,
      item: this.clipboard,
      operation: this.clipboardOperation
    };
  }

  /**
   * 액션 상태 정보 반환
   */
  getStatus() {
    return {
      clipboard: this.getClipboardState(),
      hasActions: true
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 클립보드 정리
    this.clipboard = null;
    this.clipboardOperation = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // 참조 정리
    this.explorerCore = null;
    this.dataProvider = null;
    this.container = null;
    
    console.log('🗑️ ExplorerActions destroyed');
  }
}