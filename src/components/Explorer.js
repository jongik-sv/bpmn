/**
 * VS Code Style Explorer Panel
 * Implements Explorer view with tree structure similar to VS Code
 */

import TreeDataProvider from './TreeDataProvider.js';
import ContextMenu from './ContextMenu.js';

class Explorer {
    constructor(container) {
        this.container = container;
        this.dataProvider = new TreeDataProvider();
        this.contextMenu = new ContextMenu();
        this.virtualScrolling = false; // Can be enabled for large datasets
        this.selectedItem = null;
        this.focusedItem = null;
        this.draggedItem = null;
        this.searchTerm = '';
        this.filterMode = false;
        
        // Event callbacks
        this.onItemClick = null;
        this.onItemDoubleClick = null;
        this.onSelectionChange = null;
        this.onContextMenu = null;
        
        this.init();
    }

    init() {
        console.log('🔧 Explorer initializing...');
        
        // First render the basic structure
        console.log('📍 Rendering initial structure...');
        this.render();
        
        // Then setup data provider
        console.log('📍 Setting up data provider...');
        this.setupDataProvider();
        
        // Create sample data
        console.log('📁 Creating sample data...');
        this.dataProvider.createSampleData();
        console.log('📁 Sample data created, root:', this.dataProvider.root);
        
        // Now refresh the tree (which should work since .tree-view exists)
        console.log('📍 Refreshing tree view...');
        this.refreshTree();
        
        this.attachEventListeners();
        this.setupAccessibility();
        this.setupContextMenu();
        
        console.log('✅ Explorer initialized');
    }
    
    getProjectName() {
        try {
            const appManager = window.appManager;
            if (appManager && appManager.currentProject && appManager.currentProject.name) {
                return appManager.currentProject.name;
            }
            return null;
        } catch (error) {
            console.warn('Could not get project name:', error);
            return null;
        }
    }

    setupDataProvider() {
        console.log('📍 Setting up data provider callback...');
        this.dataProvider.setOnDidChangeTreeData((element) => {
            console.log('📞 Data provider callback called with element:', element?.label || 'null');
            this.refreshTree(element);
        });
        console.log('✅ Data provider callback set');
    }

    render() {
        // 프로젝트 이름 가져오기
        const projectName = this.getProjectName();
        
        this.container.innerHTML = `
            <div class="explorer-panel" style="height: 100%; display: flex; flex-direction: column; background-color: #252526; color: #cccccc;">
                <div class="explorer-header" style="padding: 8px 16px; border-bottom: 1px solid #3e3e3e; background-color: #252526;">
                    <div class="explorer-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <h3 style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #cccccc; letter-spacing: 1px;">탐색기</h3>
                            ${projectName ? `<span style="font-size: 12px; color: #999999; margin-top: 2px; font-weight: 400;">${projectName}</span>` : ''}
                        </div>
                        <div class="explorer-actions" style="display: flex; gap: 4px;">
                            <button class="action-button" title="새 다이어그램 (BPMN 파일)" data-action="new-file" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                                📄
                            </button>
                            <button class="action-button" title="새 폴더" data-action="new-folder" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                                📁
                            </button>
                            <button class="action-button" title="새로 고침" data-action="refresh" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                                🔄
                            </button>
                            <button class="action-button" title="모두 축소" data-action="collapse-all" style="width: 24px; height: 24px; border: 1px solid #555; background-color: #404040; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-size: 14px;">
                                ⬇️
                            </button>
                        </div>
                    </div>
                    <div class="explorer-search" style="display: none; margin-top: 8px;">
                        <input type="text" 
                               class="search-input" 
                               placeholder="파일 검색..."
                               autocomplete="off"
                               spellcheck="false"
                               style="width: 100%; padding: 4px 8px; background-color: #3c3c3c; border: 1px solid #3e3e3e; color: #cccccc; border-radius: 3px;">
                        <button class="search-clear" title="검색 지우기" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: none; color: #cccccc; cursor: pointer;">
                            <i class="codicon codicon-close"></i>
                        </button>
                    </div>
                </div>
                <div class="explorer-content" style="flex: 1; overflow: auto;">
                    <div class="tree-view" 
                         role="tree" 
                         aria-label="파일 탐색기"
                         tabindex="0"
                         style="padding: 8px 0;">
                        ${this.renderTree()}
                    </div>
                </div>
            </div>
        `;
    }

    renderTree() {
        console.log('🌲 Rendering tree with real data...');
        const root = this.dataProvider.root;
        
        if (!root) {
            console.log('❌ No root node found');
            return '<div style="padding: 16px; color: #999999;">데이터를 로드하는 중...</div>';
        }
        
        console.log('🌲 Root children:', root.children?.length || 0, root.children);
        
        // Start with root's children, sorted properly
        const visibleNodes = [];
        if (root.children && root.children.length > 0) {
            // Sort root children: folders first, then files, both alphabetically
            const sortedChildren = [...root.children].sort((a, b) => {
                // Folders first
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                
                // Then alphabetically (Korean-aware)
                return a.label.localeCompare(b.label, 'ko', { numeric: true, sensitivity: 'base' });
            });
            
            for (const child of sortedChildren) {
                visibleNodes.push(child);
                if (child.isExpanded && child.children && child.children.length > 0) {
                    this.addChildrenToVisible(child, visibleNodes);
                }
            }
        }
        
        console.log('🌲 Visible nodes:', visibleNodes.length, visibleNodes);
        
        if (visibleNodes.length === 0) {
            return `
                <div style="padding: 16px; color: #999999; text-align: center;">
                    <div style="margin-bottom: 12px;">
                        <i class="codicon codicon-folder" style="font-size: 32px; color: #666;"></i>
                    </div>
                    <div style="margin-bottom: 8px; font-weight: 500;">파일이 없습니다</div>
                    <div style="font-size: 12px; line-height: 1.4; margin-bottom: 12px;">
                        새 폴더나 다이어그램을 만들어보세요
                    </div>
                    <div style="font-size: 11px; color: #666;">
                        • 📄 새 다이어그램: 헤더의 + 버튼 클릭<br>
                        • 📁 새 폴더: 헤더의 폴더 버튼 클릭
                    </div>
                </div>
            `;
        }
        
        const html = visibleNodes.map(node => {
            console.log('🌲 Rendering node:', node.label, node.type);
            return this.renderTreeItem(node);
        }).join('');
        console.log('🌲 Generated HTML length:', html.length);
        return html;
    }
    
