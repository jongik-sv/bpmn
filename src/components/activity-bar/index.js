/**
 * Activity Bar Module - 모듈형 Activity Bar 컴포넌트
 * VS Code 스타일 Activity Bar 기능을 모듈화하여 제공
 */

export { ActivityBarCore } from './ActivityBarCore.js';
export { ActivityBarEventHandler } from './ActivityBarEventHandler.js';
export { ActivityBar } from './ActivityBarNew.js';

// 하위 호환성을 위한 기본 export
export { ActivityBar as default } from './ActivityBarNew.js';