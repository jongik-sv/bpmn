/**
 * Components Module - 모든 컴포넌트 모듈들의 통합 export
 * 모듈화된 컴포넌트들을 중앙에서 관리하고 export
 */

// Activity Bar 모듈
export { 
    ActivityBarCore, 
    ActivityBarEventHandler, 
    ActivityBar 
} from './activity-bar/index.js';

// Context Menu 모듈
export { 
    ContextMenuCore, 
    ContextMenuEventHandler, 
    ContextMenu 
} from './context-menu/index.js';

// Drag Drop 모듈
export { 
    DragDropCore, 
    DragDropEventHandler, 
    DragDropController, 
    DraggableTreeItem 
} from './drag-drop/index.js';

// Editor Header 모듈
export { 
    EditorHeaderCore, 
    EditorHeaderEventHandler, 
    EditorHeader 
} from './editor-header/index.js';

// Project Manager 모듈
export { 
    ProjectManagerCore, 
    ProjectManager 
} from './project-manager/index.js';

// Tree Data 모듈
export { 
    TreeItem, 
    FileTreeItem, 
    TreeItemCollapsibleState, 
    TreeDataProvider 
} from './tree-data/index.js';

// Accessibility 모듈
export { 
    AccessibilityCore, 
    AccessibilityManager 
} from './accessibility/index.js';

// 기존 Explorer 모듈 (이미 모듈화됨)
export { 
    ExplorerCore, 
    ExplorerEventHandler, 
    ExplorerSearch, 
    ExplorerActions, 
    ExplorerAccessibility 
} from './explorer/index.js';

// 기존 VS Code Layout 모듈 (이미 모듈화됨)
export { 
    VSCodeLayoutManager, 
    VSCodeEventHandler, 
    VSCodeViewManager, 
    VSCodeBpmnIntegration 
} from './vscode-layout/index.js';

// 기존 Auth 모듈 (이미 모듈화됨)
export { 
    AuthHandler, 
    AuthModalCore 
} from './auth/index.js';

// 기존 BPMN Editor 모듈 (이미 모듈화됨)
export { 
    BpmnAutoSave, 
    BpmnCollaborationHandler, 
    BpmnEditorCore, 
    BpmnUIIntegration 
} from './bpmn-editor/index.js';

// 레거시 호환성을 위한 기본 export들
export { default as ActivityBarLegacy } from './ActivityBar.js';
export { default as ContextMenuLegacy } from './ContextMenu.js';
export { default as DragDropControllerLegacy } from './DragDropController.js';
export { default as EditorHeaderLegacy } from './EditorHeader.js';
export { default as ProjectManagerLegacy } from './ProjectManager.js';
export { default as TreeDataProviderLegacy } from './TreeDataProvider.js';
export { default as AccessibilityManagerLegacy } from './AccessibilityManager.js';

// 기타 컴포넌트들
export { default as ExplorerLegacy } from './Explorer.js';
export { default as VSCodeLayoutLegacy } from './VSCodeLayout.js';
export { default as ProjectMembersModal } from './ProjectMembersModal.js';
export { default as SupabaseLoginModal } from './SupabaseLoginModal.js';

// 새로운 모듈형 컴포넌트들을 기본으로 export
export { default as ActivityBarNew } from './activity-bar/index.js';
export { default as ContextMenuNew } from './context-menu/index.js';
export { default as DragDropControllerNew } from './drag-drop/index.js';
export { default as EditorHeaderNew } from './editor-header/index.js';
export { default as ProjectManagerNew } from './project-manager/index.js';
export { default as TreeDataProviderNew } from './tree-data/index.js';
export { default as AccessibilityManagerNew } from './accessibility/index.js';
export { default as ExplorerNew } from './ExplorerNew.js';
export { default as VSCodeLayoutNew } from './VSCodeLayoutNew.js';