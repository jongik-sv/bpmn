/**
 * Components Module - 모든 컴포넌트 모듈들의 통합 export
 * 모듈화된 컴포넌트들을 중앙에서 관리하고 export
 */

// Activity Bar 모듈
export { 
    ActivityBarCore, 
    ActivityBarEventHandler, 
    ActivityBar 
} from './ui/layout/activity-bar/index.js';

// Context Menu 모듈
export { 
    ContextMenuCore, 
    ContextMenuEventHandler, 
    ContextMenu 
} from './ui/interactions/context-menu/index.js';

// Drag Drop 모듈
export { 
    DragDropCore, 
    DragDropEventHandler, 
    DragDropController, 
    DraggableTreeItem 
} from './ui/interactions/drag-drop/index.js';

// Editor Header 모듈
export { 
    EditorHeaderCore, 
    EditorHeaderEventHandler, 
    EditorHeader 
} from './ui/layout/editor-header/index.js';

// Project Manager 모듈
export { 
    ProjectManagerCore, 
    ProjectManager 
} from './features/project-manager/index.js';

// Tree Data 모듈
export { 
    TreeItem, 
    FileTreeItem, 
    TreeItemCollapsibleState, 
    TreeDataProvider 
} from './ui/interactions/tree-data/index.js';

// Accessibility 모듈
export { 
    AccessibilityCore, 
    AccessibilityManager 
} from './common/accessibility/index.js';

// 기존 Explorer 모듈 (이미 모듈화됨)
export { 
    ExplorerCore, 
    ExplorerEventHandler, 
    ExplorerSearch, 
    ExplorerActions, 
    ExplorerAccessibility 
} from './ui/layout/explorer/index.js';

// 기존 VS Code Layout 모듈 (이미 모듈화됨)
export { 
    VSCodeLayoutManager, 
    VSCodeEventHandler, 
    VSCodeViewManager, 
    VSCodeBpmnIntegration 
} from './ui/layout/vscode-layout/index.js';

// 기존 Auth 모듈 (이미 모듈화됨)
export { 
    AuthHandler, 
    AuthModalCore 
} from './features/auth/index.js';

// 기존 BPMN Editor 모듈 (이미 모듈화됨)
export { 
    BpmnAutoSave, 
    BpmnCollaborationHandler, 
    BpmnEditorCore, 
    BpmnUIIntegration 
} from './features/bpmn-editor/index.js';

// 모달 컴포넌트들
export { default as ProjectMembersModal } from './modals/ProjectMembersModal.js';
export { default as SupabaseLoginModal } from './modals/SupabaseLoginModal.js';

// 새로운 모듈형 컴포넌트들을 기본으로 export
export { default as ActivityBarNew } from './ui/layout/activity-bar/index.js';
export { default as ContextMenuNew } from './ui/interactions/context-menu/index.js';
export { default as DragDropControllerNew } from './ui/interactions/drag-drop/index.js';
export { default as EditorHeaderNew } from './ui/layout/editor-header/index.js';
export { default as ProjectManagerNew } from './features/project-manager/index.js';
export { default as TreeDataProviderNew } from './ui/interactions/tree-data/index.js';
export { default as AccessibilityManagerNew } from './common/accessibility/index.js';
export { default as ExplorerNew } from './ExplorerNew.js';
export { default as VSCodeLayoutNew } from './VSCodeLayoutNew.js';