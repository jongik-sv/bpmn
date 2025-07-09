/**
 * Explorer Module - 모듈형 Explorer 컴포넌트
 * VS Code 스타일 탐색기 기능을 모듈화하여 제공
 */

export { ExplorerCore } from './ExplorerCore.js';
export { ExplorerEventHandler } from './ExplorerEventHandler.js';
export { ExplorerSearch } from './ExplorerSearch.js';
export { ExplorerActions } from './ExplorerActions.js';
export { ExplorerAccessibility } from './ExplorerAccessibility.js';

// 통합 Explorer 클래스 (Explorer.js에서 import)
export { default as Explorer } from '../../../Explorer.js';

// 하위 호환성을 위한 기본 export
export { default } from '../../../Explorer.js';