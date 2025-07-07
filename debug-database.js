// 디버깅용 스크립트
console.log('🔍 Database Debug Script');

// 1. 현재 로컬 스토리지 상태 확인
console.log('=== LOCAL STORAGE STATUS ===');
console.log('bpmn_force_local:', localStorage.getItem('bpmn_force_local'));
console.log('bpmn_projects:', JSON.parse(localStorage.getItem('bpmn_projects') || '[]').length + ' projects');
console.log('bpmn_folders:', JSON.parse(localStorage.getItem('bpmn_folders') || '[]').length + ' folders');
console.log('bpmn_diagrams:', JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]').length + ' diagrams');

// 2. 현재 데이터베이스 매니저 상태 확인
if (window.dbManager) {
  console.log('=== DATABASE MANAGER STATUS ===');
  console.log('Force local mode:', window.dbManager.forceLocalMode);
  console.log('Has Supabase:', !!window.dbManager.supabase);
} else {
  console.log('❌ dbManager not found in window');
}

// 3. 데이터베이스 모드 활성화 함수
window.enableDatabaseMode = function() {
  console.log('🌐 Enabling database mode...');
  localStorage.removeItem('bpmn_force_local');
  console.log('✅ Local mode disabled. Please refresh the page.');
  if (confirm('데이터베이스 모드를 활성화했습니다. 페이지를 새로고침하시겠습니까?')) {
    location.reload();
  }
};

// 4. 로컬 데이터 확인 함수
window.showLocalData = function() {
  console.log('=== ALL LOCAL DATA ===');
  console.log('Projects:', JSON.parse(localStorage.getItem('bpmn_projects') || '[]'));
  console.log('Folders:', JSON.parse(localStorage.getItem('bpmn_folders') || '[]'));
  console.log('Diagrams:', JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]'));
};

// 5. 데이터베이스 연결 테스트 함수
window.testDatabaseConnection = async function() {
  if (window.dbManager) {
    console.log('🔗 Testing database connection...');
    try {
      const result = await window.dbManager.testConnection();
      console.log('Connection test result:', result);
    } catch (error) {
      console.error('Connection test error:', error);
    }
  } else {
    console.error('❌ dbManager not available');
  }
};

console.log('📝 Available functions:');
console.log('  - window.enableDatabaseMode() - 데이터베이스 모드 활성화');
console.log('  - window.showLocalData() - 로컬 데이터 확인');
console.log('  - window.testDatabaseConnection() - 데이터베이스 연결 테스트');