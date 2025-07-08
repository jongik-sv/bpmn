/**
 * Project Manager Module - 모듈형 Project Manager 컴포넌트
 * 프로젝트 관리 기능을 모듈화하여 제공
 */

export { ProjectManagerCore } from './ProjectManagerCore.js';
export { ProjectManager } from './ProjectManagerNew.js';

// 하위 호환성을 위한 기본 export
export { ProjectManager as default } from './ProjectManagerNew.js';