/**
 * VS Code Style Explorer Panel
 * Implements Explorer view with tree structure similar to VS Code
 */

import TreeDataProvider from './TreeDataProvider.js';

class Explorer {
    constructor(container) {
        this.container = container;
        this.dataProvider = new TreeDataProvider();
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
        
        console.log('✅ Explorer initialized');
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
        this.container.innerHTML = `
            <div class="explorer-panel" style="height: 100%; display: flex; flex-direction: column; background-color: #252526; color: #cccccc;">
                <div class="explorer-header" style="padding: 8px 16px; border-bottom: 1px solid #3e3e3e; background-color: #252526;">
                    <div class="explorer-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #cccccc; letter-spacing: 1px;">탐색기</h3>
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
        
        // Start with root's children, not root itself
        const visibleNodes = [];
        if (root.children && root.children.length > 0) {
            for (const child of root.children) {
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
        for (const child of parent.children) {
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
                 style="display: flex; align-items: center; height: 22px; padding-left: ${depth * 16 + 8}px; cursor: pointer; color: #cccccc; user-select: none; ${isSelected ? 'background-color: #37373d;' : ''}"
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

        treeView.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        treeView.addEventListener('dragenter', (e) => {
            const treeItem = e.target.closest('.tree-item');
            if (treeItem && treeItem.dataset.itemType === 'folder') {
                treeItem.classList.add('drag-over');
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
            if (treeItem && this.draggedItem) {
                const targetItemId = treeItem.dataset.itemId;
                const targetItem = this.dataProvider.findNodeById(targetItemId);
                
                if (targetItem && targetItem.type === 'folder' && targetItem !== this.draggedItem) {
                    this.moveItem(this.draggedItem, targetItem);
                }
            }
            
            // Clean up drag-over styles
            const dragOverItems = this.container.querySelectorAll('.drag-over');
            dragOverItems.forEach(item => item.classList.remove('drag-over'));
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
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.performSearch();
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

    renameItem(item) {
        // Implement rename logic
        console.log('Renaming item:', item.label);
    }

    deleteItem(item) {
        // Implement delete logic
        console.log('Deleting item:', item.label);
    }

    moveItem(item, newParent) {
        if (item.parent) {
            item.parent.removeChild(item);
        }
        newParent.addChild(item);
        this.dataProvider.refresh();
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
            
            console.log('🔄 Rendering tree content...');
            const treeContent = this.renderTree();
            console.log('🔄 Tree content length:', treeContent.length);
            
            treeView.innerHTML = treeContent;
            console.log('✅ Tree refreshed successfully');
        }
        
        // Always update accessibility properties after any refresh
        this.updateAriaProperties();
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

    destroy() {
        // Clean up event listeners and resources
        this.dataProvider.setOnDidChangeTreeData(null);
        this.onItemClick = null;
        this.onItemDoubleClick = null;
        this.onSelectionChange = null;
        this.onContextMenu = null;
    }
}

export default Explorer;