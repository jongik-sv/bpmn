/**
 * VS Code Layout Manager
 * Integrates Activity Bar, Explorer, and Editor in VS Code-style layout
 */

import ActivityBar from './ActivityBar.js';
import Explorer from './Explorer.js';
import AccessibilityManager from './AccessibilityManager.js';
import DragDropController from './DragDropController.js';
import EditorHeader from './EditorHeader.js';

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
        this.editorHeader = null;
        
        // Layout state
        this.sidebarWidth = 240;
        this.minSidebarWidth = 120;
        this.maxSidebarWidth = 600;
        
        this.init();
    }

    init() {
        try {
            this.createLayout();
            this.initializeComponents();
            this.setupEventListeners();
            this.setupAccessibility();
            this.loadLayoutState();
        } catch (error) {
            console.error('❌ VSCodeLayout init failed:', error);
            throw error;
        }
    }

    createLayout() {
        this.container.innerHTML = `
            <div class="vscode-layout" style="display: flex; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; background-color: #252526; color: #cccccc;">
                <div class="activity-bar-container" style="width: 48px; background-color: #2c2c2c; border-right: 1px solid #3e3e3e;"></div>
                <div class="sidebar-container" style="display: flex; width: 280px; min-width: 200px; max-width: 400px; background-color: #252526; border-right: 1px solid #3e3e3e; position: relative;">
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
                <div class="editor-container" style="flex: 1; display: flex; flex-direction: column; background-color: #1e1e1e; overflow: hidden; min-height: 0;">
                    <!-- Editor Header will be inserted here -->
                    <div class="editor-header-container" style="display: none;"></div>
                    <div class="editor-content" style="flex: 1; position: relative; min-height: 0; display: flex; overflow: hidden;">
                        <div class="editor-welcome-message" style="flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #cccccc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif; background-color: #1e1e1e;">
                            <div style="text-align: center; max-width: 400px;">
                                <div style="font-size: 48px; margin-bottom: 24px; opacity: 0.6;">📄</div>
                                <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 300; color: #ffffff;">BPMN 다이어그램을 선택하세요</h2>
                                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #999999;">
                                    왼쪽 탐색기에서 BPMN 다이어그램을 클릭하여 편집을 시작하세요.
                                </p>
                                <div style="display: flex; gap: 24px; justify-content: center; align-items: center; margin-top: 32px;">
                                    <div style="text-align: center; font-size: 14px; color: #888888;">
                                        <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
                                        <span>새 폴더 만들기</span>
                                    </div>
                                    <div style="text-align: center; font-size: 14px; color: #888888;">
                                        <div style="font-size: 28px; margin-bottom: 8px;">📄</div>
                                        <span>새 다이어그램 만들기</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- BPMN Editor will be inserted here -->
                    </div>
                </div>
            </div>
        `;
    }

    initializeComponents() {
        try {
            
            // Initialize Activity Bar
            const activityBarContainer = this.container.querySelector('.activity-bar-container');
            
            if (!activityBarContainer) {
                throw new Error('Activity bar container not found');
            }
            
            this.activityBar = new ActivityBar(activityBarContainer);
            
            // Initialize Explorer
            const explorerContainer = this.container.querySelector('.explorer-container');
            
            if (!explorerContainer) {
                throw new Error('Explorer container not found');
            }
            
            this.explorer = new Explorer(explorerContainer);
            
            // Initialize Editor Header
            this.editorHeader = new EditorHeader();
            
            // Initialize Accessibility Manager
            this.accessibilityManager = new AccessibilityManager();
            
            // Initialize Drag Drop Controller
            this.dragDropController = new DragDropController();
            
            // Set up component interactions
            this.setupComponentCallbacks();
            
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
            
            // 다이어그램인 경우 단일 클릭으로도 열기
            if (item.type === 'file' && (item.type === 'diagram' || item.diagramId)) {
                this.openBPMNDiagram(item);
            }
            
            this.accessibilityManager.announce(`${item.label} 선택됨`);
        });

        this.explorer.setOnItemDoubleClick((item, event) => {
            if (item.type === 'file' || item.type === 'diagram') {
                // BPMN 다이어그램인 경우 직접 처리
                if (item.type === 'diagram' || item.diagramId) {
                    this.openBPMNDiagram(item);
                } else {
                    this.openFile(item);
                }
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

        // Editor Header callbacks
        if (this.editorHeader) {
            this.editorHeader.setEventHandlers({
                onDashboardClick: () => {
                    this.goToDashboard();
                },
                onBreadcrumbClick: (id) => {
                    this.handleBreadcrumbNavigation(id);
                }
            });
        }
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
        console.log('Loading BPMN file:', item.label);
        
        // BPMN 다이어그램인 경우 openBPMNDiagram 메서드 사용
        if (item.type === 'diagram' || item.diagramId) {
            this.openBPMNDiagram(item);
        } else {
            console.warn('Item is not a valid BPMN diagram:', item);
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
                if (editorInstance.editorCore && editorInstance.editorCore.modeler) {
                    editorInstance.editorCore.modeler.destroy();
                }
                
                // 새 컨테이너에 BPMN 에디터 초기화
                await editorInstance.editorCore.initializeModeler(bpmnContainer);
                
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
            <div style="margin-bottom: 30px;">
                <i style="font-size: 64px;">📄</i>
            </div>
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 20px; color: #ffffff;">
                BPMN 다이어그램을 선택하세요
            </div>
            <div style="color: #999999; line-height: 1.6; margin-bottom: 30px; max-width: 500px;">
                왼쪽 탐색기에서 BPMN 다이어그램을 클릭하여 편집을 시작하세요.
            </div>
            <div style="display: flex; gap: 20px; margin-top: 20px;">
                <button id="create-folder-btn" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    background: #2d2d30;
                    border: 1px solid #464647;
                    border-radius: 8px;
                    color: #cccccc;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                    font-size: 12px;
                " onmouseover="this.style.background='#383838'" onmouseout="this.style.background='#2d2d30'">
                    <div style="font-size: 24px; margin-bottom: 8px;">📁</div>
                    <div>새 폴더 만들기</div>
                </button>
                <button id="create-diagram-btn" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    background: #2d2d30;
                    border: 1px solid #464647;
                    border-radius: 8px;
                    color: #cccccc;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                    font-size: 12px;
                " onmouseover="this.style.background='#383838'" onmouseout="this.style.background='#2d2d30'">
                    <div style="font-size: 24px; margin-bottom: 8px;">📄</div>
                    <div>새 다이어그램 만들기</div>
                </button>
            </div>
        `;
        
        // 이벤트 리스너 설정
        setTimeout(() => {
            const createFolderBtn = container.querySelector('#create-folder-btn');
            const createDiagramBtn = container.querySelector('#create-diagram-btn');
            
            if (createFolderBtn) {
                createFolderBtn.addEventListener('click', () => {
                    this.createNewFolder();
                });
            }
            
            if (createDiagramBtn) {
                createDiagramBtn.addEventListener('click', () => {
                    this.createNewDiagram();
                });
            }
        }, 100);
        
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
        
        // 실제 프로젝트 데이터로 트리 구조 생성
        const { FileTreeItem, TreeItemCollapsibleState } = await import('./TreeDataProvider.js');
        
        // 프로젝트 루트 생성 (루트로 표시)
        const root = new FileTreeItem('루트', 'folder', TreeItemCollapsibleState.Expanded);
        
        // 폴더 구조 구축
        const folders = currentProject.folders || [];
        const diagrams = currentProject.diagrams || [];
        
        // 루트 레벨의 모든 아이템들 (폴더 + 다이어그램)을 sort_order로 정렬
        const rootFolders = folders
            .filter(folder => !folder.parent_id)
            .map(f => ({ ...f, itemType: 'folder' }));
        
        const rootDiagrams = diagrams
            .filter(diagram => !diagram.folder_id)
            .map(d => ({ ...d, itemType: 'diagram' }));
        
        // 루트 폴더와 다이어그램을 합쳐서 sort_order로 정렬
        const allRootItems = [...rootFolders, ...rootDiagrams]
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        
        // 정렬된 순서대로 루트에 추가
        for (const item of allRootItems) {
            if (item.itemType === 'folder') {
                const folderItem = await this.createFolderTreeItem(item, folders, diagrams);
                root.addChild(folderItem);
            } else {
                const diagramItem = await this.createDiagramTreeItem(item);
                root.addChild(diagramItem);
            }
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
        folderItem.sortOrder = folder.sort_order || 0;
        
        // 이 폴더의 모든 자식 아이템들 (폴더 + 다이어그램)을 sort_order로 정렬
        const childFolders = allFolders
            .filter(f => f.parent_id === folder.id)
            .map(f => ({ ...f, itemType: 'folder' }));
        
        const folderDiagrams = allDiagrams
            .filter(d => d.folder_id === folder.id)
            .map(d => ({ ...d, itemType: 'diagram' }));
        
        // 폴더와 다이어그램을 합쳐서 sort_order로 정렬
        const allChildren = [...childFolders, ...folderDiagrams]
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
               
        // 정렬된 순서대로 트리에 추가
        for (const child of allChildren) {
            if (child.itemType === 'folder') {
                const childItem = await this.createFolderTreeItem(child, allFolders, allDiagrams);
                folderItem.addChild(childItem);
            } else {
                const diagramItem = await this.createDiagramTreeItem(child);
                folderItem.addChild(diagramItem);
            }
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
        diagramItem.sortOrder = diagram.sort_order || 0;
        
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
        
        // Single click to open diagram for editing
        this.explorer.setOnItemClick((item, event) => {
            console.log('👆 Clicked item:', item.label);
            // 다이어그램인 경우 단일 클릭으로도 열기
            if (item.type === 'file' && (item.diagramData || item.diagramId)) {
                console.log('🎯 Opening BPMN diagram on single click:', item.diagramId || item.diagramData?.id);
                this.openBPMNDiagram(item);
            }
        });
    }
    
    async openBPMNDiagram(item) {
        try {
            const appManager = window.appManager;
            if (!appManager) {
                console.error('❌ AppManager not found');
                return;
            }

            const diagram = item.diagramData;
            if (!diagram) {
                console.error('❌ Diagram data not found in the clicked item.');
                return;
            }
            
            console.log('🔧 Opening BPMN diagram:', diagram);
            console.log('📋 Diagram details:', {
                itemId: item.id,
                itemLabel: item.label,
                diagramId: diagram.id,
                diagramName: diagram.name || diagram.title,
                fullDiagram: diagram
            });

            // 서버에서 문서 요청 (DB 직접 접근 제거)
            console.log('📡 서버에 문서 요청:', diagram.id);
            
            let bpmnXml = null;
            /*
            try {
                const response = await fetch(`http://localhost:1234/api/document/${diagram.id}`);
                
                if (!response.ok) {
                    throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
                }
                
                const documentData = await response.json();
                
                if (!documentData.success) {
                    throw new Error(documentData.error || '문서 로드 실패');
                }
                
                bpmnXml = documentData.xml;
                console.log('✅ 서버에서 문서 수신:', documentData.name);
                
                // 서버에서 받은 최신 데이터로 다이어그램 정보 업데이트
                diagram.bpmn_xml = bpmnXml;
                diagram.name = documentData.name;
                
            } catch (error) {
                console.error('❌ 서버에서 문서 로드 실패:', error);
                
                // 서버 연결 실패 시 오류 메시지 표시
                if (appManager) {
                    appManager.showNotification('서버에 연결할 수 없습니다. WebSocket 서버가 실행 중인지 확인해주세요.', 'error');
                }
                return; // 서버 연결 실패 시 문서 열기 중단
            }
            */


            // BPMN 에디터가 초기화되지 않았다면 초기화
            if (!appManager.bpmnEditor || !appManager.bpmnEditor.isInitialized) {
                console.log('🔧 BPMN Editor not initialized, initializing...');
                await appManager.initializeBpmnEditor();
                if (appManager.bpmnEditor) {
                    await this.integrateBPMNEditor(appManager.bpmnEditor);
                }
            }
            
            // 에디터 컨테이너 준비
            const editorContent = this.container.querySelector('.editor-content');
            const welcomeMessage = editorContent?.querySelector('.editor-welcome-message');
            if (welcomeMessage) {
                welcomeMessage.style.display = 'none';
            }

            // 다이어그램 데이터로 BPMN 에디터에 로드
            await appManager.bpmnEditor.openDiagram({
                id: diagram.id,
                name: diagram.name,
                content: bpmnXml
            });
            
            console.log('✅ BPMN diagram opened successfully:', diagram.name);
            
        } catch (error) {
            console.error('❌ Failed to open BPMN diagram:', error);
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
        
        if (this.editorHeader) {
            this.editorHeader.destroy();
        }
        
        // Save final state
        this.saveLayoutState();
    }

    /**
     * 에디터 헤더 표시/숨김
     */
    showEditorHeader() {
        console.log('📋 VSCodeLayout.showEditorHeader called');
        
        const headerContainer = this.container.querySelector('.editor-header-container');
        console.log('📋 Header container found:', !!headerContainer);
        console.log('📋 Editor header instance:', !!this.editorHeader);
        
        if (headerContainer && this.editorHeader) {
            headerContainer.style.display = 'block';
            headerContainer.innerHTML = '';
            headerContainer.appendChild(this.editorHeader.getContainer());
            console.log('✅ Editor header displayed');
        } else {
            console.warn('❌ Cannot show editor header:', {
                hasContainer: !!headerContainer,
                hasEditorHeader: !!this.editorHeader
            });
        }
    }

    hideEditorHeader() {
        const headerContainer = this.container.querySelector('.editor-header-container');
        if (headerContainer) {
            headerContainer.style.display = 'none';
        }
    }

    /**
     * 브레드크럼 업데이트
     */
    updateBreadcrumb(breadcrumbData) {
        if (this.editorHeader) {
            this.editorHeader.updateBreadcrumb(breadcrumbData);
        }
    }

    /**
     * 접속자 정보 업데이트
     */
    updateConnectedUsers(users) {
        if (this.editorHeader) {
            this.editorHeader.updateConnectedUsers(users);
        }
    }

    /**
     * 대시보드로 이동
     */
    goToDashboard() {
        // AppManager를 통해 대시보드로 이동
        if (window.appManager) {
            window.appManager.showDashboard();
        }
    }

    /**
     * 브레드크럼 네비게이션 처리
     */
    handleBreadcrumbNavigation(id) {
        if (id === 'home') {
            this.goToDashboard();
        } else {
            // 특정 프로젝트나 폴더로 이동
            console.log('Navigate to:', id);
            // TODO: 구체적인 네비게이션 로직 구현
        }
    }

    /**
     * 새 폴더 만들기
     */
    async createNewFolder() {
        try {
            const appManager = window.appManager;
            if (!appManager || !appManager.currentProject) {
                console.error('❌ AppManager 또는 현재 프로젝트를 찾을 수 없습니다.');
                return;
            }

            // 폴더 이름 입력받기
            const folderName = prompt('새 폴더 이름을 입력하세요:', '새 폴더');
            if (!folderName || folderName.trim() === '') {
                return;
            }

            console.log('📁 새 폴더 생성:', folderName);
            
            // 폴더 생성 로직 (AppManager를 통해)
            if (appManager.createFolder) {
                await appManager.createFolder(folderName.trim());
            } else {
                console.warn('⚠️ createFolder 메서드가 AppManager에 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ 폴더 생성 실패:', error);
            alert('폴더 생성에 실패했습니다.');
        }
    }

    /**
     * 새 다이어그램 만들기
     */
    async createNewDiagram() {
        try {
            const appManager = window.appManager;
            if (!appManager || !appManager.currentProject) {
                console.error('❌ AppManager 또는 현재 프로젝트를 찾을 수 없습니다.');
                return;
            }

            // 다이어그램 이름 입력받기
            const diagramName = prompt('새 다이어그램 이름을 입력하세요:', '새 다이어그램');
            if (!diagramName || diagramName.trim() === '') {
                return;
            }

            console.log('📄 새 다이어그램 생성:', diagramName);
            
            // 다이어그램 생성 로직 (AppManager를 통해)
            if (appManager.createDiagram) {
                await appManager.createDiagram(diagramName.trim());
            } else {
                console.warn('⚠️ createDiagram 메서드가 AppManager에 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ 다이어그램 생성 실패:', error);
            alert('다이어그램 생성에 실패했습니다.');
        }
    }
}

export default VSCodeLayout;