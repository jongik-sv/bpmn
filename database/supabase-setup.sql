-- BPMN 협업 에디터 - Supabase 데이터베이스 설정
-- 이 스크립트를 Supabase 대시보드 > SQL Editor에서 실행하세요
-- URL: https://yigkpwxaemgcasxtopup.supabase.co/project/default/sql

-- 1. 사용자 프로필 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 프로젝트 테이블  
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 프로젝트 멤버 테이블
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'editor', 'viewer')) NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES public.profiles(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- 4. 폴더 테이블 (계층 구조)
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 다이어그램 테이블
CREATE TABLE IF NOT EXISTS public.diagrams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  bpmn_xml TEXT NOT NULL DEFAULT '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="true" /></bpmn:definitions>',
  thumbnail_url TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  last_modified_by UUID REFERENCES public.profiles(id),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 다이어그램 버전 히스토리
CREATE TABLE IF NOT EXISTS public.diagram_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID REFERENCES public.diagrams(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  bpmn_xml TEXT NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diagram_id, version_number)
);

-- 7. 협업 세션 테이블
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID REFERENCES public.diagrams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_data JSONB DEFAULT '{}',
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(diagram_id, user_id)
);

-- 8. 댓글 테이블
CREATE TABLE IF NOT EXISTS public.diagram_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID REFERENCES public.diagrams(id) ON DELETE CASCADE,
  element_id TEXT, -- BPMN 요소 ID
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position JSONB, -- 댓글 위치 정보
  is_resolved BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES public.diagram_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 활동 로그 테이블
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  diagram_id UUID REFERENCES public.diagrams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'comment', etc.
  entity_type TEXT NOT NULL, -- 'diagram', 'project', 'comment', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_project ON public.folders(project_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_project ON public.diagrams(project_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_folder ON public.diagrams(folder_id);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram ON public.diagram_versions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_diagram ON public.collaboration_sessions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_comments_diagram ON public.diagram_comments(diagram_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON public.activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);

-- Row Level Security (RLS) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagram_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagram_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성

-- Profiles 정책
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects 정책
CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Project members can view projects" ON public.projects
  FOR SELECT USING (
    id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update projects" ON public.projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Project owners can delete projects" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

-- Project Members 정책
CREATE POLICY "Project members can view members" ON public.project_members
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners and admins can manage members" ON public.project_members
  FOR ALL USING (
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Diagrams 정책
CREATE POLICY "Project members can view diagrams" ON public.diagrams
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project editors can create diagrams" ON public.diagrams
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Project editors can modify diagrams" ON public.diagrams
  FOR UPDATE USING (
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Project owners can delete diagrams" ON public.diagrams
  FOR DELETE USING (
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 자동 타임스탬프 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 타임스탬프 트리거 생성
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at 
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_diagrams_updated_at ON public.diagrams;
CREATE TRIGGER update_diagrams_updated_at 
  BEFORE UPDATE ON public.diagrams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 다이어그램 버전 자동 생성 함수
CREATE OR REPLACE FUNCTION public.create_diagram_version()
RETURNS TRIGGER AS $$
BEGIN
    -- 다이어그램이 업데이트될 때마다 새 버전 생성
    IF TG_OP = 'UPDATE' AND OLD.bpmn_xml != NEW.bpmn_xml THEN
        INSERT INTO public.diagram_versions (
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
DROP TRIGGER IF EXISTS create_diagram_version_trigger ON public.diagrams;
CREATE TRIGGER create_diagram_version_trigger
    AFTER UPDATE ON public.diagrams
    FOR EACH ROW
    EXECUTE FUNCTION public.create_diagram_version();

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 프로젝트 생성 시 멤버 자동 추가 함수
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 프로젝트 생성자를 owner로 자동 추가
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

-- 프로젝트 생성 시 멤버 자동 추가 트리거
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- 초기 데이터 확인을 위한 뷰 생성
CREATE OR REPLACE VIEW public.project_members_view AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.owner_id,
  pm.user_id,
  pm.role,
  pr.email as user_email,
  pr.display_name as user_name
FROM public.projects p
LEFT JOIN public.project_members pm ON p.id = pm.project_id
LEFT JOIN public.profiles pr ON pm.user_id = pr.id;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ BPMN 협업 에디터 데이터베이스 설정이 완료되었습니다!';
  RAISE NOTICE '📊 생성된 테이블: profiles, projects, project_members, folders, diagrams, diagram_versions, collaboration_sessions, diagram_comments, activity_logs';
  RAISE NOTICE '🔒 RLS 정책 및 트리거가 설정되었습니다.';
  RAISE NOTICE '🚀 이제 애플리케이션에서 데이터베이스를 사용할 수 있습니다.';
END $$;