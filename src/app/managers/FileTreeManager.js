import { EventEmitter } from 'events';
import { dbManager } from '../../lib/database.js';
import { rbacManager, hasPermission, getUserRoleInProject } from '../../lib/rbac.js';
import $ from 'jquery';

/**
 * 파일 트리 관리 전담 클래스
 * 폴더/다이어그램 계층 구조 표시, 드래그앤드롭, 파일 작업 처리
 */
export class FileTreeManager extends EventEmitter {
  constructor() {
    super();
    
    // 상태 관리
    this.currentProject = null;
    this.currentUser = null;
    this.expandedFolders = new Set();
    
    // 드래그앤드롭 상태
    this.draggedItem = null;
    this.dragOverItem = null;
    
    // UI 설정
    this.fileTreeContainer = $('#file-tree');
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    this.setupFileTreeEventListeners();
    this.setupDragAndDrop();
    this.emit('fileTreeManagerInitialized');
  }

  /**
   * 파일 트리 이벤트 리스너 설정
   */
  setupFileTreeEventListeners() {
    // 외부에서 오는 요청들 처리
    this.on('projectUpdated', (project) => {
      this.currentProject = project;
      this.loadFileTree();
    });
    
    this.on('userUpdated', (user) => {
      this.currentUser = user;
    });
    
    this.on('fileTreeLoadRequested', () => {
      this.loadFileTree();
    });
    
    this.on('fileTreeRenderRequested', () => {
      this.renderFileTree();
    });
  }

