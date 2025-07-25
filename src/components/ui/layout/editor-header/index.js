/**
 * Editor Header Module - 모듈형 Editor Header 컴포넌트
 * BPMN 에디터 헤더 기능을 모듈화하여 제공
 */

export { EditorHeaderCore } from './EditorHeaderCore.js';
export { EditorHeaderEventHandler } from './EditorHeaderEventHandler.js';
export { EditorHeader } from './EditorHeader.js';

// 하위 호환성을 위한 기본 export
export { EditorHeader as default } from './EditorHeader.js';