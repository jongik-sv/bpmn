/**
 * VS Code Layout Module - 모듈형 VS Code Layout 컴포넌트
 * VS Code 스타일 레이아웃 기능을 모듈화하여 제공
 */

export { VSCodeLayoutManager } from './VSCodeLayoutManager.js';
export { VSCodeEventHandler } from './VSCodeEventHandler.js';
export { VSCodeViewManager } from './VSCodeViewManager.js';
export { VSCodeBpmnIntegration } from './VSCodeBpmnIntegration.js';

// 통합 VSCodeLayout 클래스 (VSCodeLayoutNew.js에서 import)
export { default as VSCodeLayout } from '../VSCodeLayoutNew.js';

// 하위 호환성을 위한 기본 export
export { default } from '../VSCodeLayoutNew.js';