    addChildrenToVisible(parent, visibleNodes) {
        // Sort children before adding to visible nodes
        const sortedChildren = [...parent.children].sort((a, b) => {
            // Folders first
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            
            // Then alphabetically (Korean-aware)
            return a.label.localeCompare(b.label, 'ko', { numeric: true, sensitivity: 'base' });
        });
        
        for (const child of sortedChildren) {
            visibleNodes.push(child);
            if (child.isExpanded && child.children && child.children.length > 0) {
                this.addChildrenToVisible(child, visibleNodes);
            }
        }
    }

    renderTreeItem(item) {
        const depth = item.getDepth();
        const isSelected = this.dataProvider.isSelected(item);
        const isFocused = this.focusedItem === item;
        const hasChildren = item.children && item.children.length > 0;
        const canExpand = item.collapsibleState !== 0; // TreeItemCollapsibleState.None
        
        const classes = [
            'tree-item',
            item.type === 'folder' ? 'folder' : 'file',
            isSelected ? 'selected' : '',
            isFocused ? 'focused' : '',
            item.isExpanded ? 'expanded' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}" 
                 data-item-id="${item.id}"
                 data-item-type="${item.type}"
                 data-depth="${depth}"
                 role="treeitem"
                 aria-level="${depth + 1}"
                 aria-expanded="${canExpand ? item.isExpanded : undefined}"
                 aria-selected="${isSelected}"
                 tabindex="-1"
                 style="display: flex; align-items: center; height: 22px; padding-left: ${depth * 16 + 8}px; cursor: pointer; color: #cccccc; user-select: none; position: relative; ${isSelected ? 'background-color: #37373d;' : ''}"
                 draggable="true">
                
                <div class="tree-item-content" style="display: flex; align-items: center; flex: 1; min-width: 0;">
                    ${canExpand ? `
                        <div class="tree-item-expand" role="button" aria-label="${item.isExpanded ? '축소' : '확장'}" style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #cccccc; font-size: 12px;">
                            ${item.isExpanded ? '▼' : '▶'}
                        </div>
                    ` : '<div class="tree-item-expand-placeholder" style="width: 16px; height: 16px;"></div>'}
                    
                    <div class="tree-item-icon" style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; margin-right: 6px;">
                        ${this.getItemIcon(item)}
                    </div>
                    
                    <div class="tree-item-label" title="${item.tooltip || item.label}" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <span class="tree-item-name" style="font-size: 13px; color: #cccccc;">${this.highlightSearchTerm(item.label)}</span>
                        ${item.description ? `<span class="tree-item-description" style="font-size: 12px; color: #999999; margin-left: 6px;">${item.description}</span>` : ''}
                    </div>
                    
                    <div class="tree-item-actions" style="display: none; margin-left: 6px;">
                        ${this.renderItemActions(item)}
                    </div>
                </div>
            </div>
        `;
    }

    getItemIcon(item) {
        if (item.type === 'folder') {
            return item.isExpanded ? '📂' : '📁';
        }
        
        // File icons based on extension
        const ext = item.extension?.toLowerCase();
        switch (ext) {
            case 'js':
            case 'jsx':
                return '📄';
            case 'css':
            case 'scss':
            case 'less':
                return '🎨';
            case 'html':
            case 'htm':
                return '🌐';
            case 'md':
                return '📝';
            case 'json':
                return '⚙️';
            case 'bpmn':
                return '🔗';
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'svg':
                return '🖼️';
            default:
                return '📄';
        }
    }

    renderItemActions(item) {
        const actions = [];
        
        if (item.type === 'folder') {
            actions.push(`
                <button class="tree-action-button" title="새 파일" data-action="new-file">
                    <i class="codicon codicon-new-file"></i>
                </button>
                <button class="tree-action-button" title="새 폴더" data-action="new-folder">
                    <i class="codicon codicon-new-folder"></i>
                </button>
            `);
        }
        
        actions.push(`
            <button class="tree-action-button" title="이름 바꾸기" data-action="rename">
                <i class="codicon codicon-edit"></i>
            </button>
            <button class="tree-action-button" title="삭제" data-action="delete">
                <i class="codicon codicon-trash"></i>
            </button>
        `);
        
        return actions.join('');
    }

    highlightSearchTerm(text) {
        if (!this.searchTerm) return text;
        
        const regex = new RegExp(`(${this.escapeRegExp(this.searchTerm)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    attachEventListeners() {
        const treeView = this.container.querySelector('.tree-view');
        
        // Tree item click events
        treeView.addEventListener('click', (e) => {
            this.handleTreeClick(e);
        });

        // Tree item double click events
        treeView.addEventListener('dblclick', (e) => {
            this.handleTreeDoubleClick(e);
        });

        // Keyboard navigation
        treeView.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // Context menu
        treeView.addEventListener('contextmenu', (e) => {
            this.handleContextMenu(e);
        });

        // Drag and drop events
        this.setupDragAndDrop();

        // Header action buttons
        const actionButtons = this.container.querySelectorAll('.action-button');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleActionClick(e, button);
            });
        });

        // Search functionality
        this.setupSearch();

