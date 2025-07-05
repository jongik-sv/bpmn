# Supabase BPMN 협업 에디터 데이터베이스 설계

## 1. Supabase 프로젝트 설정

### 1.1 필요한 Extensions
```sql
-- UUID 생성을 위한 extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 암호화를 위한 extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 전체 텍스트 검색을 위한 extension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

## 2. 데이터베이스 스키마 설계

### 2.1 사용자 관리 (Supabase Auth 연동)

```sql
-- Supabase Auth와 연동되는 사용자 프로필 테이블
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) 정책
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 모든 사용자는 프로필 조회 가능
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

-- auth.users 생성 시 자동으로 profile 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### 2.2 프로젝트 관리

```sql
-- 프로젝트 테이블
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    is_public BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로젝트 검색을 위한 인덱스
CREATE INDEX idx_projects_name ON projects USING gin(name gin_trgm_ops);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- RLS 정책
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 프로젝트 조회: 소유자이거나 권한이 있는 사용자만
CREATE POLICY "View projects" ON projects
    FOR SELECT USING (
        is_public = true OR
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

-- 프로젝트 생성: 로그인한 사용자만
CREATE POLICY "Create projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 프로젝트 수정: 소유자나 admin 권한을 가진 사용자만
CREATE POLICY "Update projects" ON projects
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'admin'
        )
    );

-- 프로젝트 삭제: 소유자만
CREATE POLICY "Delete projects" ON projects
    FOR DELETE USING (owner_id = auth.uid());
```

### 2.3 프로젝트 멤버 및 권한 관리

```sql
-- 프로젝트 멤버 테이블
CREATE TYPE member_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE public.project_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role member_role NOT NULL DEFAULT 'viewer',
    invited_by UUID REFERENCES public.profiles(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(project_id, user_id)
);

-- 인덱스
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- RLS 정책
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 멤버 조회: 같은 프로젝트 멤버끼리만
CREATE POLICY "View project members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- 멤버 추가: 프로젝트 소유자나 admin만
CREATE POLICY "Add project members" ON project_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_id
            AND projects.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_id
            AND pm.user_id = auth.uid()
            AND pm.role = 'admin'
        )
    );
```

### 2.4 폴더 구조 관리

```sql
-- 폴더 테이블
CREATE TABLE public.folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    color TEXT,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 폴더 경로를 위한 재귀 뷰
CREATE OR REPLACE VIEW folder_paths AS
WITH RECURSIVE folder_tree AS (
    SELECT 
        id,
        name,
        project_id,
        parent_folder_id,
        ARRAY[name] as path,
        0 as depth
    FROM folders
    WHERE parent_folder_id IS NULL
    
    UNION ALL
    
    SELECT 
        f.id,
        f.name,
        f.project_id,
        f.parent_folder_id,
        ft.path || f.name,
        ft.depth + 1
    FROM folders f
    JOIN folder_tree ft ON f.parent_folder_id = ft.id
)
SELECT * FROM folder_tree;

-- 인덱스
CREATE INDEX idx_folders_project ON folders(project_id);
CREATE INDEX idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX idx_folders_order ON folders(project_id, parent_folder_id, order_index);

-- RLS 정책
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 폴더 조회: 프로젝트 접근 권한이 있는 사용자만
CREATE POLICY "View folders" ON folders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = folders.project_id
            AND (
                p.is_public = true OR
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM project_members pm
                    WHERE pm.project_id = p.id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );
```

### 2.5 BPMN 다이어그램 관리

