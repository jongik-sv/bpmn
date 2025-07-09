/**
 * VS Code Layout Manager - 모듈형 리팩토링 버전
 * 레이아웃 관리, 이벤트 처리, 뷰 관리, BPMN 통합을 조합하여 완전한 VS Code 스타일 레이아웃 제공
 */

import { VSCodeLayoutManager } from './ui/layout/vscode-layout/VSCodeLayoutManager.js';
import { VSCodeEventHandler } from './ui/layout/vscode-layout/VSCodeEventHandler.js';
import { VSCodeViewManager } from './ui/layout/vscode-layout/VSCodeViewManager.js';
import { VSCodeBpmnIntegration } from './ui/layout/vscode-layout/VSCodeBpmnIntegration.js';

import { ActivityBar } from './ui/layout/activity-bar/index.js';
import Explorer from './ExplorerNew.js';
import { AccessibilityManager } from './common/accessibility/index.js';
import { DragDropController } from './ui/interactions/drag-drop/index.js';
import { EditorHeader } from './ui/layout/editor-header/index.js';

class VSCodeLayout {
    constructor(container) {
        this.container = container;
        
        // 핵심 모듈들 초기화
        this.layoutManager = new VSCodeLayoutManager(container);
        this.eventHandler = new VSCodeEventHandler(this.layoutManager);
        this.viewManager = new VSCodeViewManager(this.layoutManager);
        this.bpmnIntegration = new VSCodeBpmnIntegration(this.layoutManager);
        
        // 기존 컴포넌트 인스턴스들
        this.activityBar = null;
        this.explorer = null;
        this.accessibilityManager = null;
        this.dragDropController = null;
        this.editorHeader = null;
        
        // 초기화
        this.init();
    }

    async init() {
        try {
            // 컴포넌트들 초기화
            this.initializeComponents();
            
            // 모듈 간 통합 설정
            this.setupModuleIntegration();
            
            // 이벤트 핸들러 초기화
            this.eventHandler.initialize();
            
            // 접근성 설정
            this.setupAccessibility();
            
            // 레이아웃 상태 로드
            this.layoutManager.loadLayoutState();
            
        } catch (error) {
            console.error('❌ VSCodeLayout init failed:', error);
            throw error;
        }
    }

    /**
     * 컴포넌트들 초기화
     */
    initializeComponents() {
        try {
            // Activity Bar 초기화
            const activityBarContainer = this.layoutManager.getActivityBarContainer();
            if (!activityBarContainer) {
                throw new Error('Activity bar container not found');
            }
            this.activityBar = new ActivityBar(activityBarContainer);
            
            // Explorer 초기화
            const explorerContainer = this.layoutManager.getExplorerContainer();
            if (!explorerContainer) {
                throw new Error('Explorer container not found');
            }
            this.explorer = new Explorer(explorerContainer);
            
            // Editor Header 초기화
            this.editorHeader = new EditorHeader();
            this.bpmnIntegration.setEditorHeader(this.editorHeader);
            
            // Accessibility Manager 초기화
            this.accessibilityManager = new AccessibilityManager();
            
            // Drag Drop Controller 초기화
            this.dragDropController = new DragDropController();
            
            // 컴포넌트 콜백 설정
            this.setupComponentCallbacks();
            
        } catch (error) {
            console.error('❌ Failed to initialize VS Code components:', error);
            throw error;
        }
    }

