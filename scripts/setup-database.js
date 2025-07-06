import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 환경 변수 로드
const supabaseUrl = process.env.SUPABASE_URL || 'https://yigkpwxaemgcasxtopup.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_ANON_KEY가 필요합니다.');
  process.exit(1);
}

// Supabase 클라이언트 생성 (서비스 역할로)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🚀 데이터베이스 설정을 시작합니다...');
  
  try {
    // 스키마 파일 읽기
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    let schema;
    
    try {
      schema = fs.readFileSync(schemaPath, 'utf8');
    } catch (error) {
      console.error('❌ schema.sql 파일을 읽을 수 없습니다:', error.message);
      console.log('💡 수동으로 Supabase 대시보드에서 다음 테이블들을 생성해주세요:');
      console.log('   - profiles');
      console.log('   - projects');
      console.log('   - project_members');
      console.log('   - folders');
      console.log('   - diagrams');
      console.log('   - collaboration_sessions');
      
      // 기본 테이블만 생성
      await createBasicTables();
      return;
    }
    
    // SQL 스크립트를 줄별로 분할하여 실행
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 ${statements.length}개의 SQL 문을 실행합니다...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`   실행 중 (${i + 1}/${statements.length}): ${statement.substring(0, 50)}...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.warn(`   ⚠️ 경고: ${error.message}`);
          }
        } catch (error) {
          console.warn(`   ⚠️ 스킵: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 데이터베이스 설정 중 오류:', error);
    
    // 기본 테이블만 생성
    await createBasicTables();
  }
}

async function createBasicTables() {
  console.log('🔧 기본 테이블을 생성합니다...');
  
  const basicTables = [
    // Profiles 테이블
    `CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID REFERENCES auth.users(id) PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    
    // Projects 테이블
    `CREATE TABLE IF NOT EXISTS public.projects (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id UUID REFERENCES public.profiles(id) NOT NULL,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,
    
    // Project Members 테이블
    `CREATE TABLE IF NOT EXISTS public.project_members (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      role TEXT CHECK (role IN ('owner', 'admin', 'editor', 'viewer')) NOT NULL DEFAULT 'viewer',
      invited_by UUID REFERENCES public.profiles(id),
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(project_id, user_id)
    )`
  ];
  
  for (const sql of basicTables) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('테이블 생성 실패:', error);
        // RPC 함수가 없는 경우 직접 실행 시도
        const { error: directError } = await supabase.from('_').select('*').limit(0);
        console.log('직접 실행을 시도해보세요:', sql);
      } else {
        console.log('✅ 테이블 생성 성공');
      }
    } catch (error) {
      console.log('💡 수동 실행 필요:', sql);
    }
  }
}

async function testConnection() {
  console.log('🔍 데이터베이스 연결을 테스트합니다...');
  
  try {
    // Auth 테스트
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('   Auth 연결:', authError ? '❌' : '✅');
    
    // Profiles 테이블 테스트
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    console.log('   Profiles 테이블:', profilesError ? '❌' : '✅');
    
    // Projects 테이블 테스트
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    console.log('   Projects 테이블:', projectsError ? '❌' : '✅');
    
    if (!projectsError) {
      console.log('🎉 데이터베이스가 준비되었습니다!');
    } else {
      console.log('❌ Projects 테이블이 생성되지 않았습니다.');
      console.log('💡 Supabase 대시보드 > SQL Editor에서 다음을 실행하세요:');
      console.log(`
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'viewer',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
    }
    
  } catch (error) {
    console.error('연결 테스트 실패:', error);
  }
}

// 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase().then(() => {
    testConnection();
  });
}

export { setupDatabase, testConnection };