```sql
-- 다이어그램 테이블
CREATE TABLE public.diagrams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    content TEXT NOT NULL, -- BPMN XML
    thumbnail_url TEXT,
    version INTEGER DEFAULT 1,
    is_locked BOOLEAN DEFAULT false,
    locked_by UUID REFERENCES public.profiles(id),
    locked_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    last_modified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 다이어그램 검색을 위한 전체 텍스트 검색 인덱스
CREATE INDEX idx_diagrams_search ON diagrams USING gin(
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
CREATE INDEX idx_diagrams_project ON diagrams(project_id);
CREATE INDEX idx_diagrams_folder ON diagrams(folder_id);
CREATE INDEX idx_diagrams_updated ON diagrams(updated_at DESC);

-- RLS 정책
ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;

-- 다이어그램 조회
CREATE POLICY "View diagrams" ON diagrams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = diagrams.project_id
            AND (
                p.is_public = true OR
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM project_members pm
                    WHERE pm.project_id = p.id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );

-- 다이어그램 생성/수정: editor 이상 권한
CREATE POLICY "Manage diagrams" ON diagrams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = diagrams.project_id
            AND (
                p.owner_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM project_members pm
                    WHERE pm.project_id = p.id
                    AND pm.user_id = auth.uid()
                    AND pm.role IN ('admin', 'editor')
                )
            )
        )
    );
```

### 2.6 버전 관리

```sql
-- 다이어그램 버전 테이블
CREATE TABLE public.diagram_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    diagram_id UUID REFERENCES public.diagrams(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diagram_id, version_number)
);

-- 자동 버전 생성 트리거
CREATE OR REPLACE FUNCTION create_diagram_version()
RETURNS TRIGGER AS $$
BEGIN
    -- content가 변경된 경우에만 버전 생성
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        INSERT INTO diagram_versions (
            diagram_id,
            version_number,
            content,
            created_by
        ) VALUES (
            NEW.id,
            NEW.version,
            OLD.content,
            NEW.last_modified_by
        );
        
        -- 버전 번호 증가
        NEW.version = NEW.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_diagram_update
    BEFORE UPDATE ON diagrams
    FOR EACH ROW
    EXECUTE FUNCTION create_diagram_version();

-- 인덱스
CREATE INDEX idx_diagram_versions_diagram ON diagram_versions(diagram_id, version_number DESC);
```

### 2.7 실시간 협업 세션

```sql
-- 협업 세션 테이블
CREATE TABLE public.collaboration_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    diagram_id UUID REFERENCES public.diagrams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    socket_id TEXT,
    cursor_position JSONB,
    selection JSONB,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diagram_id, user_id)
);

-- 세션 정리를 위한 인덱스
CREATE INDEX idx_collaboration_sessions_active ON collaboration_sessions(diagram_id) WHERE is_active = true;
CREATE INDEX idx_collaboration_sessions_activity ON collaboration_sessions(last_activity);

-- 비활성 세션 자동 정리 (5분 이상 활동 없음)
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
    UPDATE collaboration_sessions
    SET is_active = false
    WHERE is_active = true
    AND last_activity < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
```

### 2.8 활동 로그

