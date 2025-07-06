/**
 * VS Code Layout Manager
 * Integrates Activity Bar, Explorer, and Editor in VS Code-style layout
 */

import ActivityBar from './ActivityBar.js';
import Explorer from './Explorer.js';
import AccessibilityManager from './AccessibilityManager.js';
import DragDropController from './DragDropController.js';

class VSCodeLayout {
    constructor(container) {
        this.container = container;
        this.currentView = 'explorer';
        this.isCollapsed = false;
        
        // Component instances
        this.activityBar = null;
        this.explorer = null;
        this.accessibilityManager = null;
        this.dragDropController = null;
        
        // Layout state
        this.sidebarWidth = 240;
        this.minSidebarWidth = 120;
        this.maxSidebarWidth = 600;
        
        this.init();
    }

    init() {
        try {
            console.log('🔧 VSCodeLayout init starting...');
            
            console.log('1️⃣ Creating layout...');
            this.createLayout();
            
            console.log('2️⃣ Initializing components...');
            this.initializeComponents();
            
            console.log('3️⃣ Setting up event listeners...');
            this.setupEventListeners();
            
            console.log('4️⃣ Setting up accessibility...');
            this.setupAccessibility();
            
            console.log('5️⃣ Loading layout state...');
            this.loadLayoutState();
            
            console.log('✅ VSCodeLayout init completed successfully');
        } catch (error) {
            console.error('❌ VSCodeLayout init failed:', error);
            throw error;
        }
    }