    /**
     * 컴포넌트 콜백 설정
     */
    setupComponentCallbacks() {
        // Activity Bar 뷰 변경 콜백
        this.activityBar.setOnViewChangeCallback((viewId, previousViewId) => {
            this.viewManager.switchView(viewId);
            this.accessibilityManager.announce(`${this.viewManager.getViewDisplayName(viewId)}로 전환했습니다`);
        });

        // Explorer 콜백들
        this.explorer.setOnItemClick((item, event) => {
            // 다이어그램인 경우 단일 클릭으로도 열기
            if (item.type === 'file' && (item.type === 'diagram' || item.diagramId)) {
                this.bpmnIntegration.openBPMNDiagram(item);
            }
            this.accessibilityManager.announce(`${item.label} 선택됨`);
        });

        this.explorer.setOnItemDoubleClick((item, event) => {
            if (item.type === 'file' || item.type === 'diagram') {
                if (item.type === 'diagram' || item.diagramId) {
                    this.bpmnIntegration.openBPMNDiagram(item);
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

        // Drag and Drop 설정
        this.explorer.getDataProvider().setDragDropController(this.dragDropController);
        this.dragDropController.setOnDidChangeTreeData((element) => {
            this.explorer.refreshTree(element);
        });

        // Editor Header 콜백
        if (this.editorHeader) {
            this.editorHeader.setEventHandlers({
                onDashboardClick: () => {
                    this.bpmnIntegration.goToDashboard();
                },
                onBreadcrumbClick: (id) => {
                    this.bpmnIntegration.handleBreadcrumbNavigation(id);
                }
            });
        }
    }

    /**
     * 모듈 간 통합 설정
     */
    setupModuleIntegration() {
        // 이벤트 핸들러 → 뷰 매니저
        this.eventHandler.on('viewChangeRequested', (viewId) => {
            this.viewManager.switchView(viewId);
            this.activityBar.setActiveView(viewId);
        });

        this.eventHandler.on('sidebarToggleRequested', () => {
            this.viewManager.toggleSidebar();
        });

        // 포커스 관리
        this.eventHandler.on('focusRequested', (area) => {
            switch (area) {
                case 'activityBar':
                    this.viewManager.focusActivityBar();
                    break;
                case 'sidebar':
                    this.viewManager.focusSidebar();
                    break;
                case 'editor':
                    this.viewManager.focusEditor();
                    break;
                case 'reset':
                    this.resetFocus();
                    break;
            }
        });

        // 파일 작업
        this.eventHandler.on('fileOperationRequested', (operation) => {
            switch (operation) {
                case 'newFile':
                    this.createNewFile();
                    break;
                case 'newFolder':
                    this.bpmnIntegration.createNewFolder();
                    break;
                case 'openFile':
                    this.openFile();
                    break;
                case 'saveFile':
                    this.saveFile();
                    break;
            }
        });

        // 접근성 알림
        this.eventHandler.on('accessibilityAnnouncement', (message) => {
            this.accessibilityManager.announce(message);
        });

        // BPMN 통합 이벤트
        this.bpmnIntegration.on('editorHeaderShown', () => {
            console.log('Editor header shown');
        });

        this.bpmnIntegration.on('diagramOpened', (diagram) => {
            console.log('Diagram opened:', diagram.name);
        });
    }

    /**
     * 접근성 설정
     */
    setupAccessibility() {
        // 이벤트 핸들러에서 접근성이 이미 설정됨
        // 추가적인 접근성 기능이 필요한 경우 여기에 추가
    }

    // =============== 공개 API (하위 호환성 유지) ===============

    /**
     * 뷰 전환
     */
    switchView(viewId) {
        return this.viewManager.switchView(viewId);
    }

    /**
     * 사이드바 토글
     */
    toggleSidebar() {
        return this.viewManager.toggleSidebar();
    }

    /**
     * BPMN 에디터 통합
     */
    async integrateBPMNEditor(editorInstance) {
        return this.bpmnIntegration.integrateBPMNEditor(editorInstance);
    }

    /**
     * BPMN 프로젝트 구조 설정
     */
    async setupBPMNIntegration() {
        const dataProvider = this.explorer?.getDataProvider();
        if (dataProvider) {
            return this.bpmnIntegration.createBPMNProjectStructure(dataProvider);
        }
    }

    /**
     * 에디터 헤더 표시
     */
    showEditorHeader() {
        this.bpmnIntegration.showEditorHeader();
    }

    /**
     * 에디터 헤더 숨김
     */
    hideEditorHeader() {
        this.bpmnIntegration.hideEditorHeader();
    }

    /**
     * 브레드크럼 업데이트
     */
    updateBreadcrumb(breadcrumbData) {
        this.bpmnIntegration.updateBreadcrumb(breadcrumbData);
    }

    /**
     * 접속자 정보 업데이트
     */
    updateConnectedUsers(users) {
        this.bpmnIntegration.updateConnectedUsers(users);
    }

    /**
     * 대시보드로 이동
     */
    goToDashboard() {
        this.bpmnIntegration.goToDashboard();
    }

    /**
     * 새 폴더 생성
     */
    async createNewFolder() {
        return this.bpmnIntegration.createNewFolder();
    }

    /**
     * 새 다이어그램 생성
     */
    async createNewDiagram() {
        return this.bpmnIntegration.createNewDiagram();
    }

    // =============== 파일 작업 메서드들 ===============

    createNewFile() {
        this.explorer.createNewFile();
        this.accessibilityManager.announce('새 파일 생성 대화상자를 열었습니다');
    }

    openFile(item = null) {
        this.loadFileInEditor(item);
    }

    saveFile() {
        // BPMN 에디터의 저장 기능 호출
        if (window.appManager && window.appManager.bpmnEditor) {
            window.appManager.bpmnEditor.saveDiagram();
        }
    }

    loadFileInEditor(item) {
        if (!item) return;

        const editorContent = this.layoutManager.getEditorContent();
        if (!editorContent) return;

        // BPMN 파일인지 확인
        if (item.extension === 'bpmn') {
            this.loadBPMNFile(item, editorContent);
        } else {
            this.loadTextFile(item, editorContent);
        }
    }

    loadBPMNFile(item, container) {
        // BPMN 파일 로드는 BPMN 통합 모듈에서 처리
        this.bpmnIntegration.openBPMNDiagram(item);
    }

    loadTextFile(item, container) {
        // 텍스트 파일 로드 구현
        container.innerHTML = `
            <div style="padding: 20px; color: #cccccc;">
                <h3>${item.label}</h3>
                <p>텍스트 파일 내용이 여기에 표시됩니다.</p>
            </div>
        `;
    }

    showContextMenu(item, event) {
        // 컨텍스트 메뉴 구현
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: #2d2d30;
            border: 1px solid #454545;
            border-radius: 3px;
            padding: 4px 0;
            z-index: 1000;
            min-width: 160px;
        `;

        const actions = this.getContextMenuActions(item);
        actions.forEach(action => {
            const menuItem = document.createElement('div');
            menuItem.textContent = action.label;
            menuItem.style.cssText = `
                padding: 6px 16px;
                color: #cccccc;
                cursor: pointer;
                font-size: 13px;
            `;
            menuItem.addEventListener('click', () => {
                this.handleContextMenuAction(action.id, item);
                menu.remove();
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // 클릭 시 메뉴 제거
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }

    getContextMenuActions(item) {
        const actions = [];
        
        if (item.type === 'folder') {
            actions.push(
                { id: 'newFile', label: '새 파일' },
                { id: 'newFolder', label: '새 폴더' },
                { id: 'rename', label: '이름 바꾸기' },
                { id: 'delete', label: '삭제' }
            );
        } else if (item.type === 'file') {
            actions.push(
                { id: 'open', label: '열기' },
                { id: 'rename', label: '이름 바꾸기' },
                { id: 'delete', label: '삭제' }
            );
        }
        
        return actions;
    }

    handleContextMenuAction(action, item) {
        switch (action) {
            case 'newFile':
                this.createNewFile();
                break;
            case 'newFolder':
                this.createNewFolder();
                break;
            case 'open':
                this.openFile(item);
                break;
            case 'rename':
                // 이름 바꾸기 구현
                console.log('Rename:', item.label);
                break;
            case 'delete':
                // 삭제 구현
                console.log('Delete:', item.label);
                break;
        }
    }

    resetFocus() {
        // 포커스 리셋 - 현재 뷰에 포커스
        this.viewManager.focusCurrentView();
    }

    // =============== 접근자 메서드들 ===============

    getCurrentView() {
        return this.viewManager.getCurrentView();
    }

    getSidebarWidth() {
        return this.layoutManager.getSidebarWidth();
    }

    setSidebarWidth(width) {
        this.layoutManager.setSidebarWidth(width);
    }

    getActivityBar() {
        return this.activityBar;
    }

    getExplorer() {
        return this.explorer;
    }

    getAccessibilityManager() {
        return this.accessibilityManager;
    }

    isEditorHeaderVisible() {
        return this.bpmnIntegration.getIntegrationStatus().isEditorHeaderVisible;
    }

    // =============== 상태 관리 ===============

    saveLayoutState() {
        this.layoutManager.saveLayoutState();
    }

    loadLayoutState() {
        this.layoutManager.loadLayoutState();
    }

    handleWindowResize() {
        this.layoutManager.handleWindowResize();
    }

    getViewDisplayName(viewId) {
        return this.viewManager.getViewDisplayName(viewId);
    }

    /**
     * 전체 상태 정보 반환
     */
    getStatus() {
        return {
            layout: this.layoutManager ? {
                currentView: this.layoutManager.getCurrentView(),
                sidebarWidth: this.layoutManager.getSidebarWidth(),
                isCollapsed: this.layoutManager.isSidebarCollapsed()
            } : null,
            view: this.viewManager ? this.viewManager.getStatus() : null,
            events: this.eventHandler ? this.eventHandler.getStatus() : null,
            bpmn: this.bpmnIntegration ? this.bpmnIntegration.getIntegrationStatus() : null
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        // 컴포넌트들 정리
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

        // 모듈들 정리
        if (this.layoutManager) {
            this.layoutManager.destroy();
        }
        
        if (this.eventHandler) {
            this.eventHandler.destroy();
        }
        
        if (this.viewManager) {
            this.viewManager.destroy();
        }
        
        if (this.bpmnIntegration) {
            this.bpmnIntegration.destroy();
        }

        // 최종 상태 저장
        this.saveLayoutState();
        
        console.log('🗑️ VSCodeLayout destroyed');
    }
}

export { VSCodeLayout };
export default VSCodeLayout;