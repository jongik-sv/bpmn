# BPMN 협업 에디터 개발 설계 문서

## 1. 프로젝트 개요

### 1.1 프로젝트 목표
실시간 협업 기능을 갖춘 BPMN 다이어그램 편집기 구축
- Google Docs와 같은 수준의 실시간 협업 경험 제공
- Supabase를 활용한 백엔드 구조로 빠른 개발 및 확장성 확보
- CRDT 기반의 충돌 없는 동시 편집 구현

### 1.2 핵심 기능
- **실시간 다중 사용자 BPMN 편집**: Yjs CRDT 기반 충돌 방지
- **프로젝트 및 폴더 관리**: 계층적 구조의 워크스페이스
- **역할 기반 접근 제어**: 프로젝트별 권한 관리
- **자동 버전 관리**: 변경사항 추적 및 복원
- **실시간 협업 UI**: 커서, 선택 영역, 댓글 시스템

## 2. 기술 스택

### 2.1 Frontend
- **Framework**: React 18+ with TypeScript
- **Editor**: bpmn-js (BPMN.io) with custom collaborative modules
- **Real-time**: Yjs (CRDT) with y-websocket provider
- **State Management**: Zustand (lightweight & compatible with Yjs)
- **Build Tool**: Vite with optimized bundling
- **UI Components**: Tailwind CSS with custom BPMN-specific components

### 2.2 Backend (Supabase)
- **Database**: PostgreSQL with RLS policies
- **Authentication**: Supabase Auth (Email/OAuth2)
- **Real-time**: Supabase Realtime subscriptions
- **Storage**: Supabase Storage for thumbnails and exports
- **Edge Functions**: Thumbnail generation and export processing

### 2.3 Infrastructure
- **Deployment**: Vercel for frontend, Supabase for backend
- **CDN**: Vercel Edge Network for static assets
- **Monitoring**: Supabase Dashboard + Sentry for error tracking

## 3. 아키텍처 설계

### 3.1 전체 시스템 아키텍처
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  React + TypeScript + Vite + Tailwind CSS                      │
│  ├── BPMN Editor (bpmn-js + custom modules)                    │
│  ├── Real-time Collaboration (Yjs + Awareness)                 │
│  ├── State Management (Zustand)                                │
│  └── UI Components (Project Tree, Comments, etc.)              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                             │
├─────────────────────────────────────────────────────────────────┤
│  ├── PostgreSQL Database (with RLS)                            │
│  ├── Supabase Auth (JWT + OAuth2)                             │
│  ├── Supabase Realtime (WebSocket)                            │
│  ├── Supabase Storage (Files & Thumbnails)                    │
│  └── Edge Functions (Server-side Processing)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 데이터베이스 스키마 (핵심 테이블)
```sql
-- 사용자 프로필 (Supabase Auth 연동)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로젝트
CREATE TABLE projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES profiles(id) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로젝트 멤버 및 권한
CREATE TYPE member_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TABLE project_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'viewer',
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(project_id, user_id)
);

-- 폴더 (계층적 구조)
CREATE TABLE folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 다이어그램
CREATE TABLE diagrams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    content TEXT NOT NULL, -- BPMN XML
    thumbnail_url TEXT,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES profiles(id),
    last_modified_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 다이어그램 버전 히스토리
CREATE TABLE diagram_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diagram_id, version_number)
);

-- 실시간 협업 세션
CREATE TABLE collaboration_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    cursor_position JSONB,
    selection JSONB,
    color TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(diagram_id, user_id)
);

-- 댓글 시스템
CREATE TABLE diagram_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES diagram_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    element_id TEXT, -- BPMN 요소 ID
    position JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 활동 로그
CREATE TABLE activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    resource_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. 실시간 협업 구현 상세

### 4.1 Yjs CRDT 기반 동기화
```typescript
// Yjs 문서 구조
interface YjsBpmnDocument {
  elements: Y.Map<BpmnElement>;     // BPMN 요소들
  connections: Y.Array<Connection>; // 연결선들
  metadata: Y.Map<any>;            // 메타데이터
}

