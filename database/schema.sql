-- BPMN 협업 에디터 데이터베이스 스키마
-- Supabase PostgreSQL 기반

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- 사용자 프로필 테이블 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 프로젝트 테이블
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 프로젝트 멤버 테이블 (역할 기반 접근 제어)
CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'editor', 'viewer')) NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- 폴더 테이블 (계층 구조)
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 다이어그램 테이블
CREATE TABLE IF NOT EXISTS diagrams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  bpmn_xml TEXT NOT NULL,
  thumbnail_url TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  last_modified_by UUID REFERENCES profiles(id),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 다이어그램 버전 히스토리
CREATE TABLE IF NOT EXISTS diagram_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  bpmn_xml TEXT NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diagram_id, version_number)
);

-- 협업 세션 테이블
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_data JSONB DEFAULT '{}',
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(diagram_id, user_id)
);

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS diagram_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
  element_id TEXT, -- BPMN 요소 ID
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position JSONB, -- 댓글 위치 정보
  is_resolved BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES diagram_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 활동 로그 테이블
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  diagram_id UUID REFERENCES diagrams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'comment', etc.
  entity_type TEXT NOT NULL, -- 'diagram', 'project', 'comment', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_project ON diagrams(project_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_folder ON diagrams(folder_id);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram ON diagram_versions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_diagram ON collaboration_sessions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_comments_diagram ON diagram_comments(diagram_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);

-- Row Level Security (RLS) 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles 정책: 사용자는 자신의 프로필만 조회/수정 가능
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects 정책: 프로젝트 멤버만 접근 가능
CREATE POLICY "Project members can view projects" ON projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update projects" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Project Members 정책
CREATE POLICY "Project members can view members" ON project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project admins can manage members" ON project_members
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Diagrams 정책: 프로젝트 멤버만 접근 가능
CREATE POLICY "Project members can view diagrams" ON diagrams
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project editors can modify diagrams" ON diagrams
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

-- 자동 타임스탬프 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 타임스탬프 트리거 생성
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diagrams_updated_at BEFORE UPDATE ON diagrams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 다이어그램 버전 자동 생성 함수
CREATE OR REPLACE FUNCTION create_diagram_version()
RETURNS TRIGGER AS $$
BEGIN
    -- 다이어그램이 업데이트될 때마다 새 버전 생성
    IF TG_OP = 'UPDATE' AND OLD.bpmn_xml != NEW.bpmn_xml THEN
        INSERT INTO diagram_versions (
            diagram_id,
            version_number,
            bpmn_xml,
            created_by
        ) VALUES (
            NEW.id,
            NEW.version,
            NEW.bpmn_xml,
            NEW.last_modified_by
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 다이어그램 버전 트리거
CREATE TRIGGER create_diagram_version_trigger
    AFTER UPDATE ON diagrams
    FOR EACH ROW
    EXECUTE FUNCTION create_diagram_version();

-- 프로필 자동 생성 함수 (Supabase Auth 트리거용)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- Auth 사용자 생성 시 프로필 자동 생성 트리거
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();