```sql
-- 활동 로그 테이블
CREATE TABLE public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'project', 'folder', 'diagram'
    resource_id UUID,
    resource_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 로그 조회를 위한 인덱스
CREATE INDEX idx_activity_logs_project ON activity_logs(project_id, created_at DESC);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at DESC);

-- 30일 이상 된 로그 자동 삭제
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM activity_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

### 2.9 댓글 및 주석

```sql
-- 다이어그램 댓글 테이블
CREATE TABLE public.diagram_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    diagram_id UUID REFERENCES public.diagrams(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id UUID REFERENCES public.diagram_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    element_id TEXT, -- BPMN 요소 ID (특정 요소에 대한 댓글)
    position JSONB, -- 다이어그램 상의 위치
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_diagram_comments_diagram ON diagram_comments(diagram_id, created_at DESC);
CREATE INDEX idx_diagram_comments_element ON diagram_comments(element_id) WHERE element_id IS NOT NULL;
```

## 3. Supabase Realtime 설정

### 3.1 실시간 구독을 위한 설정

```sql
-- 다이어그램 변경사항 실시간 구독
ALTER TABLE diagrams REPLICA IDENTITY FULL;
ALTER TABLE collaboration_sessions REPLICA IDENTITY FULL;
ALTER TABLE diagram_comments REPLICA IDENTITY FULL;

-- Realtime 활성화 (Supabase Dashboard에서 설정)
-- Tables to broadcast:
-- - diagrams (UPDATE)
-- - collaboration_sessions (INSERT, UPDATE, DELETE)
-- - diagram_comments (INSERT, UPDATE, DELETE)
```

## 4. Storage 버킷 설정

```sql
-- Supabase Storage 버킷 생성 (SQL이 아닌 Dashboard/API로 설정)
-- 버킷명: diagram-thumbnails (공개)
-- 버킷명: project-assets (비공개)
-- 버킷명: user-avatars (공개)

-- Storage 정책 예시 (JavaScript SDK)
/*
const { data, error } = await supabase.storage
  .from('diagram-thumbnails')
  .upload(`${projectId}/${diagramId}.png`, thumbnailBlob, {
    contentType: 'image/png',
    upsert: true
  });
*/
```

## 5. Edge Functions 설정

### 5.1 다이어그램 썸네일 생성 함수

```typescript
// supabase/functions/generate-thumbnail/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { diagramId, bpmnXml } = await req.json()
  
  // BPMN을 이미지로 변환하는 로직
  // ...
  
  // Storage에 저장
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  const { data, error } = await supabase.storage
    .from('diagram-thumbnails')
    .upload(`${diagramId}.png`, thumbnailBuffer)
    
  return new Response(JSON.stringify({ success: true }))
})
```

## 6. 데이터베이스 함수 및 뷰

### 6.1 프로젝트 통계 뷰

```sql
CREATE OR REPLACE VIEW project_statistics AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    COUNT(DISTINCT d.id) as diagram_count,
    COUNT(DISTINCT f.id) as folder_count,
    COUNT(DISTINCT pm.user_id) + 1 as member_count,
    MAX(d.updated_at) as last_activity
FROM projects p
LEFT JOIN diagrams d ON p.id = d.project_id
LEFT JOIN folders f ON p.id = f.project_id
LEFT JOIN project_members pm ON p.id = pm.project_id
GROUP BY p.id, p.name;
```

### 6.2 사용자 권한 확인 함수

```sql
CREATE OR REPLACE FUNCTION get_user_role(
    p_user_id UUID,
    p_project_id UUID
) RETURNS member_role AS $$
DECLARE
    v_role member_role;
BEGIN
    -- 소유자인 경우
    IF EXISTS (
        SELECT 1 FROM projects 
        WHERE id = p_project_id AND owner_id = p_user_id
    ) THEN
        RETURN 'admin'::member_role;
    END IF;
    
    -- 멤버인 경우
    SELECT role INTO v_role
    FROM project_members
    WHERE user_id = p_user_id AND project_id = p_project_id;
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql;
```

## 7. 초기 데이터 및 샘플

```sql
-- 기본 프로젝트 템플릿
INSERT INTO projects (name, description, owner_id, settings) VALUES
    ('My First BPMN Project', 'Getting started with BPMN', auth.uid(), 
     '{"theme": "light", "defaultView": "diagram", "autoSave": true}'::jsonb);

-- 샘플 BPMN 다이어그램
INSERT INTO diagrams (name, project_id, content, created_by) VALUES
    ('Sample Process', 
     (SELECT id FROM projects WHERE owner_id = auth.uid() LIMIT 1),
     '<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
        <!-- BPMN XML content -->
      </bpmn:definitions>',
     auth.uid());
```

## 8. 인덱스 및 성능 최적화

```sql
-- 자주 사용되는 쿼리를 위한 복합 인덱스
CREATE INDEX idx_diagrams_project_updated ON diagrams(project_id, updated_at DESC);
CREATE INDEX idx_folders_project_parent ON folders(project_id, parent_folder_id);
CREATE INDEX idx_project_members_user_role ON project_members(user_id, role);

-- 통계 업데이트
ANALYZE projects;
ANALYZE diagrams;
ANALYZE folders;
ANALYZE project_members;
```