    createLayout() {
        this.container.innerHTML = `
            <div class="vscode-layout" style="display: flex; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; background-color: #252526; color: #cccccc;">
                <div class="activity-bar-container" style="width: 48px; background-color: #2c2c2c; border-right: 1px solid #3e3e3e;"></div>
                <div class="sidebar-container" style="display: flex; width: 240px; min-width: 120px; max-width: 600px; background-color: #252526; border-right: 1px solid #3e3e3e; position: relative;">
                    <div class="sidebar-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div class="explorer-container" data-view="explorer" style="flex: 1; overflow: auto;"></div>
                        <div class="search-container" data-view="search" style="display: none;">
                            <div class="view-placeholder" style="padding: 20px; text-align: center;">
                                <h3 style="color: #cccccc; margin-bottom: 10px;">검색</h3>
                                <p style="color: #999999;">검색 기능이 여기에 표시됩니다.</p>
                            </div>
                        </div>
                        <div class="source-control-container" data-view="source-control" style="display: none;">
                            <div class="view-placeholder" style="padding: 20px; text-align: center;">
                                <h3 style="color: #cccccc; margin-bottom: 10px;">소스 제어</h3>
                                <p style="color: #999999;">Git 소스 제어 기능이 여기에 표시됩니다.</p>
                            </div>
                        </div>
                        <div class="run-debug-container" data-view="run-debug" style="display: none;">
                            <div class="view-placeholder" style="padding: 20px; text-align: center;">
                                <h3 style="color: #cccccc; margin-bottom: 10px;">실행 및 디버그</h3>
                                <p style="color: #999999;">디버그 기능이 여기에 표시됩니다.</p>
                            </div>
                        </div>
                        <div class="extensions-container" data-view="extensions" style="display: none;">
                            <div class="view-placeholder" style="padding: 20px; text-align: center;">
                                <h3 style="color: #cccccc; margin-bottom: 10px;">확장</h3>
                                <p style="color: #999999;">확장 프로그램이 여기에 표시됩니다.</p>
                            </div>
                        </div>
                    </div>
                    <div class="sidebar-resize-handle" style="width: 4px; background-color: transparent; cursor: col-resize; position: absolute; right: 0; top: 0; bottom: 0; z-index: 10;"></div>
                </div>
                <div class="editor-container" style="flex: 1; display: flex; flex-direction: column; background-color: #1e1e1e; overflow: hidden;">
                    <div class="editor-content" style="flex: 1; position: relative;">
                        <!-- BPMN Editor will be inserted here -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        try {
            console.log('🔧 Initializing VS Code components...');
            
            // Initialize Activity Bar
            console.log('📍 Finding activity bar container...');
            const activityBarContainer = this.container.querySelector('.activity-bar-container');
            console.log('📍 Activity bar container:', activityBarContainer);
            
            if (!activityBarContainer) {
                throw new Error('Activity bar container not found');
            }
            
            console.log('📍 Creating Activity Bar...');
            this.activityBar = new ActivityBar(activityBarContainer);
            console.log('✅ Activity Bar created');
            
            // Initialize Explorer
            console.log('📍 Finding explorer container...');
            const explorerContainer = this.container.querySelector('.explorer-container');
            console.log('📍 Explorer container:', explorerContainer);
            
            if (!explorerContainer) {
                throw new Error('Explorer container not found');
            }
            
            console.log('📍 Creating Explorer...');
            this.explorer = new Explorer(explorerContainer);
            console.log('✅ Explorer created');
            
            // Initialize Accessibility Manager
            console.log('📍 Creating Accessibility Manager...');
            this.accessibilityManager = new AccessibilityManager();
            console.log('✅ Accessibility Manager created');
            
            // Initialize Drag Drop Controller
            console.log('📍 Creating Drag Drop Controller...');
            this.dragDropController = new DragDropController();
            console.log('✅ Drag Drop Controller created');
            
            // Set up component interactions
            console.log('📍 Setting up component callbacks...');
            this.setupComponentCallbacks();
            console.log('✅ Component callbacks set up');
            
            console.log('✅ All VS Code components initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize VS Code components:', error);
            throw error;
        }
    }

    setupComponentCallbacks() {
        // Activity Bar view change callback
        this.activityBar.setOnViewChangeCallback((viewId, previousViewId) => {
            this.switchView(viewId);
            this.accessibilityManager.announce(`${this.getViewDisplayName(viewId)}로 전환했습니다`);
        });

        // Explorer callbacks
        this.explorer.setOnItemClick((item, event) => {
            console.log('Explorer item clicked:', item.label);
            this.accessibilityManager.announce(`${item.label} 선택됨`);
        });

        this.explorer.setOnItemDoubleClick((item, event) => {
            if (item.type === 'file') {
                this.openFile(item);
                this.accessibilityManager.announce(`${item.label} 파일을 열었습니다`);
            }
        });

        this.explorer.setOnSelectionChange((selectedItems) => {
            if (selectedItems.length === 1) {
                this.accessibilityManager.announce(`${selectedItems[0]} 선택됨`);
            } else if (selectedItems.length > 1) {
                this.accessibilityManager.announce(`${selectedItems.length}개 항목 선택됨`);
            }
        });

        this.explorer.setOnContextMenu((item, event) => {
            this.showContextMenu(item, event);
        });

        // Set up drag and drop for explorer
        this.explorer.getDataProvider().setDragDropController(this.dragDropController);
        this.dragDropController.setOnDidChangeTreeData((element) => {
            this.explorer.refreshTree(element);
        });
    }

    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            this.handleGlobalKeydown(event);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });

        // Sidebar resizing
        this.setupSidebarResize();

        // View switching shortcuts
        this.setupViewShortcuts();
    }

    setupSidebarResize() {
        const resizeHandle = this.container.querySelector('.sidebar-resize-handle');
        const sidebar = this.container.querySelector('.sidebar-container');
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', (event) => {
            isResizing = true;
            startX = event.clientX;
            startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            event.preventDefault();
        });

        const handleMouseMove = (event) => {
            if (!isResizing) return;
            
            const deltaX = event.clientX - startX;
            let newWidth = startWidth + deltaX;
            
            // Apply constraints
            newWidth = Math.max(this.minSidebarWidth, Math.min(this.maxSidebarWidth, newWidth));
            
            sidebar.style.width = `${newWidth}px`;
            this.sidebarWidth = newWidth;
            
            // Save to localStorage
            this.saveLayoutState();
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        // Double-click to reset width
        resizeHandle.addEventListener('dblclick', () => {
            sidebar.style.width = '240px';
            this.sidebarWidth = 240;
            this.saveLayoutState();
            this.accessibilityManager.announce('사이드바 너비를 기본값으로 재설정했습니다');
        });
    }

    setupViewShortcuts() {
        const shortcuts = {
            'Ctrl+Shift+E': 'explorer',
            'Ctrl+Shift+F': 'search',
            'Ctrl+Shift+G': 'source-control',
            'Ctrl+Shift+D': 'run-debug',
            'Ctrl+Shift+X': 'extensions'
        };

        document.addEventListener('keydown', (event) => {
            const key = this.getShortcutKey(event);
            if (shortcuts[key]) {
                event.preventDefault();
                this.switchView(shortcuts[key]);
                this.activityBar.setActiveView(shortcuts[key]);
            }
        });
    }

    getShortcutKey(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        if (event.metaKey) parts.push('Meta');
        parts.push(event.key);
        return parts.join('+');
    }

    setupAccessibility() {
        // Set up ARIA landmarks
        const activityBar = this.container.querySelector('.activity-bar-container');
        const sidebar = this.container.querySelector('.sidebar-container');
        const editor = this.container.querySelector('.editor-container');
        
        activityBar.setAttribute('role', 'navigation');
        activityBar.setAttribute('aria-label', '기본 네비게이션');
        
        sidebar.setAttribute('role', 'complementary');
        sidebar.setAttribute('aria-label', '사이드바');
        
        editor.setAttribute('role', 'main');
        editor.setAttribute('aria-label', '에디터');

        // Set up keyboard navigation for tree view
        const treeView = this.container.querySelector('.tree-view');
        if (treeView) {
            const keyboardNavigation = this.accessibilityManager.getKeyboardNavigation();
            keyboardNavigation.setupTreeNavigation(treeView);
        }
    }

    handleGlobalKeydown(event) {
        // Toggle sidebar
        if (event.ctrlKey && event.key === 'b') {
            event.preventDefault();
            this.toggleSidebar();
        }

        // Focus management
        if (event.altKey) {
            switch (event.key) {
                case '1':
                    event.preventDefault();
                    this.focusActivityBar();
                    break;
                case '2':
                    event.preventDefault();
                    this.focusSidebar();
                    break;
                case '3':
                    event.preventDefault();
                    this.focusEditor();
                    break;
            }
        }

        // File operations
        if (event.ctrlKey) {
            switch (event.key) {
                case 'n':
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.createNewFolder();
                    } else {
                        event.preventDefault();
                        this.createNewFile();
                    }
                    break;
                case 'o':
                    event.preventDefault();
                    this.openFile();
                    break;
                case 's':
                    event.preventDefault();
                    this.saveFile();
                    break;
            }
        }
    }

    switchView(viewId) {
        // Hide all views
        const allViews = this.container.querySelectorAll('[data-view]');
        allViews.forEach(view => {
            view.style.display = 'none';
        });

        // Show selected view
        const targetView = this.container.querySelector(`[data-view="${viewId}"]`);
        if (targetView) {
            targetView.style.display = 'block';
            this.currentView = viewId;
            
            // Focus the view
            setTimeout(() => {
                if (viewId === 'explorer') {
                    this.focusExplorer();
                } else {
                    targetView.focus();
                }
            }, 100);
        }
    }

    toggleSidebar() {
        const sidebar = this.container.querySelector('.sidebar-container');
        
        if (this.isCollapsed) {
            sidebar.style.width = `${this.sidebarWidth}px`;
            sidebar.style.display = 'flex';
            this.isCollapsed = false;
            this.accessibilityManager.announce('사이드바를 열었습니다');
        } else {
            sidebar.style.width = '0';
            sidebar.style.display = 'none';
            this.isCollapsed = true;
            this.accessibilityManager.announce('사이드바를 닫았습니다');
        }
        
        this.saveLayoutState();
    }

    // Focus management methods
    focusActivityBar() {
        const activeItem = this.container.querySelector('.activity-bar-item.active');
        if (activeItem) {
            activeItem.focus();
            return true;
        }
        return false;
    }

    focusSidebar() {
        if (this.currentView === 'explorer') {
            return this.focusExplorer();
        } else {
            const currentViewContainer = this.container.querySelector(`[data-view="${this.currentView}"]`);
            if (currentViewContainer) {
                currentViewContainer.focus();
                return true;
            }
        }
        return false;
    }

    focusExplorer() {
        const treeView = this.container.querySelector('.tree-view');
        if (treeView) {
            treeView.focus();
            return true;
        }
        return false;
    }

    focusEditor() {
        const editorContent = this.container.querySelector('.editor-content');
        if (editorContent) {
            // Find focusable element in editor
            const focusable = editorContent.querySelector('[tabindex="0"], button, input, textarea, select');
            if (focusable) {
                focusable.focus();
                return true;
            } else {
                editorContent.focus();
                return true;
            }
        }
        return false;
    }

    // File operations
    createNewFile() {
        this.explorer.createNewFile();
        this.accessibilityManager.announce('새 파일 생성 대화상자를 열었습니다');
    }

    createNewFolder() {
        this.explorer.createNewFolder();
        this.accessibilityManager.announce('새 폴더 생성 대화상자를 열었습니다');
    }

    openFile(item = null) {
        if (item) {
            console.log('Opening file:', item.label);
            // Integrate with BPMN editor
            this.loadFileInEditor(item);
        } else {
            // Show file picker
            console.log('Show file picker');
        }
    }

    saveFile() {
        console.log('Saving current file');
        this.accessibilityManager.announce('파일을 저장했습니다');
    }

    loadFileInEditor(item) {
        const editorContent = this.container.querySelector('.editor-content');
        
        // Check if it's a BPMN file
        if (item.extension === 'bpmn') {
            this.loadBPMNFile(item, editorContent);
        } else {
            // Load other file types
            this.loadTextFile(item, editorContent);
        }
    }

    loadBPMNFile(item, container) {
        // This would integrate with your existing BPMN editor
        console.log('Loading BPMN file:', item.label);
        
        // Example integration with existing BPMN editor
        if (window.bpmnEditor) {
            window.bpmnEditor.loadDiagram(item.resourceUri || item.label);
        }
    }

    loadTextFile(item, container) {
        console.log('Loading text file:', item.label);
        
        // Simple text editor implementation
        container.innerHTML = `
            <div class="text-editor">
                <div class="editor-header">
                    <span class="file-name">${item.label}</span>
                    <div class="editor-actions">
                        <button class="editor-action" title="저장">
                            <i class="codicon codicon-save"></i>
                        </button>
                    </div>
                </div>
                <textarea class="text-content" placeholder="파일 내용이 여기에 표시됩니다..."></textarea>
            </div>
        `;
    }

    showContextMenu(item, event) {
        console.log('Showing context menu for:', item.label);
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="open">열기</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="rename">이름 바꾸기</div>
            <div class="context-menu-item" data-action="delete">삭제</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="copy">복사</div>
            <div class="context-menu-item" data-action="paste">붙여넣기</div>
        `;
        
        // Position context menu
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        
        document.body.appendChild(contextMenu);
        
        // Handle context menu clicks
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handleContextMenuAction(action, item);
                contextMenu.remove();
            }
        });
        
        // Remove on outside click
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                contextMenu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }

    handleContextMenuAction(action, item) {
        switch (action) {
            case 'open':
                this.openFile(item);
                break;
            case 'rename':
                this.explorer.renameItem(item);
                break;
            case 'delete':
                this.explorer.deleteItem(item);
                break;
            case 'copy':
                console.log('Copy:', item.label);
                break;
            case 'paste':
                console.log('Paste');
                break;
        }
    }

    handleWindowResize() {
        // Handle responsive layout changes
        const windowWidth = window.innerWidth;
        
        if (windowWidth < 768) {
            // Mobile layout adjustments
            this.container.classList.add('mobile-layout');
        } else {
            this.container.classList.remove('mobile-layout');
        }
    }

    getViewDisplayName(viewId) {
        const names = {
            'explorer': '탐색기',
            'search': '검색',
            'source-control': '소스 제어',
            'run-debug': '실행 및 디버그',
            'extensions': '확장'
        };
        return names[viewId] || viewId;
    }

    // State management
    saveLayoutState() {
        const state = {
            sidebarWidth: this.sidebarWidth,
            isCollapsed: this.isCollapsed,
            currentView: this.currentView
        };
        
        localStorage.setItem('vscode-layout-state', JSON.stringify(state));
    }

    loadLayoutState() {
        try {
            const saved = localStorage.getItem('vscode-layout-state');
            if (saved) {
                const state = JSON.parse(saved);
                
                this.sidebarWidth = state.sidebarWidth || 240;
                this.isCollapsed = state.isCollapsed || false;
                this.currentView = state.currentView || 'explorer';
                
                // Apply saved state
                const sidebar = this.container.querySelector('.sidebar-container');
                if (this.isCollapsed) {
                    sidebar.style.width = '0';
                    sidebar.style.display = 'none';
                } else {
                    sidebar.style.width = `${this.sidebarWidth}px`;
                }
                
                this.switchView(this.currentView);
                this.activityBar.setActiveView(this.currentView);
            }
        } catch (error) {
            console.warn('Failed to load layout state:', error);
        }
    }

    // Public API
    getActivityBar() {
        return this.activityBar;
    }

    getExplorer() {
        return this.explorer;
    }

    getAccessibilityManager() {
        return this.accessibilityManager;
    }

    getCurrentView() {
        return this.currentView;
    }

    getSidebarWidth() {
        return this.sidebarWidth;
    }

    setSidebarWidth(width) {
        const sidebar = this.container.querySelector('.sidebar-container');
        this.sidebarWidth = Math.max(this.minSidebarWidth, Math.min(this.maxSidebarWidth, width));
        sidebar.style.width = `${this.sidebarWidth}px`;
        this.saveLayoutState();
    }

    // Integration with existing BPMN app
    async integrateBPMNEditor(editorInstance) {
        const editorContent = this.container.querySelector('.editor-content');
        console.log('🔧 Integrating BPMN Editor...');
        console.log('📍 Editor content element:', editorContent);
        
        if (!editorContent) {
            console.error('❌ Editor content container not found');
            return;
        }
        
        // BPMN 에디터가 있는 경우 통합
        if (editorInstance) {
            console.log('📦 BPMN Editor instance found:', editorInstance);
            
            // 기존 플레이스홀더 제거
            editorContent.innerHTML = '';
            
            // BPMN 에디터 컨테이너 생성
            const bpmnContainer = document.createElement('div');
            bpmnContainer.id = 'bpmn-editor-container';
            bpmnContainer.style.cssText = `
                width: 100%;
                height: 100%;
                position: relative;
                background-color: #ffffff;
                overflow: hidden;
            `;
            
            editorContent.appendChild(bpmnContainer);
            
            // BPMN 에디터를 새 컨테이너에 재초기화
            try {
                console.log('🔧 Re-initializing BPMN editor in new container...');
                
                // 기존 에디터 파괴 후 새로 생성
                if (editorInstance.modeler) {
                    editorInstance.modeler.destroy();
                }
                
                // 새 컨테이너에 BPMN 에디터 초기화
                await editorInstance.initializeModeler(bpmnContainer);
                
                console.log('✅ BPMN editor successfully integrated');
                
            } catch (error) {
                console.error('❌ Failed to re-initialize BPMN editor:', error);
                this.createPlaceholder(editorContent);
            }
        } else {
            console.log('📦 No BPMN editor instance, creating ready container');
            this.createReadyContainer(editorContent);
        }
        
        // Set up BPMN-specific explorer integration
        await this.setupBPMNIntegration();
    }
    
    createPlaceholder(container) {
        const placeholder = document.createElement('div');
        placeholder.id = 'bpmn-editor-placeholder';
        placeholder.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #999999;
            font-size: 14px;
            text-align: center;
            background-color: #1e1e1e;
        `;
        placeholder.innerHTML = '<div class="editor-placeholder">BPMN 에디터를 로드하는 중...</div>';
        container.appendChild(placeholder);
    }
    
    createReadyContainer(container) {
        const readyContainer = document.createElement('div');
        readyContainer.id = 'bpmn-editor-ready';
        readyContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #cccccc;
            font-size: 14px;
            text-align: center;
            background-color: #1e1e1e;
            padding: 40px;
        `;
        readyContainer.innerHTML = `
            <div style="margin-bottom: 20px;">
                <i style="font-size: 48px;">🎨</i>
            </div>
            <div style="font-weight: 500; margin-bottom: 16px; font-size: 18px;">
                BPMN 에디터 준비 완료
            </div>
            <div style="color: #999999; line-height: 1.5; max-width: 400px;">
                Explorer에서 BPMN 다이어그램을 더블클릭하거나<br>
                새 다이어그램을 생성하여 편집을 시작하세요.
            </div>
        `;
        container.appendChild(readyContainer);
    }

    async setupBPMNIntegration() {
        console.log('🔧 Setting up BPMN integration...');
        
        // Add BPMN-specific items to explorer
        const dataProvider = this.explorer.getDataProvider();
        
        // Create BPMN project structure
        await this.createBPMNProjectStructure(dataProvider);
        
        // Set up BPMN file associations
        this.setupBPMNFileAssociations();
        
        console.log('✅ BPMN integration setup complete');
    }

    async createBPMNProjectStructure(dataProvider) {
        console.log('🔧 Setting up real BPMN project structure');
        
        // AppManager 인스턴스 가져오기
        const appManager = window.appManager;
        if (!appManager || !appManager.currentProject) {
            console.warn('❌ No AppManager or current project found');
            return;
        }
        
        const { currentProject } = appManager;
        console.log('📁 Loading project:', currentProject.name);
        console.log('📊 Folders:', currentProject.folders?.length || 0);
        console.log('📄 Diagrams:', currentProject.diagrams?.length || 0);
        
        // 실제 프로젝트 데이터로 트리 구조 생성
        const { FileTreeItem, TreeItemCollapsibleState } = await import('./TreeDataProvider.js');
        
        // 프로젝트 루트 생성 (루트로 표시)
        const root = new FileTreeItem('루트', 'folder', TreeItemCollapsibleState.Expanded);
        
        // 폴더 구조 구축
        const folders = currentProject.folders || [];
        const diagrams = currentProject.diagrams || [];
        
        // 루트 폴더들 (parent_id가 null인 폴더들)
        const rootFolders = folders.filter(folder => !folder.parent_id);
        // 루트 다이어그램들 (folder_id가 null인 다이어그램들) 
        const rootDiagrams = diagrams.filter(diagram => !diagram.folder_id);
        
        // 폴더들을 트리에 추가 (재귀적으로)
        for (const folder of rootFolders) {
            const folderItem = await this.createFolderTreeItem(folder, folders, diagrams);
            root.addChild(folderItem);
        }
        
        // 루트 다이어그램들 추가
        for (const diagram of rootDiagrams) {
            const diagramItem = await this.createDiagramTreeItem(diagram);
            root.addChild(diagramItem);
        }
        
        // 데이터 프로바이더에 루트 설정
        dataProvider.setRoot(root);
        
        console.log('✅ Real BPMN project structure created');
    }
    
    async createFolderTreeItem(folder, allFolders, allDiagrams) {
        const { FileTreeItem, TreeItemCollapsibleState } = await import('./TreeDataProvider.js');
        
        // 폴더 아이템 생성
        const folderItem = new FileTreeItem(
            folder.name, 
            'folder', 
            TreeItemCollapsibleState.Expanded
        );
        
        // 메타데이터 추가
        folderItem.id = `folder-${folder.id}`;
        folderItem.folderId = folder.id;
        folderItem.description = folder.description;
        folderItem.tooltip = `폴더: ${folder.name}`;
        
        // 하위 폴더들 찾기
        const childFolders = allFolders.filter(f => f.parent_id === folder.id);
        for (const childFolder of childFolders) {
            const childItem = await this.createFolderTreeItem(childFolder, allFolders, allDiagrams);
            folderItem.addChild(childItem);
        }
        
        // 이 폴더 내의 다이어그램들 찾기
        const folderDiagrams = allDiagrams.filter(d => d.folder_id === folder.id);
        for (const diagram of folderDiagrams) {
            const diagramItem = await this.createDiagramTreeItem(diagram);
            folderItem.addChild(diagramItem);
        }
        
        return folderItem;
    }
    
    async createDiagramTreeItem(diagram) {
        const { FileTreeItem } = await import('./TreeDataProvider.js');
        
        // 다이어그램 아이템 생성
        const diagramItem = new FileTreeItem(`${diagram.name}.bpmn`, 'file');
        
        // 메타데이터 추가
        diagramItem.id = `diagram-${diagram.id}`;
        diagramItem.diagramId = diagram.id;
        diagramItem.diagramData = diagram;
        diagramItem.tooltip = `BPMN 다이어그램: ${diagram.name}`;
        diagramItem.description = diagram.description;
        diagramItem.resourceUri = `bpmn://${diagram.id}`;
        
        // 마지막 수정 시간 설정
        if (diagram.updated_at) {
            diagramItem.lastModified = new Date(diagram.updated_at);
        }
        
        return diagramItem;
    }

    setupBPMNFileAssociations() {
        console.log('🔧 Setting up BPMN file associations');
        
        // Set up file type associations for BPMN files
        this.explorer.setOnItemDoubleClick((item, event) => {
            console.log('📂 Double-clicked item:', item.label, 'type:', item.type);
            
            if (item.type === 'file' && item.diagramId) {
                console.log('🎯 Opening BPMN diagram:', item.diagramId);
                this.openBPMNDiagram(item);
            }
        });
        
        // Single click selection feedback
        this.explorer.setOnItemClick((item, event) => {
            console.log('👆 Clicked item:', item.label);
            if (item.type === 'file' && item.diagramData) {
                // Show diagram info in status or somewhere
                console.log('📊 Diagram info:', {
                    name: item.diagramData.name,
                    created: item.diagramData.created_at,
                    modified: item.diagramData.updated_at
                });
            }
        });
    }
    
    async openBPMNDiagram(item) {
        try {
            console.log('🔧 Opening BPMN diagram:', item.diagramData);
            
            // AppManager를 통해 다이어그램 열기
            const appManager = window.appManager;
            if (!appManager) {
                console.error('❌ AppManager not found');
                return;
            }
            
            // BPMN 에디터가 초기화되지 않았다면 초기화
            if (!appManager.bpmnEditor) {
                console.log('🔧 BPMN Editor not initialized, initializing...');
                await appManager.initializeBpmnEditor();
                
                // VS Code 레이아웃에 다시 통합
                if (appManager.bpmnEditor) {
                    await this.integrateBPMNEditor(appManager.bpmnEditor);
                }
            }
            
            // 에디터 컨테이너 확인 및 준비
            const editorContent = this.container.querySelector('.editor-content');
            const readyContainer = editorContent?.querySelector('#bpmn-editor-ready');
            const placeholderContainer = editorContent?.querySelector('#bpmn-editor-placeholder');
            
            // 준비 상태 메시지나 플레이스홀더가 있다면 제거하고 에디터 컨테이너 생성
            if (readyContainer || placeholderContainer) {
                console.log('🔧 Replacing ready/placeholder container with BPMN editor...');
                
                // 기존 컨테이너 제거
                if (readyContainer) readyContainer.remove();
                if (placeholderContainer) placeholderContainer.remove();
                
                // BPMN 에디터 컨테이너 생성
                const bpmnContainer = document.createElement('div');
                bpmnContainer.id = 'bpmn-editor-container';
                bpmnContainer.style.cssText = `
                    width: 100%;
                    height: 100%;
                    position: relative;
                    background-color: #ffffff;
                    overflow: hidden;
                `;
                
                editorContent.appendChild(bpmnContainer);
                
                // BPMN 에디터를 새 컨테이너에 재초기화
                if (appManager.bpmnEditor.modeler) {
                    appManager.bpmnEditor.modeler.destroy();
                }
                await appManager.bpmnEditor.initializeModeler(bpmnContainer);
            }
            
            // 다이어그램 데이터로 BPMN 에디터에 로드
            await appManager.bpmnEditor.openDiagram({
                id: item.diagramData.id,
                name: item.diagramData.name,
                content: item.diagramData.bpmn_xml
            });
            
            console.log('✅ BPMN diagram opened successfully:', item.diagramData.name);
            
        } catch (error) {
            console.error('❌ Failed to open BPMN diagram:', error);
            // 에러 발생 시 사용자에게 알림
            alert('다이어그램을 열 수 없습니다. 다시 시도해주세요.');
        }
    }

    // Cleanup
    destroy() {
        if (this.activityBar) {
            this.activityBar.destroy();
        }
        
        if (this.explorer) {
            this.explorer.destroy();
        }
        
        if (this.accessibilityManager) {
            this.accessibilityManager.destroy();
        }
        
        if (this.dragDropController) {
            this.dragDropController.dispose();
        }
        
        // Save final state
        this.saveLayoutState();
    }
}

export default VSCodeLayout;