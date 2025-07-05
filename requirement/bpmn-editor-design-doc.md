# BPMN 협업 에디터 설계 문서

## 1. 프로젝트 개요

### 1.1 목적
여러 사용자가 동시에 BPMN 다이어그램을 편집할 수 있는 실시간 협업 웹 애플리케이션 개발

### 1.2 핵심 기능
- 실시간 동시 편집 및 커서/선택 영역 공유
- BPMN.io 기반 다이어그램 편집
- 프로젝트 및 폴더 구조 관리
- 사용자 권한 관리 시스템

## 2. 기술 스택

### 2.1 Frontend
- **Framework**: React 18+ with TypeScript
- **BPMN Editor**: bpmn-js (BPMN.io)
- **State Management**: Redux Toolkit / Zustand
- **Real-time Communication**: Socket.io-client
- **UI Library**: Material-UI / Ant Design
- **Build Tool**: Vite

### 2.2 Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Real-time**: Socket.io
- **Database**: PostgreSQL (관계형 데이터) + Redis (세션/캐시)
- **ORM**: Prisma
- **Authentication**: JWT + OAuth2

### 2.3 Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes (선택사항)
- **Cloud**: AWS/GCP/Azure
- **CDN**: CloudFront/Cloudflare

## 3. 시스템 아키텍처

### 3.1 전체 구조
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│   API Gateway   │────▶│  Load Balancer  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                              ┌───────────────────────────┴───────────────────────────┐
                              │                                                       │
                    ┌─────────▼─────────┐                                   ┌─────────▼─────────┐
                    │   Auth Service    │                                   │  WebSocket Server │
                    └───────────────────┘                                   └───────────────────┘
                              │                                                       │
                    ┌─────────▼─────────┐     ┌─────────────────┐         ┌─────────▼─────────┐
                    │   API Server      │────▶│     Redis       │◀────────│  Collaboration    │
                    └───────────────────┘     │  (Pub/Sub)      │         │     Service       │
                              │               └─────────────────┘         └───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   PostgreSQL      │
                    │   Database        │
                    └───────────────────┘
```

### 3.2 데이터베이스 스키마

```sql
-- 사용자 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 프로젝트 테이블
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 폴더 테이블
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- BPMN 다이어그램 테이블
CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- BPMN XML
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    last_modified_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 권한 테이블
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'owner', 'editor', 'viewer'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 다이어그램 버전 관리 테이블
CREATE TABLE diagram_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 협업 세션 테이블
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    cursor_position JSONB,
    selection JSONB,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP DEFAULT NOW()
);
```

## 4. 핵심 기능 상세 설계

### 4.1 실시간 협업 시스템

#### 4.1.1 Operational Transformation (OT) 알고리즘
BPMN 요소의 동시 편집 충돌을 해결하기 위해 OT 알고리즘 적용

```typescript
interface Operation {
  type: 'add' | 'update' | 'delete' | 'move';
  elementId: string;
  elementType: string;
  data: any;
  timestamp: number;
  userId: string;
}

class OperationalTransform {
  transform(op1: Operation, op2: Operation): Operation {
    // 충돌 해결 로직
    if (op1.elementId === op2.elementId) {
      // 같은 요소에 대한 작업인 경우
      if (op1.timestamp < op2.timestamp) {
        return this.resolveConflict(op1, op2);
      }
    }
    return op1;
  }
}
```

#### 4.1.2 WebSocket 이벤트 구조
```typescript
// 클라이언트 → 서버
interface ClientEvents {
  'join-diagram': { diagramId: string };
  'leave-diagram': { diagramId: string };
  'element-change': Operation;
  'cursor-move': { x: number; y: number };
  'selection-change': { elementIds: string[] };
}

// 서버 → 클라이언트
interface ServerEvents {
  'user-joined': { userId: string; userInfo: UserInfo };
  'user-left': { userId: string };
  'remote-change': Operation;
  'remote-cursor': { userId: string; position: Position };
  'remote-selection': { userId: string; elementIds: string[] };
  'sync-state': { operations: Operation[] };
}
```

### 4.2 BPMN.io 통합

#### 4.2.1 커스텀 모듈러 확장
```typescript
import BpmnModeler from 'bpmn-js/lib/Modeler';

class CollaborativeBpmnModeler extends BpmnModeler {
  constructor(options: any) {
    super({
      ...options,
      additionalModules: [
        RemoteCursorModule,
        RemoteSelectionModule,
        CollaborationSyncModule,
        VersionControlModule
      ]
    });
  }
}

// 원격 커서 표시 모듈
const RemoteCursorModule = {
  __init__: ['remoteCursorRenderer'],
  remoteCursorRenderer: ['type', RemoteCursorRenderer]
};
```

#### 4.2.2 변경사항 감지 및 동기화
```typescript
class BpmnCollaborationHandler {
  private modeler: BpmnModeler;
  private socket: Socket;

  constructor(modeler: BpmnModeler, socket: Socket) {
    this.modeler = modeler;
    this.socket = socket;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const eventBus = this.modeler.get('eventBus');
    
    // BPMN 요소 변경 감지
    eventBus.on('element.changed', (event: any) => {
      const operation: Operation = {
        type: 'update',
        elementId: event.element.id,
        elementType: event.element.type,
        data: this.serializeElement(event.element),
        timestamp: Date.now(),
        userId: getCurrentUserId()
      };
      
      this.socket.emit('element-change', operation);
    });
  }
}
```

### 4.3 프로젝트/폴더 관리

#### 4.3.1 트리 구조 관리
```typescript
interface ProjectNode {
  id: string;
  name: string;
  type: 'project' | 'folder' | 'diagram';
  children?: ProjectNode[];
  parentId?: string;
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
  };
}

