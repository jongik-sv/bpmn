// 이 파일은 새로운 모듈 구조로 마이그레이션되었습니다
// 새로운 모듈을 사용하세요: ./database/DatabaseManager.js

// 새로운 모듈에서 모든 export를 다시 export
export { 
  DatabaseManager, 
  dbManager,
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
} from './database/DatabaseManager.js';

// 기본 export
export { DatabaseManager as default } from './database/DatabaseManager.js';