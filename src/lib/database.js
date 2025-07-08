// 이 파일은 새로운 모듈 구조로 마이그레이션되었습니다
// 새로운 모듈을 사용하세요: ./database/DatabaseManagerNew.js

import { 
  DatabaseManagerNew, 
  dbManagerNew,
  testDatabaseConnection,
  createProject,
  getUserProjects,
  createDiagram,
  updateDiagram,
  getDiagram,
  getProjectDiagrams,
  createFolder,
  getProjectFolders,
  deleteFolder,
  renameFolder,
  updateFolder,
  deleteDiagram,
  updateItemOrder
} from './database/DatabaseManagerNew.js';

/**
 * @deprecated 레거시 호환성을 위한 래퍼 클래스
 * 새로운 코드는 DatabaseManagerNew를 직접 사용하세요
 */
export class DatabaseManager extends DatabaseManagerNew {
  constructor() {
    super();
    console.warn('⚠️  DatabaseManager is deprecated. Use DatabaseManagerNew instead.');
  }
}

// 싱글톤 인스턴스 (레거시 호환성)
export const dbManager = dbManagerNew;

// 레거시 호환성을 위한 편의 함수들 (모두 새로운 매니저로 위임)
export { 
  testDatabaseConnection,
  createProject,
  getUserProjects,
  createDiagram,
  updateDiagram,
  getDiagram,
  getProjectDiagrams,
  createFolder,
  getProjectFolders,
  deleteFolder,
  renameFolder,
  updateFolder,
  deleteDiagram,
  updateItemOrder
};

// 레거시 호환성을 위한 기본 export
export default DatabaseManager;