// BPMN-Yjs 어댑터
class BpmnYjsAdapter {
  private yDoc: Y.Doc;
  private yElements: Y.Map<BpmnElement>;
  private yConnections: Y.Array<Connection>;
  private modeler: BpmnModeler;
  private provider: WebsocketProvider;

  constructor(diagramId: string, supabaseUrl: string) {
    this.yDoc = new Y.Doc();
    this.yElements = this.yDoc.getMap('elements');
    this.yConnections = this.yDoc.getArray('connections');
    
    // Supabase WebSocket을 통한 동기화
    this.provider = new WebsocketProvider(
      supabaseUrl,
      diagramId,
      this.yDoc
    );
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // BPMN 요소 변경 → Yjs 동기화
    this.modeler.on('element.changed', (event) => {
      this.yDoc.transact(() => {
        this.yElements.set(event.element.id, {
          id: event.element.id,
          type: event.element.type,
          x: event.element.x,
          y: event.element.y,
          properties: event.element.businessObject
        });
      });
    });

    // Yjs 변경 → BPMN 업데이트
    this.yElements.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const element = this.yElements.get(key);
          this.updateBpmnElement(element);
        }
      });
    });
  }
}
```

### 4.2 실시간 협업 UI 구현
```typescript
// 원격 커서 및 선택 영역 표시
class RemoteCollaborationUI {
  private awareness: Awareness;
  private userColors: Map<string, string>;

  constructor(provider: WebsocketProvider) {
    this.awareness = provider.awareness;
    this.userColors = new Map();
    this.setupAwareness();
  }

  private setupAwareness() {
    this.awareness.on('change', ({ added, updated, removed }) => {
      // 새로운 사용자 참여
      added.forEach(userId => {
        const user = this.awareness.getStates().get(userId);
        this.addUserCursor(userId, user);
      });

      // 사용자 상태 업데이트
      updated.forEach(userId => {
        const user = this.awareness.getStates().get(userId);
        this.updateUserCursor(userId, user);
      });

      // 사용자 퇴장
      removed.forEach(userId => {
        this.removeUserCursor(userId);
      });
    });
  }

  updateLocalCursor(x: number, y: number, selectedElements: string[]) {
    this.awareness.setLocalStateField('cursor', {
      x, y, selectedElements,
      user: {
        name: this.currentUser.name,
        color: this.currentUser.color
      }
    });
  }
}
```

## 5. 핵심 기능 상세 설계

### 5.1 BPMN 에디터 통합
```typescript
// 커스텀 BPMN 모듈러 설정
class CollaborativeBpmnModeler extends BpmnModeler {
  constructor(options: BpmnModelerOptions) {
    super({
      ...options,
      additionalModules: [
        // 협업 모듈
        RemoteCursorModule,
        RemoteSelectionModule,
        CollaborationSyncModule,
        
        // 기능 모듈
        PropertyPanelModule,
        ValidationModule,
        CommentModule,
        
        // UI 모듈
        CustomPaletteModule,
        ContextMenuModule
      ]
    });
  }
}

// 속성 패널 모듈
const PropertyPanelModule = {
  __init__: ['propertyPanel'],
  propertyPanel: ['type', PropertyPanelProvider]
};

class PropertyPanelProvider {
  constructor(eventBus: EventBus, selection: Selection) {
    this.eventBus = eventBus;
    this.selection = selection;
    
    // 선택 변경 시 속성 패널 업데이트
    this.eventBus.on('selection.changed', (event) => {
      this.updatePropertyPanel(event.newSelection);
    });
  }