  /**
   * 파일 트리 로드
   */
  async loadFileTree() {
    if (!this.currentProject) {
      this.renderEmptyState('프로젝트를 선택해주세요.');
      return;
    }

    try {
      console.log('📂 Loading file tree for project:', this.currentProject.id);
      
      // 프로젝트의 폴더와 다이어그램 병렬 로드
      const [foldersResult, diagramsResult] = await Promise.all([
        dbManager.getProjectFolders(this.currentProject.id).catch(err => {
          console.error('Failed to load folders:', err);
          return { data: [], error: err };
        }),
        dbManager.getProjectDiagrams(this.currentProject.id).catch(err => {
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
          this.emit('fileTreeLoadWarning', '일부 데이터를 불러올 수 없습니다. 로컬 모드로 진행합니다.');
        }
      }

      this.currentProject.folders = foldersResult.data || [];
      this.currentProject.diagrams = diagramsResult.data || [];
      
      console.log(`Loaded ${this.currentProject.folders.length} folders and ${this.currentProject.diagrams.length} diagrams`);
      
      // 모든 폴더를 기본적으로 확장된 상태로 설정
      this.expandedFolders.clear();
      this.currentProject.folders.forEach(folder => {
        this.expandedFolders.add(folder.id);
      });
      
      this.renderFileTree();
      
      console.log('✅ File tree loaded successfully');
      this.emit('fileTreeLoaded', {
        folders: this.currentProject.folders,
        diagrams: this.currentProject.diagrams
      });
      
    } catch (error) {
      console.error('Load file tree error:', error);
      this.emit('fileTreeLoadError', error);
    }
  }

  /**
   * 파일 트리 렌더링
   */
  renderFileTree() {
    if (!this.fileTreeContainer.length) {
      console.warn('File tree container not found');
      return;
    }

    const diagrams = this.currentProject?.diagrams || [];
    
    const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
    const canCreateDiagram = hasPermission(userRole, 'diagram.create');
    const canCreateFolder = hasPermission(userRole, 'folder.create');
    
    const html = `
      <div class="file-tree-header" style="
        padding: 16px;
        border-bottom: 1px solid #3e3e3e;
        background-color: #252526;
      ">
        <h3 style="
          margin: 0 0 12px 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        ">${this.currentProject.name}</h3>
        <div class="file-tree-actions" style="
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        ">
          ${canCreateDiagram ? `
            <button class="file-tree-btn primary" 
                    id="create-diagram-btn"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 6px;
                      padding: 6px 12px;
                      border: none;
                      border-radius: 4px;
                      background-color: #007ACC;
                      color: white;
                      font-size: 12px;
                      cursor: pointer;
                      font-weight: 500;
                    ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              새 다이어그램
            </button>
          ` : ''}
          ${canCreateFolder ? `
            <button class="file-tree-btn" 
                    id="create-folder-btn"
                    style="
                      display: flex;
                      align-items: center;
                      gap: 6px;
                      padding: 6px 12px;
                      border: 1px solid #3e3e3e;
                      border-radius: 4px;
                      background-color: transparent;
                      color: #cccccc;
                      font-size: 12px;
                      cursor: pointer;
                    ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
              </svg>
              새 폴더
            </button>
          ` : ''}
        </div>
      </div>
      <div class="file-tree-content" style="
        flex: 1;
        overflow: auto;
        padding: 8px 0;
      ">
        ${this.renderFileTreeItems()}
      </div>
    `;
    
    this.fileTreeContainer.html(html);
    
    // 이벤트 리스너 재설정
    this.setupFileTreeInteractions();
    
    this.emit('fileTreeRendered');
  }

  /**
   * 빈 상태 렌더링
   */
  renderEmptyState(message) {
    const html = `
      <div class="empty-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #999999;
        text-align: center;
        padding: 20px;
      ">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style="margin-bottom: 16px; opacity: 0.5;">
          <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
        </svg>
        <p style="margin: 0; font-size: 14px;">${message}</p>
      </div>
    `;
    
    this.fileTreeContainer.html(html);
  }

  /**
   * 파일 트리 아이템들 렌더링 (계층적 구조)
   */
  renderFileTreeItems() {
    const folders = this.currentProject?.folders || [];
    const diagrams = this.currentProject?.diagrams || [];
    
    // 계층 구조 생성
    const structure = this.buildFileTreeStructure(folders, diagrams);
    
    if (structure.length === 0 && diagrams.length === 0) {
      return `
        <div class="empty-state" style="
          padding: 20px;
          text-align: center;
          color: #999999;
        ">
          <p style="margin: 0 0 8px 0;">파일이 없습니다.</p>
          <p style="font-size: 12px; margin: 0; color: #666;">새 폴더나 다이어그램을 만들어보세요.</p>
        </div>
      `;
    }
    
    return this.renderFileTreeNode(structure, 0);
  }

  /**
   * 파일 트리 구조 생성
   */
  buildFileTreeStructure(folders, diagrams) {
    // 루트 폴더들 (parent_id가 null인 폴더들)
    const rootFolders = folders.filter(folder => !folder.parent_id);
    // 루트에 있는 다이어그램들 (folder_id가 null인 다이어그램들)
    const rootDiagrams = diagrams.filter(diagram => !diagram.folder_id);
    
    const structure = [];
    
    // 루트 폴더들 추가 (정렬)
    rootFolders
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(folder => {
        structure.push({
          type: 'folder',
          data: folder,
          children: this.getChildrenForFolder(folder.id, folders, diagrams)
        });
      });
    
    // 루트 다이어그램들 추가 (정렬)
    rootDiagrams
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(diagram => {
        structure.push({
          type: 'diagram',
          data: diagram,
          children: []
        });
      });
    
    return structure;
  }

  /**
   * 특정 폴더의 하위 항목들 가져오기
   */
  getChildrenForFolder(folderId, folders, diagrams) {
    const children = [];
    
    // 하위 폴더들 (정렬)
    const subFolders = folders
      .filter(folder => folder.parent_id === folderId)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    subFolders.forEach(folder => {
      children.push({
        type: 'folder',
        data: folder,
        children: this.getChildrenForFolder(folder.id, folders, diagrams)
      });
    });
    
    // 폴더 내 다이어그램들 (정렬)
    const folderDiagrams = diagrams
      .filter(diagram => diagram.folder_id === folderId)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    folderDiagrams.forEach(diagram => {
      children.push({
        type: 'diagram',
        data: diagram,
        children: []
      });
    });
    
    return children;
  }

  /**
   * 파일 트리 노드 렌더링
   */
  renderFileTreeNode(nodes, depth = 0) {
    const userRole = getUserRoleInProject(this.currentUser?.id, this.currentProject?.id);
    
    return nodes.map(node => {
      const indentStyle = depth > 0 ? `padding-left: ${depth * 20 + 16}px;` : 'padding-left: 16px;';
      
      if (node.type === 'folder') {
        return this.renderFolderNode(node, depth, indentStyle, userRole);
      } else {
        return this.renderDiagramNode(node, depth, indentStyle, userRole);
      }
    }).join('');
  }

  /**
   * 폴더 노드 렌더링
   */
  renderFolderNode(node, depth, indentStyle, userRole) {
    const folder = node.data;
    const hasChildren = node.children.length > 0;
    const isExpanded = this.expandedFolders.has(folder.id) || !hasChildren;
    
    return `
      <div class="file-tree-item folder ${isExpanded ? 'expanded' : ''}" 
           data-folder-id="${folder.id}" 
           data-type="folder"
           draggable="true"
           style="
             display: flex;
             align-items: center;
             ${indentStyle}
             padding-top: 4px;
             padding-bottom: 4px;
             cursor: pointer;
             color: #cccccc;
             border-radius: 4px;
             margin: 1px 8px;
           ">
        <div class="icon" style="display: flex; align-items: center; margin-right: 8px;">
          ${hasChildren ? `
            <div class="folder-toggle" onclick="window.fileTreeManager.toggleFolder('${folder.id}'); event.stopPropagation();" style="
              width: 16px;
              height: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              margin-right: 4px;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                ${isExpanded ? 
                  '<path d="M7 10l5 5 5-5z"/>' :  // 확장됨 (아래 화살표)
                  '<path d="M10 17l5-5-5-5v10z"/>' // 접힘 (오른쪽 화살표)
                }
              </svg>
            </div>
          ` : '<div style="width: 20px;"></div>'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color: #dcb67a;">
            <path d="${isExpanded ? 
              'M19 20H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h6l2 2h7a2 2 0 0 1 2 2v1H4v9l1.14-4.55a2 2 0 0 1 1.93-1.45H23l-2.5 5z' :
              'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z'
            }"/>
          </svg>
        </div>
        <div class="name" style="flex: 1; font-size: 13px;">${this.escapeHtml(folder.name)}</div>
        <div class="actions" style="display: none; margin-left: 8px;" onclick="event.stopPropagation()">
          ${this.renderFolderActions(folder.id, userRole)}
        </div>
      </div>
      ${isExpanded ? this.renderFileTreeNode(node.children, depth + 1) : ''}
    `;
  }

  /**
   * 다이어그램 노드 렌더링
   */
  renderDiagramNode(node, depth, indentStyle, userRole) {
    const diagram = node.data;
    
    return `
      <div class="file-tree-item diagram-item" 
           data-diagram-id="${diagram.id}" 
           data-type="diagram"
           draggable="true"
           onclick="window.fileTreeManager.openDiagram('${diagram.id}')" 
           style="
             display: flex;
             align-items: center;
             ${indentStyle}
             padding-top: 4px;
             padding-bottom: 4px;
             cursor: pointer;
             color: #cccccc;
             border-radius: 4px;
             margin: 1px 8px;
           ">
        <div class="icon" style="display: flex; align-items: center; margin-right: 8px;">
          <div style="width: 20px;"></div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color: #519aba;">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
          </svg>
        </div>
        <div class="name" style="flex: 1; font-size: 13px;">${this.escapeHtml(diagram.name)}</div>
        <div class="actions" style="display: none; margin-left: 8px;" onclick="event.stopPropagation()">
          ${this.renderDiagramActions(diagram.id, userRole)}
        </div>
      </div>
    `;
  }

  /**
   * 폴더 액션 버튼들 렌더링
   */
  renderFolderActions(folderId, userRole) {
    const actions = [];
    
    if (hasPermission(userRole, 'folder.create')) {
      actions.push(`
        <button class="action-btn" title="새 하위 폴더" onclick="window.fileTreeManager.createSubFolder('${folderId}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2.5 7.5h-3V16h-1v-2.5h-3v-1h3V10h1v2.5h3v1z"/>
          </svg>
        </button>
      `);
    }
    
    if (hasPermission(userRole, 'diagram.create')) {
      actions.push(`
        <button class="action-btn" title="새 다이어그램" onclick="window.fileTreeManager.createDiagramInFolder('${folderId}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z M19,13H13V11H19V13Z"/>
          </svg>
        </button>
      `);
    }
    
    if (hasPermission(userRole, 'folder.edit')) {
      actions.push(`
        <button class="action-btn" title="이름 변경" onclick="window.fileTreeManager.renameFolder('${folderId}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      `);
    }
    
    if (hasPermission(userRole, 'folder.delete')) {
      actions.push(`
        <button class="action-btn" title="삭제" onclick="window.fileTreeManager.deleteFolder('${folderId}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      `);
    }
    
    return actions.join('');
  }

  /**
   * 다이어그램 액션 버튼들 렌더링
   */
  renderDiagramActions(diagramId, userRole) {
    const actions = [];
    
    actions.push(`
      <button class="action-btn" title="편집" onclick="window.fileTreeManager.openDiagram('${diagramId}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </button>
    `);
    
    if (hasPermission(userRole, 'diagram.edit')) {
      actions.push(`
        <button class="action-btn" title="이름 변경" onclick="window.fileTreeManager.renameDiagram('${diagramId}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z M9,13H16V15H9V13Z M9,16H14V18H9V16Z"/>
          </svg>
        </button>
      `);
    }
    
    if (hasPermission(userRole, 'diagram.delete')) {
      actions.push(`
        <button class="action-btn" title="삭제" onclick="window.fileTreeManager.deleteDiagram('${diagramId}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      `);
    }
    
    return actions.join('');
  }

  /**
   * 파일 트리 상호작용 설정
   */
  setupFileTreeInteractions() {
    // 새 다이어그램 버튼
    $('#create-diagram-btn').off('click').on('click', () => {
      this.createNewDiagram();
    });

    // 새 폴더 버튼
    $('#create-folder-btn').off('click').on('click', () => {
      this.createNewFolder();
    });

    // 파일 트리 아이템 호버 효과
    $(document).off('mouseenter.filetree mouseleave.filetree', '.file-tree-item')
      .on('mouseenter.filetree', '.file-tree-item', function() {
        $(this).css('background-color', 'rgba(255, 255, 255, 0.1)');
        $(this).find('.actions').show();
      })
      .on('mouseleave.filetree', '.file-tree-item', function() {
        $(this).css('background-color', 'transparent');
        $(this).find('.actions').hide();
      });

    // 액션 버튼 스타일
    $(document).off('mouseenter.actionbtn mouseleave.actionbtn', '.action-btn')
      .on('mouseenter.actionbtn', '.action-btn', function() {
        $(this).css('background-color', 'rgba(255, 255, 255, 0.2)');
      })
      .on('mouseleave.actionbtn', '.action-btn', function() {
        $(this).css('background-color', 'transparent');
      });

    // 글로벌 노출 (임시 해결책)
    window.fileTreeManager = this;
  }

  /**
   * 드래그앤드롭 설정
   */
  setupDragAndDrop() {
    // TODO: 드래그앤드롭 기능 구현
    console.log('Drag and drop setup not yet implemented');
  }

  /**
   * 폴더 확장/접기 토글
   */
  toggleFolder(folderId) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    this.renderFileTree();
    this.emit('folderToggled', { folderId, isExpanded: this.expandedFolders.has(folderId) });
  }

  /**
   * 다이어그램 열기
   */
  async openDiagram(diagramId) {
    console.log('🔍 Opening diagram:', diagramId);
    
    const diagram = this.currentProject?.diagrams?.find(d => d.id === diagramId);
    if (!diagram) {
      console.error('❌ Diagram not found in current project');
      this.emit('diagramNotFound', diagramId);
      return;
    }

    console.log('✅ Found diagram:', diagram);

    // 활성 항목 표시
    $('.file-tree-item').removeClass('active');
    $(`.file-tree-item[data-diagram-id="${diagramId}"]`).addClass('active').css('background-color', 'rgba(0, 122, 204, 0.3)');
    
    // 다이어그램 열기 요청
    this.emit('diagramOpenRequested', {
      id: diagram.id,
      diagramId: diagram.id,
      name: diagram.name,
      title: diagram.name
    });
  }

  /**
   * 새 다이어그램 생성
   */
  createNewDiagram() {
    this.emit('newDiagramRequested', null);
  }

  /**
   * 새 폴더 생성
   */
  createNewFolder() {
    this.emit('newFolderRequested', null);
  }

  /**
   * 폴더 내 다이어그램 생성
   */
  createDiagramInFolder(folderId) {
    this.emit('newDiagramRequested', folderId);
  }

  /**
   * 하위 폴더 생성
   */
  createSubFolder(parentFolderId) {
    this.emit('newFolderRequested', parentFolderId);
  }

  /**
   * 폴더 이름 변경
   */
  renameFolder(folderId) {
    const folder = this.currentProject?.folders?.find(f => f.id === folderId);
    if (folder) {
      this.emit('folderRenameRequested', folder);
    }
  }

  /**
   * 다이어그램 이름 변경
   */
  renameDiagram(diagramId) {
    const diagram = this.currentProject?.diagrams?.find(d => d.id === diagramId);
    if (diagram) {
      this.emit('diagramRenameRequested', diagram);
    }
  }

  /**
   * 폴더 삭제
   */
  deleteFolder(folderId) {
    const folder = this.currentProject?.folders?.find(f => f.id === folderId);
    if (folder) {
      this.emit('folderDeleteRequested', folder);
    }
  }

  /**
   * 다이어그램 삭제
   */
  deleteDiagram(diagramId) {
    const diagram = this.currentProject?.diagrams?.find(d => d.id === diagramId);
    if (diagram) {
      this.emit('diagramDeleteRequested', diagram);
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
   * 활성 다이어그램 표시
   */
  setActiveDiagram(diagramId) {
    $('.file-tree-item').removeClass('active').css('background-color', 'transparent');
    if (diagramId) {
      $(`.file-tree-item[data-diagram-id="${diagramId}"]`)
        .addClass('active')
        .css('background-color', 'rgba(0, 122, 204, 0.3)');
    }
  }

  /**
   * 파일 트리 상태 정보 반환
   */
  getFileTreeStatus() {
    return {
      hasProject: !!this.currentProject,
      foldersCount: this.currentProject?.folders?.length || 0,
      diagramsCount: this.currentProject?.diagrams?.length || 0,
      expandedFoldersCount: this.expandedFolders.size,
      hasContainer: this.fileTreeContainer.length > 0
    };
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 이벤트 리스너 정리
    $(document).off('mouseenter.filetree mouseleave.filetree mouseenter.actionbtn mouseleave.actionbtn');
    $('#create-diagram-btn, #create-folder-btn').off('click');
    
    // 글로벌 참조 정리
    if (window.fileTreeManager === this) {
      delete window.fileTreeManager;
    }
    
    // 상태 초기화
    this.currentProject = null;
    this.currentUser = null;
    this.expandedFolders.clear();
    this.draggedItem = null;
    this.dragOverItem = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    // UI 참조 정리
    this.fileTreeContainer = null;
    
    console.log('🗑️ FileTreeManager destroyed');
  }
}