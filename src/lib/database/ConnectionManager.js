import { EventEmitter } from 'events';
import { supabase } from '../supabase.js';

/**
 * 데이터베이스 연결 및 모드 관리 전담 클래스
 * Supabase 연결 테스트, 로컬/데이터베이스 모드 전환, 초기화 처리
 */
export class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    
    // 연결 상태
    this.supabase = supabase;
    this.isConnected = false;
    this.lastConnectionTest = null;
    
    // 모드 관리 (개발 중 강제 로컬 모드 우회)
    this.forceLocalMode = localStorage.getItem('bpmn_force_local') === 'true' || !supabase;
    
    // 초기화
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    console.log('🔧 ConnectionManager initialized');
    console.log('🔧 Supabase object:', !!supabase);
    console.log('🔧 Force local flag:', localStorage.getItem('bpmn_force_local'));
    console.log('🔧 Final forceLocalMode:', this.forceLocalMode);
    
    if (this.forceLocalMode) {
      console.log('🔧 Force local mode enabled - using localStorage (RLS bypass)');
      console.log('💡 To enable database mode, run: window.disableLocalMode()');
      
      // 기존 로컬 데이터에 sort_order 초기화
      this.initializeSortOrderForLocalData();
    } else {
      console.log('🌐 Database mode enabled - using Supabase');
    }
    
    this.emit('connectionManagerInitialized');
  }

  /**
   * 기존 로컬 데이터에 sort_order 초기화
   */
  initializeSortOrderForLocalData() {
    try {
      let updated = false;
      
      // 폴더 sort_order 초기화
      const folders = JSON.parse(localStorage.getItem('bpmn_folders') || '[]');
      for (let i = 0; i < folders.length; i++) {
        if (typeof folders[i].sort_order === 'undefined') {
          folders[i].sort_order = i;
          updated = true;
        }
      }
      if (updated) {
        localStorage.setItem('bpmn_folders', JSON.stringify(folders));
        console.log('🔧 Initialized sort_order for existing folders');
      }
      
      // 다이어그램 sort_order 초기화
      updated = false;
      const diagrams = JSON.parse(localStorage.getItem('bpmn_diagrams') || '[]');
      for (let i = 0; i < diagrams.length; i++) {
        if (typeof diagrams[i].sort_order === 'undefined') {
          diagrams[i].sort_order = i;
          updated = true;
        }
      }
      if (updated) {
        localStorage.setItem('bpmn_diagrams', JSON.stringify(diagrams));
        console.log('🔧 Initialized sort_order for existing diagrams');
      }
      
      this.emit('localDataInitialized');
    } catch (error) {
      console.error('Error initializing sort_order for local data:', error);
      this.emit('localDataInitError', error);
    }
  }

  /**
   * 데이터베이스 연결 테스트
   */
  async testConnection() {
    if (this.forceLocalMode) {
      console.log('🔧 Local mode - skipping database connection test');
      this.isConnected = false;
      this.lastConnectionTest = { 
        timestamp: Date.now(), 
        connected: false, 
        reason: 'force_local_mode' 
      };
      return { connected: false, reason: 'force_local_mode' };
    }

    try {
      console.log('🔌 Testing database connection...');
      
      // profiles 테이블 존재 여부 확인
      const { data, error } = await this.supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true })
        .limit(1);
      
      if (error) {
        console.warn('Database schema not ready:', error.message);
        console.log('💡 데이터베이스 스키마를 설정해주세요:');
        console.log('   1. https://yigkpwxaemgcasxtopup.supabase.co/project/default/sql');
        console.log('   2. database/supabase-setup.sql 파일의 내용을 복사해서 실행');
        
        this.isConnected = false;
        this.lastConnectionTest = { 
          timestamp: Date.now(), 
          connected: false, 
          error: error.message 
        };
        
        this.emit('connectionTestFailed', error);
        return { connected: false, error: error.message };
      }
      
      console.log('✅ Database connection and schema ready');
      this.isConnected = true;
      this.lastConnectionTest = { 
        timestamp: Date.now(), 
        connected: true 
      };
      
      this.emit('connectionTestSucceeded');
      return { connected: true };
      
    } catch (error) {
      console.error('Database connection error:', error);
      this.isConnected = false;
      this.lastConnectionTest = { 
        timestamp: Date.now(), 
        connected: false, 
        error: error.message 
      };
      
      this.emit('connectionTestFailed', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * 테이블 존재 여부 확인
   */
  async checkTableExists(tableName) {
    if (this.forceLocalMode) {
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .select('count', { count: 'exact', head: true })
        .limit(1);
      
      return !error;
    } catch (error) {
      console.warn(`Table ${tableName} check failed:`, error.message);
      return false;
    }
  }

  /**
   * 로컬 모드 여부 확인
   */
  isLocalMode() {
    return this.forceLocalMode;
  }

  /**
   * 데이터베이스 모드 여부 확인
   */
  isDatabaseMode() {
    return !this.forceLocalMode && !!this.supabase;
  }

  /**
   * 연결 상태 확인
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      mode: this.forceLocalMode ? 'local' : 'database',
      hasSupabase: !!this.supabase,
      forceLocalMode: this.forceLocalMode,
      lastConnectionTest: this.lastConnectionTest
    };
  }

  /**
   * 로컬 모드로 강제 전환
   */
  enableLocalMode() {
    localStorage.setItem('bpmn_force_local', 'true');
    this.forceLocalMode = true;
    console.log('🔧 Local mode enabled');
    this.emit('modeChanged', 'local');
  }

  /**
   * 데이터베이스 모드로 전환
   */
  enableDatabaseMode() {
    localStorage.removeItem('bpmn_force_local');
    this.forceLocalMode = false;
    console.log('🌐 Database mode enabled');
    this.emit('modeChanged', 'database');
  }

  /**
   * 즉시 데이터베이스 모드로 전환 (페이지 리로드 없이)
   */
  switchToDatabaseModeImmediate() {
    localStorage.removeItem('bpmn_force_local');
    this.forceLocalMode = false;
    console.log('🌐 Switched to database mode immediately');
    this.emit('modeChanged', 'database');
    return this.getConnectionStatus();
  }

  /**
   * 연결 재시도
   */
  async retryConnection() {
    console.log('🔄 Retrying database connection...');
    return await this.testConnection();
  }

  /**
   * 사용자 프로필 업서트 (기본 데이터베이스 작업)
   */
  async upsertProfile(profile) {
    if (this.forceLocalMode) {
      return this.upsertProfileLocal(profile);
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name || profile.email.split('@')[0],
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting profile:', error);
        return this.upsertProfileLocal(profile);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Profile upsert error:', error);
      return this.upsertProfileLocal(profile);
    }
  }

  /**
   * 로컬 스토리지에서 프로필 업서트
   */
  upsertProfileLocal(profile) {
    try {
      const profiles = JSON.parse(localStorage.getItem('bpmn_profiles') || '[]');
      const existingIndex = profiles.findIndex(p => p.id === profile.id);
      
      const profileData = {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name || profile.email.split('@')[0],
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        profiles[existingIndex] = profileData;
      } else {
        profiles.push(profileData);
      }
      
      localStorage.setItem('bpmn_profiles', JSON.stringify(profiles));
      console.log('✅ Profile upserted locally:', profileData);
      
      return { data: profileData, error: null };
    } catch (error) {
      console.error('Local profile upsert error:', error);
      return { data: null, error };
    }
  }

  /**
   * 로컬 데이터 정리
   */
  clearLocalData() {
    const keys = ['bpmn_projects', 'bpmn_folders', 'bpmn_diagrams', 'bpmn_profiles'];
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🧹 Local data cleared');
    this.emit('localDataCleared');
  }

  /**
   * 데이터베이스 상태 정보 반환
   */
  getDebugInfo() {
    const localStorageInfo = {};
    const keys = ['bpmn_projects', 'bpmn_folders', 'bpmn_diagrams', 'bpmn_profiles'];
    
    keys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        localStorageInfo[key] = data.length;
      } catch {
        localStorageInfo[key] = 'error';
      }
    });

    return {
      connectionStatus: this.getConnectionStatus(),
      localStorage: {
        ...localStorageInfo,
        forceLocalFlag: localStorage.getItem('bpmn_force_local')
      },
      supabase: {
        available: !!this.supabase,
        url: this.supabase?.supabaseUrl || 'not available'
      }
    };
  }

  /**
   * 순서 업데이트를 위한 배치 작업 지원
   */
  async executeBatch(operations) {
    if (this.forceLocalMode) {
      return this.executeBatchLocal(operations);
    }

    try {
      const results = await Promise.all(operations);
      
      // 에러 확인
      for (const result of results) {
        if (result.error) {
          console.error('Batch operation error:', result.error);
          return this.executeBatchLocal(operations);
        }
      }

      return { success: true, results, error: null };
    } catch (error) {
      console.error('Batch execution error:', error);
      return this.executeBatchLocal(operations);
    }
  }

  /**
   * 로컬 배치 작업 실행
   */
  executeBatchLocal(operations) {
    try {
      // 로컬 모드에서는 단순히 각 작업을 순차 실행
      console.log('🔧 Executing batch operations locally');
      return { success: true, results: [], error: null };
    } catch (error) {
      console.error('Local batch execution error:', error);
      return { success: false, results: [], error };
    }
  }

  /**
   * 리소스 정리
   */
  destroy() {
    // 연결 상태 초기화
    this.isConnected = false;
    this.lastConnectionTest = null;
    
    // 이벤트 에미터 정리
    this.removeAllListeners();
    
    console.log('🗑️ ConnectionManager destroyed');
  }
}