  updatePropertyPanel(selectedElements: Element[]) {
    if (selectedElements.length === 1) {
      const element = selectedElements[0];
      const properties = this.extractProperties(element);
      this.renderPropertyPanel(properties);
    }
  }
}
```

### 5.2 버전 관리 시스템
```typescript
// 자동 버전 생성 트리거 (PostgreSQL)
CREATE OR REPLACE FUNCTION create_diagram_version()
RETURNS TRIGGER AS $$
BEGIN
    -- content가 변경된 경우에만 버전 생성
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        INSERT INTO diagram_versions (
            diagram_id,
            version_number,
            content,
            change_summary,
            created_by
        ) VALUES (
            NEW.id,
            NEW.version,
            OLD.content,
            'Auto-saved version',
            NEW.last_modified_by
        );
        
        -- 버전 번호 증가
        NEW.version = NEW.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

// 프론트엔드 버전 관리
class VersionManager {
  async restoreVersion(diagramId: string, versionNumber: number) {
    const { data: version } = await supabase
      .from('diagram_versions')
      .select('content')
      .eq('diagram_id', diagramId)
      .eq('version_number', versionNumber)
      .single();

    if (version) {
      // 현재 버전을 새 버전으로 저장
      await this.createVersion(diagramId, 'Restored from version ' + versionNumber);
      
      // 선택한 버전으로 복원
      await this.updateDiagramContent(diagramId, version.content);
    }
  }
}
```

### 5.3 Role-Based Access Control (RBAC)
```sql
-- RLS 정책 예시
CREATE POLICY "View diagrams" ON diagrams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.id = diagrams.project_id
            AND (
                p.is_public = TRUE OR
                p.owner_id = auth.uid() OR
                (pm.user_id = auth.uid() AND pm.accepted_at IS NOT NULL)
            )
        )
    );

CREATE POLICY "Edit diagrams" ON diagrams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.id = diagrams.project_id
            AND (
                p.owner_id = auth.uid() OR
                (pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor'))
            )
        )
    );
```

## 6. 프로젝트 구조

### 6.1 Frontend 디렉토리 구조
```
src/
├── components/
│   ├── Editor/
│   │   ├── BpmnEditor.tsx           # 메인 에디터
│   │   ├── CollaborationLayer.tsx   # 협업 오버레이
│   │   ├── PropertyPanel.tsx        # 속성 패널
│   │   └── Toolbar.tsx              # 도구 모음
│   ├── Project/
│   │   ├── ProjectTree.tsx          # 프로젝트 트리
│   │   ├── FolderNode.tsx           # 폴더 노드
│   │   └── DiagramNode.tsx          # 다이어그램 노드
│   ├── Comments/
│   │   ├── CommentThread.tsx        # 댓글 스레드
│   │   ├── CommentForm.tsx          # 댓글 작성
│   │   └── CommentMarker.tsx        # 댓글 마커
│   ├── Auth/
│   │   ├── LoginForm.tsx            # 로그인
│   │   ├── SignupForm.tsx           # 회원가입
│   │   └── InviteModal.tsx          # 초대 모달
│   └── Common/
│       ├── Layout.tsx               # 레이아웃
│       ├── LoadingSpinner.tsx       # 로딩
│       └── ErrorBoundary.tsx        # 에러 처리
├── hooks/
│   ├── useCollaboration.ts          # 협업 훅
│   ├── useBpmnEditor.ts             # 에디터 훅
│   ├── useProjectTree.ts            # 프로젝트 트리 훅
│   └── useSupabase.ts               # Supabase 훅
├── services/
│   ├── supabase.ts                  # Supabase 클라이언트
│   ├── bpmn-collaboration.ts        # BPMN 협업 서비스
│   └── auth.ts                      # 인증 서비스
├── stores/
│   ├── authStore.ts                 # 인증 상태
│   ├── projectStore.ts              # 프로젝트 상태
│   └── editorStore.ts               # 에디터 상태
├── types/
│   ├── database.ts                  # DB 타입 정의
│   ├── bpmn.ts                      # BPMN 타입 정의
│   └── collaboration.ts             # 협업 타입 정의
└── utils/
    ├── bpmn-utils.ts                # BPMN 유틸리티
    ├── export-utils.ts              # 내보내기 유틸리티
    └── validation.ts                # 유효성 검사