        // Focus management
        treeView.addEventListener('focus', () => {
            if (!this.focusedItem) {
                this.setFocusedItem(this.dataProvider.root);
            }
        });
    }

    handleTreeClick(event) {
        console.log('🖱️ Tree click event:', event.target);
        const treeItem = event.target.closest('.tree-item');
        if (!treeItem) {
            console.log('❌ No tree item found');
            return;
        }

        const itemId = treeItem.dataset.itemId;
        console.log('📍 Tree item ID:', itemId);
        const item = this.dataProvider.findNodeById(itemId);
        if (!item) {
            console.log('❌ Item not found for ID:', itemId);
            return;
        }

        // Handle expand/collapse button click
        const expandButton = event.target.closest('.tree-item-expand');
        console.log('🔍 Expand button check:', expandButton);
        if (expandButton) {
            console.log('📂 Toggling folder (expand button):', item.label, 'isExpanded:', item.isExpanded);
            event.stopPropagation();
            this.dataProvider.toggleNode(item);
            // Force refresh the entire tree to ensure UI updates
            console.log('🔄 Force refreshing tree after expand button click...');
            this.refreshTree();
            return;
        }

        // Handle action button clicks
        const actionButton = event.target.closest('.tree-action-button');
        if (actionButton) {
            event.stopPropagation();
            this.handleItemAction(actionButton.dataset.action, item);
            return;
        }

        // Check if it's a folder - if so, toggle on click
        if (item.type === 'folder' && item.collapsibleState !== 0) { // TreeItemCollapsibleState.None = 0
            console.log('📂 Toggling folder (folder click):', item.label, 'isExpanded:', item.isExpanded);
            this.dataProvider.toggleNode(item);
            // Force refresh the entire tree to ensure UI updates
            console.log('🔄 Force refreshing tree after folder click...');
            this.refreshTree();
            // Also select the folder
            const multiSelect = event.ctrlKey || event.metaKey;
            this.selectItem(item, multiSelect);
            this.setFocusedItem(item);
            return;
        }

        // Regular item selection for files
        const multiSelect = event.ctrlKey || event.metaKey;
        this.selectItem(item, multiSelect);
        this.setFocusedItem(item);

        // Trigger callback
        if (this.onItemClick) {
            this.onItemClick(item, event);
        }
    }

    handleTreeDoubleClick(event) {
        const treeItem = event.target.closest('.tree-item');
        if (!treeItem) return;

        const itemId = treeItem.dataset.itemId;
        const item = this.dataProvider.findNodeById(itemId);
        if (!item) return;

        // Double click to expand/collapse folders or open files
        if (item.type === 'folder') {
            this.dataProvider.toggleNode(item);
        }

        if (this.onItemDoubleClick) {
            this.onItemDoubleClick(item, event);
        }
    }

    handleKeyDown(event) {
        if (!this.focusedItem) return;

        const { key, ctrlKey, shiftKey } = event;
        let handled = true;

        switch (key) {
            case 'ArrowDown':
                this.moveFocus('down', shiftKey);
                break;
            case 'ArrowUp':
                this.moveFocus('up', shiftKey);
                break;
            case 'ArrowRight':
                if (this.focusedItem.type === 'folder' && !this.focusedItem.isExpanded) {
                    this.dataProvider.expandNode(this.focusedItem);
                } else {
                    this.moveFocus('down', shiftKey);
                }
                break;
            case 'ArrowLeft':
                if (this.focusedItem.type === 'folder' && this.focusedItem.isExpanded) {
                    this.dataProvider.collapseNode(this.focusedItem);
                } else if (this.focusedItem.parent) {
                    this.setFocusedItem(this.focusedItem.parent);
                }
                break;
            case 'Enter':
            case ' ':
                if (this.focusedItem.type === 'folder') {
                    this.dataProvider.toggleNode(this.focusedItem);
                } else if (this.onItemDoubleClick) {
                    this.onItemDoubleClick(this.focusedItem, event);
                }
                break;
            case 'F2':
                this.handleItemAction('rename', this.focusedItem);
                break;
            case 'Delete':
                this.handleItemAction('delete', this.focusedItem);
                break;
            default:
                handled = false;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    moveFocus(direction, multiSelect = false) {
        const visibleNodes = this.dataProvider.getVisibleNodes(this.dataProvider.root, true);
        const currentIndex = visibleNodes.indexOf(this.focusedItem);
        
        let newIndex;
        if (direction === 'down') {
            newIndex = Math.min(currentIndex + 1, visibleNodes.length - 1);
        } else {
            newIndex = Math.max(currentIndex - 1, 0);
        }
        
        const newItem = visibleNodes[newIndex];
        if (newItem) {
            this.setFocusedItem(newItem);
            
            if (multiSelect) {
                this.selectItem(newItem, true);
            } else {
                this.selectItem(newItem, false);
            }
        }
    }

    handleContextMenu(event) {
        event.preventDefault();
        
        const treeItem = event.target.closest('.tree-item');
        if (!treeItem) return;

        const itemId = treeItem.dataset.itemId;
        const item = this.dataProvider.findNodeById(itemId);
        if (!item) return;

        // Select the item before showing context menu
        this.selectItem(item, false);
        this.setFocusedItem(item);

        // Show context menu
        this.contextMenu.show(item, event.clientX, event.clientY);

        if (this.onContextMenu) {
            this.onContextMenu(item, event);
        }
    }

    handleActionClick(event, button) {
        const action = button.dataset.action;
        
        switch (action) {
            case 'new-file':
                this.createNewFile();
                break;
            case 'new-folder':
                this.createNewFolder();
                break;
            case 'refresh':
                this.refreshProjectData();
                break;
            case 'collapse-all':
                this.collapseAll();
                break;
        }
    }

    handleItemAction(action, item) {
        switch (action) {
            case 'new-file':
                this.createNewFile(item);
                break;
            case 'new-folder':
                this.createNewFolder(item);
                break;
            case 'rename':
                this.renameItem(item);
                break;
            case 'delete':
                this.deleteItem(item);
                break;
        }
    }

    selectItem(item, multiSelect = false) {
        if (multiSelect) {
            if (this.dataProvider.isSelected(item)) {
                this.dataProvider.deselectNode(item);
            } else {
                this.dataProvider.selectNode(item, true);
            }
        } else {
            this.dataProvider.selectNode(item, false);
        }
        
        this.selectedItem = item;
        
        if (this.onSelectionChange) {
            this.onSelectionChange(this.dataProvider.getSelectedNodes());
        }
    }

    setFocusedItem(item) {
        // Remove focus from previous item
        if (this.focusedItem) {
            const prevElement = this.container.querySelector(`[data-item-id="${this.focusedItem.id}"]`);
            if (prevElement) {
                prevElement.classList.remove('focused');
                prevElement.tabIndex = -1;
            }
        }
        
        // Set focus to new item
        this.focusedItem = item;
        const element = this.container.querySelector(`[data-item-id="${item.id}"]`);
        if (element) {
            element.classList.add('focused');
            element.tabIndex = 0;
            element.focus();
        }
    }

    setupDragAndDrop() {
        const treeView = this.container.querySelector('.tree-view');
        
        treeView.addEventListener('dragstart', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem) {
                const itemId = treeItem.dataset.itemId;
                const item = this.dataProvider.findNodeById(itemId);
                if (item) {
                    this.draggedItem = item;
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                    treeItem.classList.add('dragging');
                }
            }
        });

        treeView.addEventListener('dragend', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem) {
                treeItem.classList.remove('dragging');
            }
            this.draggedItem = null;
            
            // Remove all drag-over styles
            const dragOverItems = this.container.querySelectorAll('.drag-over');
            dragOverItems.forEach(item => item.classList.remove('drag-over'));
        });


        treeView.addEventListener('dragenter', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem) {
                const itemId = treeItem.dataset.itemId;
                const item = this.dataProvider.findNodeById(itemId);
                
                // 폴더이거나 파일인 경우 드롭 인디케이터 업데이트
                if (item && (item.type === 'folder' || item.type === 'file' || item.type === 'diagram')) {
                    this.updateDropIndicators(e);
                }
            }
        });

        // 마우스 이동 시 드롭 인디케이터 업데이트
        treeView.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const treeItem = e.target.closest('.tree-item');
            if (treeItem && this.draggedItem) {
                this.updateDropIndicators(e);
            }
            
            // 빈 영역에 대한 드래그오버 효과 추가
            if (!treeItem && e.target === treeView) {
                treeView.classList.add('drag-over-root');
            } else {
                treeView.classList.remove('drag-over-root');
            }
        });

        treeView.addEventListener('dragleave', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem) {
                treeItem.classList.remove('drag-over');
            }
        });

        treeView.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const treeItem = e.target.closest('.tree-item');
            
            // 빈 영역에 드롭한 경우 (루트로 이동)
            if (!treeItem && this.draggedItem) {
                console.log('📁 Moving to root folder');
                this.moveItem(this.draggedItem, this.dataProvider.root);
                treeView.classList.remove('drag-over-root');
            } else if (treeItem && this.draggedItem) {
                const targetItemId = treeItem.dataset.itemId;
                const targetItem = this.dataProvider.findNodeById(targetItemId);
                
                if (targetItem && targetItem !== this.draggedItem) {
                    // 드롭 위치 확인 (위, 아래, 또는 안쪽)
                    const dropPosition = this.getDropPosition(treeItem);
                    console.log('📍 Drop position:', dropPosition, 'on item:', targetItem.label);
                    
                    if (dropPosition === 'into' && targetItem.type === 'folder') {
                        // 폴더 안으로 이동
                        console.log('📁 Moving into folder:', targetItem.label);
                        this.moveItem(this.draggedItem, targetItem);
                    } else if (dropPosition === 'before' || dropPosition === 'after') {
                        // 같은 레벨에서 순서 변경 또는 폴더간 이동
                        console.log('🔄 Reordering at same level:', dropPosition, targetItem.label);
                        
                        // 같은 부모인 경우에만 재정렬, 다른 부모인 경우 폴더 이동
                        if (this.draggedItem.parent === targetItem.parent) {
                            this.reorderItem(this.draggedItem, targetItem, dropPosition);
                        } else {
                            // 폴더간 이동: 타겟 아이템의 부모 폴더로 이동
                            const targetFolder = targetItem.parent || this.dataProvider.root;
                            console.log('📁 Moving to different folder:', targetFolder.label || 'root');
                            this.moveItem(this.draggedItem, targetFolder);
                        }
                    } else {
                        // 기본 폴더 이동 로직 (파일에 드롭한 경우)
                        let targetFolder = targetItem;
                        
                        if (targetItem.type === 'file' || targetItem.type === 'diagram') {
                            targetFolder = targetItem.parent || this.dataProvider.root;
                        }
                        
                        if (targetFolder && targetFolder !== this.draggedItem) {
                            console.log('📁 Moving to parent folder:', targetFolder.label || 'root');
                            this.moveItem(this.draggedItem, targetFolder);
                        }
                    }
                }
            }
            
            // Clean up drag-over styles and position indicators
            this.clearDragOverStyles();
            
            // 드래그 위치 상태 초기화
            this.lastDropPosition = null;
        });
    }

    setupSearch() {
        const searchInput = this.container.querySelector('.search-input');
        const searchClear = this.container.querySelector('.search-clear');
        
        // Toggle search input visibility
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.toggleSearch();
            }
            // Global search (Ctrl+Shift+F)
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                this.toggleGlobalSearch();
            }
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                // Use global search for more comprehensive results
                this.performGlobalSearch(this.searchTerm);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                this.clearSearch();
            });
        }
    }

    setupAccessibility() {
        const treeView = this.container.querySelector('.tree-view');
        
        // Set ARIA properties
        treeView.setAttribute('aria-multiselectable', 'true');
        treeView.setAttribute('aria-activedescendant', '');
        
        // Note: We don't set the callback here since it's already set in setupDataProvider()
        // The existing callback will handle both tree refresh and accessibility updates
    }

    setupContextMenu() {
        console.log('📍 Setting up context menu...');
        
        // Set context menu action handler
        this.contextMenu.setOnAction((action, item) => {
            this.handleContextMenuAction(action, item);
        });
        
        console.log('✅ Context menu setup complete');
    }

    handleContextMenuAction(action, item) {
        console.log('📋 Context menu action:', action, 'for item:', item.label);
        
        switch (action) {
            case 'open':
                if (this.onItemDoubleClick) {
                    this.onItemDoubleClick(item);
                }
                break;
            case 'new-file':
                this.createNewFile(item);
                break;
            case 'new-folder':
                this.createNewFolder(item);
                break;
            case 'rename':
                this.renameItem(item);
                break;
            case 'delete':
                this.deleteItem(item);
                break;
            case 'cut':
                this.cutItem(item);
                break;
            case 'copy':
                this.copyItem(item);
                break;
            case 'paste':
                this.pasteItem(item);
                break;
            case 'export':
                this.exportItem(item);
                break;
            case 'properties':
                this.showProperties(item);
                break;
            case 'collapse-all':
                this.collapseAll();
                break;
            case 'refresh':
                this.refreshProjectData();
                break;
            default:
                console.log('🔍 Unknown context menu action:', action);
        }
    }

    updateAriaProperties() {
        const treeItems = this.container.querySelectorAll('.tree-item');
        treeItems.forEach((element, index) => {
            element.setAttribute('aria-setsize', treeItems.length);
            element.setAttribute('aria-posinset', index + 1);
        });
        
        if (this.focusedItem) {
            const treeView = this.container.querySelector('.tree-view');
            treeView.setAttribute('aria-activedescendant', this.focusedItem.id);
        }
    }

    // Public API methods
    toggleSearch() {
        const searchContainer = this.container.querySelector('.explorer-search');
        const searchInput = this.container.querySelector('.search-input');
        
        if (searchContainer.style.display === 'none') {
            searchContainer.style.display = 'block';
            searchInput.focus();
        } else {
            searchContainer.style.display = 'none';
            this.clearSearch();
        }
    }

    performSearch() {
        if (!this.searchTerm) {
            this.clearSearch();
            return;
        }
        
        this.filterMode = true;
        
        // Expand all folders that contain matching items
        const matches = this.dataProvider.filterNodes(item => 
            item.label.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
        
        matches.forEach(item => {
            let parent = item.parent;
            while (parent) {
                this.dataProvider.expandNode(parent);
                parent = parent.parent;
            }
        });
        
        this.refreshTree();
    }

    clearSearch() {
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.searchTerm = '';
        this.filterMode = false;
        this.refreshTree();
    }

    toggleGlobalSearch() {
        console.log('🔍 Toggling global search (Ctrl+Shift+F)');
        
        // First, ensure the search input is visible
        const searchContainer = this.container.querySelector('.explorer-search');
        const searchInput = this.container.querySelector('.search-input');
        
        if (searchContainer.style.display === 'none') {
            searchContainer.style.display = 'block';
        }
        
        // Focus on the search input
        if (searchInput) {
            searchInput.focus();
            searchInput.select(); // Select all text if any
        }
        
        // Show a tooltip or hint about global search
        this.showGlobalSearchHint();
    }

    showGlobalSearchHint() {
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            const originalPlaceholder = searchInput.placeholder;
            searchInput.placeholder = '전체 검색 (Ctrl+Shift+F) - 파일명과 내용 검색...';
            
            // Reset placeholder after 3 seconds
            setTimeout(() => {
                searchInput.placeholder = originalPlaceholder;
            }, 3000);
        }
    }

    performGlobalSearch(searchTerm) {
        console.log('🔍 Performing global search for:', searchTerm);
        
        if (!searchTerm || searchTerm.trim() === '') {
            this.clearSearch();
            return;
        }

        const trimmedTerm = searchTerm.trim().toLowerCase();
        this.filterMode = true;
        
        try {
            const appManager = window.appManager;
            if (!appManager || !appManager.currentProject) {
                console.log('❌ No project data available for search');
                return;
            }

            const { folders, diagrams } = appManager.currentProject;
            const results = [];

            // Search in folder names
            folders.forEach(folder => {
                if (folder.name.toLowerCase().includes(trimmedTerm)) {
                    results.push({
                        type: 'folder',
                        item: folder,
                        matchType: 'name'
                    });
                }
            });

            // Search in diagram names and content
            diagrams.forEach(diagram => {
                const nameMatch = diagram.name.toLowerCase().includes(trimmedTerm);
                const contentMatch = diagram.bpmn_xml && 
                                   diagram.bpmn_xml.toLowerCase().includes(trimmedTerm);

                if (nameMatch || contentMatch) {
                    results.push({
                        type: 'diagram',
                        item: diagram,
                        matchType: nameMatch ? 'name' : 'content'
                    });
                }
            });

            console.log(`🔍 Global search found ${results.length} results`);
            
            if (results.length === 0) {
                console.log('📝 No search results found');
                // Still perform the regular search to update UI
                this.performSearch();
                return;
            }

            // Expand folders containing results
            results.forEach(result => {
                const item = result.item;
                
                if (result.type === 'folder') {
                    // Expand the folder itself
                    const treeNode = this.dataProvider.findNodeById(item.id);
                    if (treeNode) {
                        this.dataProvider.expandNode(treeNode);
                    }
                } else if (result.type === 'diagram') {
                    // Expand the parent folder
                    if (item.folder_id) {
                        const parentFolder = folders.find(f => f.id === item.folder_id);
                        if (parentFolder) {
                            const treeNode = this.dataProvider.findNodeById(parentFolder.id);
                            if (treeNode) {
                                this.dataProvider.expandNode(treeNode);
                            }
                        }
                    }
                }
            });

            // Perform the regular search to update highlighting
            this.performSearch();

        } catch (error) {
            console.error('❌ Error performing global search:', error);
            // Fallback to regular search
            this.performSearch();
        }
    }

    async createNewFile(parentFolder = null) {
        try {
            const parent = parentFolder || this.selectedItem || this.dataProvider.root;
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
            
            // 다이어그램 생성 (AppManager의 기존 로직 사용)
            const { dbManager } = await import('../lib/database.js');
            
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
            
        } catch (error) {
            console.error('❌ Error creating file:', error);
            alert('다이어그램 생성 중 오류가 발생했습니다.');
        }
    }

    async createNewFolder(parentFolder = null) {
        try {
            const parent = parentFolder || this.selectedItem || this.dataProvider.root;
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
            const { dbManager } = await import('../lib/database.js');
            
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
            
        } catch (error) {
            console.error('❌ Error creating folder:', error);
            alert('폴더 생성 중 오류가 발생했습니다.');
        }
    }
    
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
            
        } catch (error) {
            console.error('❌ Failed to refresh project data:', error);
        }
    }
    
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
            
            const { dbManager } = await import('../lib/database.js');
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
            
        } catch (error) {
            console.error('❌ Error renaming item:', error);
            alert('이름 변경 중 오류가 발생했습니다.');
        }
    }

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
            
            const { dbManager } = await import('../lib/database.js');
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
            if (this.selectedItem === item) {
                this.selectedItem = null;
            }
            if (this.focusedItem === item) {
                this.focusedItem = null;
            }
            
            console.log(`✅ ${itemType} "${item.label}" 삭제 완료`);
            
        } catch (error) {
            console.error('❌ Error deleting item:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    }

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

    async moveItem(item, newParent) {
        try {
            console.log('📁 Moving item:', item.label, 'to:', newParent.label);
            
            // 자기 자신이나 자기 자신의 자식으로 이동하는 것을 방지
            if (item === newParent || this.isDescendantOf(newParent, item)) {
                console.log('❌ Cannot move item to itself or its descendant');
                alert('폴더를 자기 자신이나 하위 폴더로 이동할 수 없습니다.');
                return;
            }
            
            // 같은 부모 내에서 중복 이름 확인
            if (this.checkDuplicateNameForMove(item.label, item.type, newParent, item)) {
                alert(`대상 폴더에 이미 "${item.label}" 이름의 ${item.type === 'folder' ? '폴더' : '다이어그램'}가 존재합니다.`);
                return;
            }
            
            const appManager = window.appManager;
            if (!appManager || !appManager.currentProject) {
                console.error('❌ AppManager or current project not found');
                return;
            }
            
            const { dbManager } = await import('../lib/database.js');
            let result;
            
            // 새로운 부모 폴더 ID 계산
            let newParentId = null;
            if (newParent && newParent.folderId) {
                newParentId = newParent.folderId;
            }
            
            if (item.type === 'folder') {
                // 폴더 이동
                result = await dbManager.updateFolder(item.folderId, { parent_id: newParentId });
            } else {
                // 다이어그램 이동
                const updates = {
                    folder_id: newParentId,
                    last_modified_by: appManager.currentUser?.id
                };
                result = await dbManager.updateDiagram(item.diagramId, updates);
            }
            
            if (result.error) {
                console.error('❌ Failed to move item:', result.error);
                alert(`${item.type === 'folder' ? '폴더' : '다이어그램'} 이동에 실패했습니다.`);
                return;
            }
            
            console.log('✅ Item moved successfully:', result.data);
            
            // 프로젝트 데이터 새로고침 후 트리 업데이트
            await this.refreshProjectData();
            
            console.log(`✅ "${item.label}" 이동 완료`);
            
        } catch (error) {
            console.error('❌ Error moving item:', error);
            alert('이동 중 오류가 발생했습니다.');
        }
    }

    isDescendantOf(potentialDescendant, ancestor) {
        // ancestor가 폴더가 아니면 descendant가 될 수 없음
        if (ancestor.type !== 'folder') {
            return false;
        }
        
        let current = potentialDescendant.parent;
        while (current) {
            if (current === ancestor) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    checkDuplicateNameForMove(name, type, newParentItem, currentItem) {
        try {
            const appManager = window.appManager;
            if (!appManager || !appManager.currentProject) {
                return false;
            }
            
            const { folders, diagrams } = appManager.currentProject;
            
            // 새 부모 폴더 ID 확인
            let newParentId = null;
            if (newParentItem && newParentItem.folderId) {
                newParentId = newParentItem.folderId;
            }
            
            if (type === 'folder') {
                // 같은 부모 폴더 내에서 중복 폴더명 확인 (자기 자신 제외)
                return folders.some(folder => 
                    folder.name === name && 
                    folder.parent_id === newParentId && 
                    folder.id !== currentItem.folderId
                );
            } else if (type === 'diagram') {
                // 같은 폴더 내에서 중복 다이어그램명 확인 (자기 자신 제외)
                return diagrams.some(diagram => 
                    diagram.name === name && 
                    diagram.folder_id === newParentId && 
                    diagram.id !== currentItem.diagramId
                );
            }
            
            return false;
        } catch (error) {
            console.error('❌ Error checking duplicate name for move:', error);
            return false;
        }
    }

    cutItem(item) {
        console.log('✂️ Cut item:', item.label);
        // TODO: Implement cut functionality
        // For now, just show a placeholder message
        console.log('🔄 Cut functionality will be implemented in future version');
    }

    copyItem(item) {
        console.log('📋 Copy item:', item.label);
        // TODO: Implement copy functionality
        // For now, just show a placeholder message
        console.log('🔄 Copy functionality will be implemented in future version');
    }

    pasteItem(item) {
        console.log('📌 Paste to:', item.label);
        // TODO: Implement paste functionality
        // For now, just show a placeholder message
        console.log('🔄 Paste functionality will be implemented in future version');
    }

    async exportItem(item) {
        try {
            console.log('💾 Export item:', item.label);
            
            if (item.type !== 'diagram') {
                alert('폴더는 내보낼 수 없습니다. 다이어그램을 선택해주세요.');
                return;
            }

            const appManager = window.appManager;
            if (!appManager) {
                console.error('❌ AppManager not found');
                return;
            }

            // BPMN 에디터를 통해 내보내기
            if (appManager.bpmnEditor) {
                // 먼저 다이어그램을 열고 내보내기
                const diagram = appManager.currentProject.diagrams.find(d => d.id === item.diagramId);
                if (diagram) {
                    await appManager.bpmnEditor.openDiagram({
                        id: diagram.id,
                        name: diagram.name,
                        content: diagram.bpmn_xml
                    });
                    
                    // 내보내기 실행
                    appManager.bpmnEditor.exportDiagram();
                }
            }
        } catch (error) {
            console.error('❌ Error exporting item:', error);
            alert('내보내기 중 오류가 발생했습니다.');
        }
    }

    showProperties(item) {
        console.log('📋 Show properties for:', item.label);
        
        const itemType = item.type === 'folder' ? '폴더' : '다이어그램';
        const createdDate = item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '알 수 없음';
        const updatedDate = item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '알 수 없음';
        
        let propertiesText = `📋 ${itemType} 속성\n\n`;
        propertiesText += `이름: ${item.label}\n`;
        propertiesText += `타입: ${itemType}\n`;
        propertiesText += `생성일: ${createdDate}\n`;
        propertiesText += `수정일: ${updatedDate}\n`;
        
        if (item.type === 'folder') {
            const childCount = item.children ? item.children.length : 0;
            propertiesText += `하위 항목: ${childCount}개\n`;
        }
        
        alert(propertiesText);
    }

    refresh() {
        this.dataProvider.refresh();
    }

    refreshTree(element = null) {
        console.log('🔄 Refreshing tree, element:', element);
        
        if (element) {
            // Partial refresh - update specific element
            const elementDiv = this.container.querySelector(`[data-item-id="${element.id}"]`);
            if (elementDiv) {
                // Update the specific item and its children
                this.updateTreeItem(element, elementDiv);
            }
        } else {
            // Full refresh
            console.log('🔄 Looking for tree-view container...');
            const treeView = this.container.querySelector('.tree-view');
            console.log('🔄 Tree view element:', treeView);
            
            if (!treeView) {
                console.error('❌ Tree view container not found, cannot refresh');
                return;
            }
            
            // 프로젝트명 업데이트
            this.updateProjectNameDisplay();
            
            console.log('🔄 Rendering tree content...');
            const treeContent = this.renderTree();
            console.log('🔄 Tree content length:', treeContent.length);
            
            treeView.innerHTML = treeContent;
            console.log('✅ Tree refreshed successfully');
        }
        
        // Always update accessibility properties after any refresh
        this.updateAriaProperties();
    }
    
    updateProjectNameDisplay() {
        try {
            console.log('🔄 Updating project name display...');
            const projectName = this.getProjectName();
            console.log('📍 Current project name:', projectName);
            
            // 기존 프로젝트명 요소 찾기
            const titleDiv = this.container.querySelector('.explorer-title > div');
            if (titleDiv) {
                let projectSpan = titleDiv.querySelector('span');
                
                if (projectName) {
                    if (!projectSpan) {
                        // 프로젝트명 스팬이 없으면 생성
                        projectSpan = document.createElement('span');
                        projectSpan.style.cssText = 'font-size: 12px; color: #999999; margin-top: 2px; font-weight: 400;';
                        titleDiv.appendChild(projectSpan);
                    }
                    projectSpan.textContent = projectName;
                    projectSpan.style.display = 'block';
                    console.log('✅ Project name updated:', projectName);
                } else {
                    if (projectSpan) {
                        projectSpan.style.display = 'none';
                    }
                    console.log('❌ No project name found');
                }
            } else {
                console.warn('❌ Title div not found');
            }
        } catch (error) {
            console.warn('Failed to update project name display:', error);
        }
    }

    updateTreeItem(item, element) {
        // Update the tree item element with new data
        element.outerHTML = this.renderTreeItem(item);
    }

    collapseAll() {
        const allNodes = this.dataProvider.getAllNodes();
        allNodes.forEach(node => {
            if (node.type === 'folder') {
                this.dataProvider.collapseNode(node);
            }
        });
    }

    expandAll() {
        const allNodes = this.dataProvider.getAllNodes();
        allNodes.forEach(node => {
            if (node.type === 'folder') {
                this.dataProvider.expandNode(node);
            }
        });
    }

    // Event callback setters
    setOnItemClick(callback) {
        this.onItemClick = callback;
    }

    setOnItemDoubleClick(callback) {
        this.onItemDoubleClick = callback;
    }

    setOnSelectionChange(callback) {
        this.onSelectionChange = callback;
    }

    setOnContextMenu(callback) {
        this.onContextMenu = callback;
    }

    // Getter methods
    getSelectedItems() {
        return this.dataProvider.getSelectedNodes();
    }

    getFocusedItem() {
        return this.focusedItem;
    }

    getDataProvider() {
        return this.dataProvider;
    }

    clearDragOverStyles() {
        const dragOverItems = this.container.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after');
        dragOverItems.forEach(item => {
            item.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
        });
        
        // Remove root drag-over style
        const treeView = this.container.querySelector('.tree-view');
        if (treeView) {
            treeView.classList.remove('drag-over-root');
        }
        
        // Remove drop indicators
        const indicators = this.container.querySelectorAll('.drop-indicator');
        indicators.forEach(indicator => indicator.remove());
    }
    
    clearPositionIndicators(treeItem) {
        treeItem.classList.remove('drag-over-before', 'drag-over-after');
        const indicators = treeItem.querySelectorAll('.drop-indicator');
        indicators.forEach(indicator => indicator.remove());
    }
    
    updateDropIndicators(event) {
        if (!this.draggedItem) return;
        
        const treeItem = event.target.closest('.tree-item');
        if (!treeItem) return;
        
        // Clear previous indicators
        this.clearDragOverStyles();
        
        const rect = treeItem.getBoundingClientRect();
        const mouseY = event.clientY;
        const itemTop = rect.top;
        const itemBottom = rect.bottom;
        const itemHeight = rect.height;
        
        // Determine drop position based on mouse position within the item
        const relativeY = mouseY - itemTop;
        const upperThird = itemHeight / 3;
        const lowerThird = itemHeight * 2 / 3;
        
        const itemId = treeItem.dataset.itemId;
        const targetItem = this.dataProvider.findNodeById(itemId);
        
        if (targetItem && targetItem !== this.draggedItem) {
            if (targetItem.type === 'folder') {
                // For folders, allow dropping into, above, or below
                if (relativeY < upperThird) {
                    // Drop above - reorder
                    treeItem.classList.add('drag-over-before');
                    this.createDropIndicator(treeItem, 'before');
                    console.log('🔼 Drop above folder for reordering');
                } else if (relativeY > lowerThird) {
                    // Drop below - reorder
                    treeItem.classList.add('drag-over-after');
                    this.createDropIndicator(treeItem, 'after');
                    console.log('🔽 Drop below folder for reordering');
                } else {
                    // Drop into folder - move
                    treeItem.classList.add('drag-over');
                    console.log('📁 Drop into folder for moving');
                }
            } else if (targetItem.type === 'file' || targetItem.type === 'diagram') {
                // For files, allow dropping above or below for reordering
                if (relativeY < itemHeight / 2) {
                    treeItem.classList.add('drag-over-before');
                    this.createDropIndicator(treeItem, 'before');
                    // 로그 스팸 방지: 같은 위치에 대해서는 로그 출력하지 않음
                    if (this.lastDropPosition !== 'before-' + targetItem.label) {
                        console.log('🔼 Drop above file for reordering');
                        this.lastDropPosition = 'before-' + targetItem.label;
                    }
                } else {
                    treeItem.classList.add('drag-over-after');
                    this.createDropIndicator(treeItem, 'after');
                    // 로그 스팸 방지: 같은 위치에 대해서는 로그 출력하지 않음
                    if (this.lastDropPosition !== 'after-' + targetItem.label) {
                        console.log('🔽 Drop below file for reordering');
                        this.lastDropPosition = 'after-' + targetItem.label;
                    }
                }
            }
        }
    }
    
    /**
     * 드롭 위치 표시 인디케이터 생성
     */
    createDropIndicator(treeItem, position) {
        // 기존 인디케이터 제거
        const existingIndicators = treeItem.querySelectorAll('.drop-indicator');
        existingIndicators.forEach(indicator => indicator.remove());
        
        // 새 인디케이터 생성
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator fade-in';
        indicator.style.cssText = `
            position: absolute;
            left: 16px;
            right: 8px;
            height: 2px;
            background-color: #007acc;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 0 4px rgba(0, 122, 204, 0.6);
        `;
        
        if (position === 'before') {
            indicator.style.top = '-1px';
        } else if (position === 'after') {
            indicator.style.bottom = '-1px';
        }
        
        // 인디케이터 점(dot) 추가
        const dot = document.createElement('div');
        dot.style.cssText = `
            position: absolute;
            left: -4px;
            top: -3px;
            width: 8px;
            height: 8px;
            background-color: #007acc;
            border-radius: 50%;
            box-shadow: 0 0 4px rgba(0, 122, 204, 0.6);
        `;
        indicator.appendChild(dot);
        
        // 트리 아이템에 상대 위치 설정
        if (treeItem.style.position !== 'relative') {
            treeItem.style.position = 'relative';
        }
        
        treeItem.appendChild(indicator);
    }
    
    getDropPosition(treeItem) {
        if (treeItem.classList.contains('drag-over-before')) return 'before';
        if (treeItem.classList.contains('drag-over-after')) return 'after';
        if (treeItem.classList.contains('drag-over')) return 'into';
        return 'none';
    }
    
    async reorderItem(draggedItem, targetItem, position) {
        try {
            console.log('🔄 Reordering item:', draggedItem.label, position, targetItem.label);
            
            // Check if items are in the same parent
            if (draggedItem.parent !== targetItem.parent) {
                console.log('❌ Items are not in the same parent, cannot reorder');
                return;
            }
            
            const parent = draggedItem.parent || this.dataProvider.root;
            const siblings = parent.children;
            
            // Find current positions
            const draggedIndex = siblings.indexOf(draggedItem);
            const targetIndex = siblings.indexOf(targetItem);
            
            if (draggedIndex === -1 || targetIndex === -1) {
                console.log('❌ Could not find item positions');
                return;
            }
            
            // Calculate new position
            let newIndex = targetIndex;
            if (position === 'after') {
                newIndex = targetIndex + 1;
            }
            
            // Adjust if dragged item is before target
            if (draggedIndex < newIndex) {
                newIndex--;
            }
            
            // Remove from current position and insert at new position
            siblings.splice(draggedIndex, 1);
            siblings.splice(newIndex, 0, draggedItem);
            
            // Update sort order for all siblings in the parent
            const updatedItems = [];
            siblings.forEach((item, index) => {
                item.sortOrder = index;
                
                // Determine correct type for database
                let itemType = item.type;
                if (item.type === 'file' && item.diagramId) {
                    itemType = 'diagram';
                }
                
                updatedItems.push({
                    type: itemType,
                    folderId: item.folderId,
                    diagramId: item.diagramId,
                    sortOrder: index
                });
            });
            
            // Save order to database
            console.log('💾 Saving new order to database...');
            if (window.dbManager && window.dbManager.updateItemOrder) {
                const result = await window.dbManager.updateItemOrder(updatedItems);
                if (!result.success) {
                    console.error('❌ Failed to save order to database:', result.error);
                    // 실패시 원래 순서로 복원
                    siblings.splice(newIndex, 1);
                    siblings.splice(draggedIndex, 0, draggedItem);
                    return;
                }
            }
            
            console.log('✅ Item reordered and saved successfully');
            
            // Refresh the tree to show new order
            this.refreshTree();
            
        } catch (error) {
            console.error('❌ Error reordering item:', error);
        }
    }

    destroy() {
        // Clean up event listeners and resources
        this.dataProvider.setOnDidChangeTreeData(null);
        this.contextMenu.destroy();
        this.onItemClick = null;
        this.onItemDoubleClick = null;
        this.onSelectionChange = null;
        this.onContextMenu = null;
    }
}

export default Explorer;