class ProjectTreeManager {
  async createFolder(projectId: string, parentId: string | null, name: string) {
    // 폴더 생성 로직
  }
  
  async moveNode(nodeId: string, newParentId: string) {
    // 노드 이동 로직
  }
  
  async deleteNode(nodeId: string) {
    // 재귀적 삭제 로직
  }
}
```

### 4.4 권한 관리 시스템

#### 4.4.1 역할 기반 접근 제어 (RBAC)
```typescript
enum Role {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer'
}

interface Permission {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  share: boolean;
}

const RolePermissions: Record<Role, Permission> = {
  [Role.OWNER]: { create: true, read: true, update: true, delete: true, share: true },
  [Role.EDITOR]: { create: true, read: true, update: true, delete: false, share: false },
  [Role.VIEWER]: { create: false, read: true, update: false, delete: false, share: false }
};
```

#### 4.4.2 권한 확인 미들웨어
```typescript
const checkPermission = (requiredPermission: keyof Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    const userRole = await getUserRole(userId, projectId);
    const permissions = RolePermissions[userRole];
    
    if (!permissions[requiredPermission]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

## 5. API 설계

### 5.1 RESTful API 엔드포인트

```typescript
// 인증
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

// 프로젝트 관리
GET    /api/projects                    // 프로젝트 목록
POST   /api/projects                    // 프로젝트 생성
GET    /api/projects/:id                // 프로젝트 상세
PUT    /api/projects/:id                // 프로젝트 수정
DELETE /api/projects/:id                // 프로젝트 삭제

// 폴더 관리
GET    /api/projects/:projectId/folders
POST   /api/projects/:projectId/folders
PUT    /api/folders/:id
DELETE /api/folders/:id

// 다이어그램 관리
GET    /api/diagrams/:id
POST   /api/projects/:projectId/diagrams
PUT    /api/diagrams/:id
DELETE /api/diagrams/:id
GET    /api/diagrams/:id/versions

// 권한 관리
GET    /api/projects/:id/permissions
POST   /api/projects/:id/permissions
PUT    /api/projects/:id/permissions/:userId
DELETE /api/projects/:id/permissions/:userId

// 협업 세션
GET    /api/diagrams/:id/sessions
POST   /api/diagrams/:id/join
DELETE /api/diagrams/:id/leave
```

## 6. 프론트엔드 구조

### 6.1 컴포넌트 구조
```
src/
├── components/
│   ├── Editor/
│   │   ├── BpmnEditor.tsx
│   │   ├── Toolbar.tsx
│   │   ├── PropertyPanel.tsx
│   │   └── CollaboratorCursors.tsx
│   ├── ProjectTree/
│   │   ├── TreeView.tsx
│   │   ├── TreeNode.tsx
│   │   └── ContextMenu.tsx
│   ├── Collaboration/
│   │   ├── UserList.tsx
│   │   ├── UserAvatar.tsx
│   │   └── PresenceIndicator.tsx
│   └── Permissions/
│       ├── ShareDialog.tsx
│       └── PermissionsList.tsx
├── hooks/
│   ├── useCollaboration.ts
│   ├── useBpmnModeler.ts
│   └── useProjectTree.ts
├── services/
│   ├── api.ts
│   ├── websocket.ts
│   └── auth.ts
└── store/
    ├── projectSlice.ts
    ├── diagramSlice.ts
    └── collaborationSlice.ts
```

### 6.2 상태 관리 설계
```typescript
interface AppState {
  auth: {
    user: User | null;
    isAuthenticated: boolean;
  };
  projects: {
    list: Project[];
    current: Project | null;
    tree: ProjectNode[];
  };
  diagram: {
    current: Diagram | null;
    isLoading: boolean;
    versions: DiagramVersion[];
  };
  collaboration: {
    users: CollaboratorInfo[];
    cursors: Map<string, Position>;
    selections: Map<string, string[]>;
  };
}
```

## 7. 보안 고려사항

### 7.1 인증 및 권한
- JWT 토큰 기반 인증
- Refresh Token 구현
- OAuth2 소셜 로그인 지원 (Google, GitHub)

### 7.2 데이터 보안
- HTTPS 필수 적용
- WebSocket Secure (WSS) 사용
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (입력값 검증 및 이스케이프)

### 7.3 접근 제어
- 프로젝트별 권한 검증
- API Rate Limiting
- CORS 설정

## 8. 성능 최적화

### 8.1 프론트엔드 최적화
- React.lazy를 활용한 코드 스플리팅
- 가상 스크롤링 (대량 다이어그램 목록)
- WebWorker를 활용한 BPMN 파싱
- 디바운싱/스로틀링 적용

### 8.2 백엔드 최적화
- Redis 캐싱 전략
- 데이터베이스 인덱싱
- Connection Pooling
- 수평적 확장 고려

### 8.3 실시간 동기화 최적화
- 델타 업데이트 전송
- 압축 알고리즘 적용
- 배치 업데이트 처리

## 9. 배포 및 운영

### 9.1 CI/CD 파이프라인
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker images
      - name: Push to Registry
      - name: Deploy to Kubernetes
```

### 9.2 모니터링
- Application Performance Monitoring (APM)
- 로그 집계 (ELK Stack)
- 에러 트래킹 (Sentry)
- 사용자 분석 (Google Analytics)

## 10. 향후 확장 계획

### 10.1 추가 기능
- 오프라인 모드 지원
- 모바일 앱 개발
- AI 기반 프로세스 추천
- 템플릿 마켓플레이스
- 외부 시스템 연동 (Jira, Slack)

### 10.2 기술적 개선
- GraphQL 도입 검토
- 마이크로서비스 아키텍처 전환
- Event Sourcing 패턴 적용
- CRDT 알고리즘 도입 검토