```

## 7. 개발 단계 및 로드맵

### 7.1 Phase 1: MVP (6-8주)
**목표**: 기본적인 협업 BPMN 에디터 구현

**주요 기능**:
- Supabase 프로젝트 설정 및 DB 스키마 구축
- 기본 BPMN 에디터 (bpmn-js 통합)
- 사용자 인증 (Supabase Auth)
- 프로젝트/다이어그램 CRUD
- 기본 실시간 동기화 (Yjs)

**기술 작업**:
- React + TypeScript + Vite 프로젝트 초기화
- Supabase 프로젝트 설정 및 테이블 생성
- bpmn-js 통합 및 기본 에디터 구현
- Yjs 통합 및 기본 동기화 구현
- 인증 플로우 구현

### 7.2 Phase 2: 고급 협업 기능 (8-10주)
**목표**: 실시간 협업 경험 완성

**주요 기능**:
- 실시간 커서 및 선택 영역 표시
- 댓글 시스템 (요소 기반)
- 자동 버전 관리
- 역할 기반 권한 관리
- 고급 속성 패널

**기술 작업**:
- Yjs Awareness Protocol 구현
- 댓글 시스템 DB 설계 및 구현
- 버전 관리 시스템 구현
- RBAC 정책 적용
- 고급 UI/UX 구현

### 7.3 Phase 3: 프로덕션 준비 (6-8주)
**목표**: 배포 가능한 완성된 제품

**주요 기능**:
- 썸네일 자동 생성
- 다이어그램 내보내기 (SVG/PNG/XML)
- 고급 검색 및 필터링
- 성능 최적화
- 모바일 반응형 지원

**기술 작업**:
- Supabase Edge Functions 구현
- 성능 최적화 및 번들 크기 최적화
- 테스트 자동화 (Jest + Playwright)
- CI/CD 파이프라인 구축
- 모니터링 및 에러 추적 설정

## 8. 기술적 고려사항

### 8.1 성능 최적화
- **가상화**: 대용량 프로젝트 트리를 위한 가상 스크롤링
- **지연 로딩**: 다이어그램 콘텐츠의 점진적 로딩
- **메모이제이션**: React 컴포넌트 및 계산 결과 캐싱
- **번들 최적화**: 코드 스플리팅 및 트리 쉐이킹

### 8.2 확장성 고려
- **수평 확장**: Supabase의 자동 스케일링 활용
- **데이터 파티셔닝**: 프로젝트별 데이터 분리
- **캐싱 전략**: 자주 접근되는 데이터의 클라이언트 캐싱
- **WebRTC 지원**: 향후 P2P 협업 지원

### 8.3 보안 강화
- **데이터 암호화**: 민감한 데이터의 전송 및 저장 시 암호화
- **API 속도 제한**: 악의적 요청 방지
- **입력 검증**: XSS 및 SQL 인젝션 방지
- **감사 로그**: 모든 중요 작업의 로그 기록

## 9. 배포 및 운영

### 9.1 배포 전략
- **Frontend**: Vercel을 통한 자동 배포
- **Backend**: Supabase 클라우드 서비스 활용
- **Environment**: 개발/스테이징/프로덕션 환경 분리
- **CDN**: Vercel Edge Network 활용

### 9.2 모니터링
- **애플리케이션 모니터링**: Sentry를 통한 에러 추적
- **성능 모니터링**: Web Vitals 및 사용자 경험 지표
- **데이터베이스 모니터링**: Supabase 대시보드 활용
- **사용자 분석**: 사용 패턴 분석 및 개선점 도출

이 설계 문서는 BPMN 협업 에디터 개발의 전체적인 로드맵과 구현 방향을 제시합니다. 각 단계별로 구체적인 구현 작업이 필요하며, 사용자 피드백을 기반으로 지속적인 개선을 진행해야 합니다.