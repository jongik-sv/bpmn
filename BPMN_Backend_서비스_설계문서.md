# BPMN 동시편집 에디터 백엔드 서비스 설계문서
## MongoDB + Node.js + Yjs WebSocket Server

## 1. 아키텍처 개요

### 1.1 기술 스택
- **런타임**: Node.js 18+
- **프레임워크**: Express.js
- **데이터베이스**: MongoDB 6.0+
- **ODM**: Mongoose
- **실시간 통신**: WebSocket + y-websocket
- **인증**: JWT + Passport.js
- **캐시**: Redis
- **파일 스토리지**: GridFS (MongoDB)

### 1.2 서비스 아키텍처
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │   Load Balancer  │    │   API Gateway   │
│   (React+Yjs)   │◄──►│   (Nginx)        │◄──►│   (Express)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                    ┌─────────▼────────┐    ┌──────────▼──────────┐    ┌─────────▼────────┐
                    │   WebSocket      │    │   REST API          │    │   Auth Service   │
                    │   Server         │    │   Server            │    │                  │
                    │   (y-websocket)  │    │   (CRUD)            │    │   (JWT)          │
                    └─────────┬────────┘    └──────────┬──────────┘    └─────────┬────────┘
                              │                        │                         │
                    ┌─────────▼────────┐    ┌──────────▼──────────┐    ┌─────────▼────────┐
                    │   Redis          │    │   MongoDB           │    │   MongoDB        │
                    │   (Session)      │    │   (Documents)       │    │   (Users)        │
                    └──────────────────┘    └─────────────────────┘    └──────────────────┘
```

## 2. 데이터베이스 설계 (MongoDB)

### 2.1 컬렉션 스키마

#### 2.1.1 Users 컬렉션
```typescript
interface User {
  _id: ObjectId;
  email: string;              // 이메일 (유니크)
  username: string;           // 사용자명
  displayName: string;        // 표시명
  avatar?: string;            // 프로필 이미지 URL
  passwordHash: string;       // 해시된 비밀번호
  provider: 'local' | 'google' | 'github'; // 인증 제공자
  providerId?: string;        // 외부 제공자 ID
  emailVerified: boolean;     // 이메일 인증 여부
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Mongoose 스키마
const userSchema = new Schema<User>({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  avatar: String,
  passwordHash: { type: String, required: true },
  provider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  providerId: String,
  emailVerified: { type: Boolean, default: false },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'ko' },
    notifications: { type: Boolean, default: true }
  }
}, { timestamps: true });
```

#### 2.1.2 Projects 컬렉션
```typescript
interface Project {
  _id: ObjectId;
  name: string;               // 프로젝트명
  description?: string;       // 설명
  ownerId: ObjectId;         // 소유자 ID
  visibility: 'private' | 'public' | 'team'; // 공개 범위
  settings: {
    allowComments: boolean;
    allowExport: boolean;
    autoSave: boolean;
    autoSaveInterval: number; // 초 단위
  };
  tags: string[];            // 태그 목록
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

const projectSchema = new Schema<Project>({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { type: String, enum: ['private', 'public', 'team'], default: 'private' },
  settings: {
    allowComments: { type: Boolean, default: true },
    allowExport: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: true },
    autoSaveInterval: { type: Number, default: 30 }
  },
  tags: [String],
  lastAccessedAt: { type: Date, default: Date.now }
}, { timestamps: true });
```

#### 2.1.3 Documents 컬렉션 (BPMN 문서)
```typescript
interface BpmnDocument {
  _id: ObjectId;
  projectId: ObjectId;        // 프로젝트 ID
  name: string;               // 문서명
  bpmnXml: string;           // BPMN XML 내용
  yjsState: Buffer;          // Yjs 상태 (압축됨)
  yjsStateVector: Buffer;    // Yjs 상태 벡터
  metadata: {
    elementCount: number;
    lastModifiedBy: ObjectId;
    version: number;
    fileSize: number;        // 바이트 단위
  };
  snapshots: Array<{         // 스냅샷 목록
    id: string;
    name: string;
    yjsState: Buffer;
    createdBy: ObjectId;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<BpmnDocument>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  bpmnXml: { type: String, required: true },
  yjsState: { type: Buffer, required: true },
  yjsStateVector: { type: Buffer, required: true },
  metadata: {
    elementCount: { type: Number, default: 0 },
    lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 1 },
    fileSize: { type: Number, default: 0 }
  },
  snapshots: [{
    id: String,
    name: String,
    yjsState: Buffer,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
```

#### 2.1.4 DocumentShares 컬렉션 (문서 공유 관리)
```typescript
interface DocumentShare {
  _id: ObjectId;
  documentId: ObjectId;      // 문서 ID
  shareToken: string;        // 공유 토큰 (UUID)
  createdBy: ObjectId;       // 공유 생성자
  shareType: 'link' | 'email'; // 공유 타입
  accessLevel: 'editor' | 'viewer'; // 접근 권한
  settings: {
    requireAuth: boolean;    // 로그인 필요 여부
    allowDownload: boolean;  // 다운로드 허용
    allowComment: boolean;   // 댓글 허용
    expiresAt?: Date;        // 만료일
    accessLimit?: number;    // 접근 횟수 제한
    currentAccess: number;   // 현재 접근 횟수
    password?: string;       // 비밀번호 보호
  };
  isActive: boolean;         // 활성 상태
  createdAt: Date;
  updatedAt: Date;
}

const documentShareSchema = new Schema<DocumentShare>({
  documentId: { type: Schema.Types.ObjectId, ref: 'BpmnDocument', required: true },
  shareToken: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shareType: { type: String, enum: ['link', 'email'], required: true },
  accessLevel: { type: String, enum: ['editor', 'viewer'], required: true },
  settings: {
    requireAuth: { type: Boolean, default: false },
    allowDownload: { type: Boolean, default: true },
    allowComment: { type: Boolean, default: true },
    expiresAt: Date,
    accessLimit: Number,
    currentAccess: { type: Number, default: 0 },
    password: String
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

#### 2.1.5 ShareAccess 컬렉션 (공유 접근 로그)
```typescript
interface ShareAccess {
  _id: ObjectId;
  shareId: ObjectId;         // DocumentShare ID
  documentId: ObjectId;      // 문서 ID
  userId?: ObjectId;         // 사용자 ID (로그인한 경우)
  ipAddress: string;         // IP 주소
  userAgent: string;         // User Agent
  accessedAt: Date;
  sessionDuration?: number;  // 세션 지속 시간 (초)
  actions: Array<{           // 수행한 액션들
    type: string;
    timestamp: Date;
    details?: any;
  }>;
}

const shareAccessSchema = new Schema<ShareAccess>({
  shareId: { type: Schema.Types.ObjectId, ref: 'DocumentShare', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'BpmnDocument', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  accessedAt: { type: Date, default: Date.now },
  sessionDuration: Number,
  actions: [{
    type: String,
    timestamp: { type: Date, default: Date.now },
    details: Schema.Types.Mixed
  }]
});
```

#### 2.1.6 Permissions 컬렉션
```typescript
interface Permission {
  _id: ObjectId;
  projectId: ObjectId;       // 프로젝트 ID
  userId: ObjectId;          // 사용자 ID
  role: 'owner' | 'editor' | 'viewer' | 'commenter'; // 역할
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
    share: boolean;
    comment: boolean;
  };
  grantedBy: ObjectId;       // 권한 부여자
  grantedAt: Date;
  expiresAt?: Date;          // 권한 만료일
}

const permissionSchema = new Schema<Permission>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'editor', 'viewer', 'commenter'], required: true },
  permissions: {
    read: { type: Boolean, default: true },
    write: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    share: { type: Boolean, default: false },
    comment: { type: Boolean, default: false }
  },
  grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  grantedAt: { type: Date, default: Date.now },
  expiresAt: Date
});

// 복합 인덱스
permissionSchema.index({ projectId: 1, userId: 1 }, { unique: true });
```

#### 2.1.7 Comments 컬렉션
```typescript
interface Comment {
  _id: ObjectId;
  documentId: ObjectId;      // 문서 ID
  elementId?: string;        // BPMN 요소 ID (전체 문서 댓글인 경우 null)
  parentId?: ObjectId;       // 부모 댓글 ID (답글인 경우)
  authorId: ObjectId;        // 작성자 ID
  content: string;           // 댓글 내용
  position?: {               // 댓글 위치 (화면 좌표)
    x: number;
    y: number;
  };
  status: 'active' | 'resolved' | 'deleted'; // 상태
  mentions: ObjectId[];      // 멘션된 사용자들
  reactions: Array<{         // 반응 (이모지 등)
    userId: ObjectId;
    type: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<Comment>({
  documentId: { type: Schema.Types.ObjectId, ref: 'BpmnDocument', required: true },
  elementId: String,
  parentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  position: {
    x: Number,
    y: Number
  },
  status: { type: String, enum: ['active', 'resolved', 'deleted'], default: 'active' },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: String
  }]
}, { timestamps: true });
```

#### 2.1.8 ActivityLogs 컬렉션
```typescript
interface ActivityLog {
  _id: ObjectId;
  projectId: ObjectId;       // 프로젝트 ID
  documentId?: ObjectId;     // 문서 ID
  userId: ObjectId;          // 사용자 ID
  action: string;            // 액션 타입
  details: {                 // 액션 세부사항
    elementId?: string;
    elementType?: string;
    oldValue?: any;
    newValue?: any;
    description?: string;
  };
  ipAddress: string;         // IP 주소
  userAgent: string;         // User Agent
  timestamp: Date;
}

const activityLogSchema = new Schema<ActivityLog>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'BpmnDocument' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  details: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});
```

### 2.2 인덱스 설계
```typescript
// 성능 최적화를 위한 인덱스
const indexes = [
  // Users
  { collection: 'users', index: { email: 1 }, unique: true },
  { collection: 'users', index: { username: 1 }, unique: true },
  
  // Projects
  { collection: 'projects', index: { ownerId: 1, createdAt: -1 } },
  { collection: 'projects', index: { tags: 1 } },
  { collection: 'projects', index: { visibility: 1, updatedAt: -1 } },
  
  // Documents
  { collection: 'documents', index: { projectId: 1, name: 1 }, unique: true },
  { collection: 'documents', index: { 'metadata.lastModifiedBy': 1, updatedAt: -1 } },
  
  // Permissions
  { collection: 'permissions', index: { projectId: 1, userId: 1 }, unique: true },
  { collection: 'permissions', index: { userId: 1, role: 1 } },
  
  // DocumentShares
  { collection: 'documentshares', index: { shareToken: 1 }, unique: true },
  { collection: 'documentshares', index: { documentId: 1, isActive: 1 } },
  { collection: 'documentshares', index: { createdBy: 1, createdAt: -1 } },
  
  // ShareAccess
  { collection: 'shareaccess', index: { shareId: 1, accessedAt: -1 } },
  { collection: 'shareaccess', index: { documentId: 1, accessedAt: -1 } },
  { collection: 'shareaccess', index: { ipAddress: 1 } },
  
  // Comments
  { collection: 'comments', index: { documentId: 1, elementId: 1 } },
  { collection: 'comments', index: { authorId: 1, createdAt: -1 } },
  { collection: 'comments', index: { parentId: 1 } },
  
  // ActivityLogs
  { collection: 'activitylogs', index: { projectId: 1, timestamp: -1 } },
  { collection: 'activitylogs', index: { userId: 1, timestamp: -1 } },
  { collection: 'activitylogs', index: { documentId: 1, timestamp: -1 } }
];
```

## 3. API 서버 설계 (Express.js)

### 3.1 프로젝트 구조
```
backend/
├── src/
│   ├── controllers/         # 컨트롤러
│   │   ├── auth.controller.ts
│   │   ├── project.controller.ts
│   │   ├── document.controller.ts
│   │   ├── document-share.controller.ts
│   │   └── comment.controller.ts
│   ├── models/             # MongoDB 모델
│   │   ├── User.ts
│   │   ├── Project.ts
│   │   ├── Document.ts
│   │   ├── DocumentShare.ts
│   │   ├── ShareAccess.ts
│   │   └── Comment.ts
│   ├── routes/             # 라우터
│   │   ├── auth.routes.ts
│   │   ├── project.routes.ts
│   │   ├── document.routes.ts
│   │   └── document-share.routes.ts
│   ├── middleware/         # 미들웨어
│   │   ├── auth.middleware.ts
│   │   ├── permission.middleware.ts
│   │   └── validation.middleware.ts
│   ├── services/           # 비즈니스 로직
│   │   ├── auth.service.ts
│   │   ├── project.service.ts
│   │   ├── document.service.ts
│   │   └── yjs.service.ts
│   ├── websocket/          # WebSocket 서버
│   │   ├── yjs-server.ts
│   │   └── collaboration.ts
│   ├── utils/              # 유틸리티
│   │   ├── logger.ts
│   │   ├── validator.ts
│   │   └── crypto.ts
│   └── app.ts              # Express 앱
├── package.json
└── tsconfig.json
```

### 3.2 REST API 엔드포인트

#### 3.2.1 인증 API
```typescript
// auth.routes.ts
const authRoutes = [
  'POST /api/auth/register',      // 회원가입
  'POST /api/auth/login',         // 로그인
  'POST /api/auth/logout',        // 로그아웃
  'POST /api/auth/refresh',       // 토큰 갱신
  'GET  /api/auth/profile',       // 프로필 조회
  'PUT  /api/auth/profile',       // 프로필 수정
  'POST /api/auth/verify-email',  // 이메일 인증
  'POST /api/auth/forgot-password', // 비밀번호 재설정
];

// auth.controller.ts
export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const { email, username, password, displayName } = req.body;
    
    // 사용자 중복 체크
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }
    
    // 비밀번호 해시
    const passwordHash = await bcrypt.hash(password, 12);
    
    // 사용자 생성
    const user = new User({
      email,
      username,
      displayName,
      passwordHash
    });
    
    await user.save();
    
    // JWT 토큰 생성
    const token = this.generateJWT(user._id);
    
    res.status(201).json({
      user: this.sanitizeUser(user),
      token
    });
  }
}
```

#### 3.2.2 프로젝트 API
```typescript
// project.routes.ts
const projectRoutes = [
  'GET    /api/projects',           // 프로젝트 목록 조회
  'POST   /api/projects',           // 프로젝트 생성
  'GET    /api/projects/:id',       // 프로젝트 상세 조회
  'PUT    /api/projects/:id',       // 프로젝트 수정
  'DELETE /api/projects/:id',       // 프로젝트 삭제
  'POST   /api/projects/:id/share', // 프로젝트 공유
  'GET    /api/projects/:id/members', // 멤버 목록
  'PUT    /api/projects/:id/members/:userId', // 멤버 권한 수정
];

// project.controller.ts
export class ProjectController {
  async createProject(req: Request, res: Response): Promise<void> {
    const { name, description, visibility } = req.body;
    const ownerId = req.user!.id;
    
    const project = new Project({
      name,
      description,
      ownerId,
      visibility
    });
    
    await project.save();
    
    // 소유자 권한 생성
    const permission = new Permission({
      projectId: project._id,
      userId: ownerId,
      role: 'owner',
      permissions: {
        read: true,
        write: true,
        delete: true,
        share: true,
        comment: true
      },
      grantedBy: ownerId
    });
    
    await permission.save();
    
    res.status(201).json(project);
  }
}
```

#### 3.2.3 문서 API
```typescript
// document.routes.ts
const documentRoutes = [
  'GET    /api/projects/:projectId/documents',     // 문서 목록
  'POST   /api/projects/:projectId/documents',     // 문서 생성
  'GET    /api/documents/:id',                     // 문서 조회
  'PUT    /api/documents/:id',                     // 문서 수정
  'DELETE /api/documents/:id',                     // 문서 삭제
  'GET    /api/documents/:id/export',              // 문서 내보내기
  'POST   /api/documents/:id/snapshots',           // 스냅샷 생성
  'GET    /api/documents/:id/snapshots',           // 스냅샷 목록
  'POST   /api/documents/:id/restore/:snapshotId', // 스냅샷 복원
];

// document.controller.ts
export class DocumentController {
  async getDocument(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = req.user!.id;
    
    // 권한 확인
    const hasPermission = await this.checkDocumentPermission(id, userId, 'read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    
    const document = await BpmnDocument.findById(id)
      .populate('projectId', 'name description')
      .populate('metadata.lastModifiedBy', 'username displayName');
    
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    
    res.json(document);
  }
}
```

### 3.3 서비스 레이어

#### 3.3.1 Yjs 통합 서비스
```typescript
// yjs.service.ts
import * as Y from 'yjs';
import { MongodbPersistence } from 'y-mongodb-provider';

export class YjsService {
  private persistence: MongodbPersistence;
  
  constructor() {
    this.persistence = new MongodbPersistence(
      process.env.MONGODB_URI!,
      {
        flushSize: 100,        // 플러시 크기
        multipleCollections: true
      }
    );
  }
  
  async getDocument(documentId: string): Promise<Y.Doc> {
    const ydoc = new Y.Doc();
    
    // MongoDB에서 상태 로드
    const persistedState = await this.persistence.getYDoc(documentId);
    if (persistedState) {
      Y.applyUpdate(ydoc, persistedState);
    }
    
    return ydoc;
  }
  
  async saveDocument(documentId: string, ydoc: Y.Doc): Promise<void> {
    const update = Y.encodeStateAsUpdate(ydoc);
    await this.persistence.storeUpdate(documentId, update);
    
    // BPMN XML 추출 및 저장
    const bpmnXml = this.extractBpmnXml(ydoc);
    await this.updateDocumentContent(documentId, bpmnXml, ydoc);
  }
  
  private async updateDocumentContent(
    documentId: string, 
    bpmnXml: string, 
    ydoc: Y.Doc
  ): Promise<void> {
    const yjsState = Y.encodeStateAsUpdate(ydoc);
    const yjsStateVector = Y.encodeStateVector(ydoc);
    
    await BpmnDocument.findByIdAndUpdate(documentId, {
      bpmnXml,
      yjsState,
      yjsStateVector,
      'metadata.elementCount': this.countBpmnElements(bpmnXml),
      'metadata.fileSize': Buffer.byteLength(bpmnXml, 'utf8'),
      'metadata.version': { $inc: 1 },
      updatedAt: new Date()
    });
  }
}
```

## 4. WebSocket 서버 (y-websocket)

### 4.1 WebSocket 서버 설정
```typescript
// websocket/yjs-server.ts
import WebSocket from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { YjsService } from '../services/yjs.service';
import { AuthService } from '../services/auth.service';

export class YjsWebSocketServer {
  private wss: WebSocket.Server;
  private yjsService: YjsService;
  private authService: AuthService;
  
  constructor(port: number = 1234) {
    this.wss = new WebSocket.Server({ port });
    this.yjsService = new YjsService();
    this.authService = new AuthService();
    
    this.setupConnectionHandling();
  }
  
  private setupConnectionHandling(): void {
    this.wss.on('connection', async (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const documentId = url.pathname.slice(1);
      const token = url.searchParams.get('token');
      
      // 인증 확인
      try {
        const user = await this.authService.verifyToken(token!);
        const hasAccess = await this.checkDocumentAccess(documentId, user.id);
        
        if (!hasAccess) {
          ws.close(1008, 'Access denied');
          return;
        }
        
        // WebSocket 연결 설정
        setupWSConnection(ws, req, {
          docName: documentId,
          gc: true,
          
          // 문서 로드
          getYDoc: async (docName: string) => {
            return await this.yjsService.getDocument(docName);
          },
          
          // 문서 저장
          persistDoc: async (docName: string, ydoc: Y.Doc) => {
            await this.yjsService.saveDocument(docName, ydoc);
            
            // 활동 로그 기록
            await this.logActivity(docName, user.id, 'document_updated');
          }
        });
        
        // 사용자 연결 알림
        this.broadcastUserJoined(documentId, user);
        
      } catch (error) {
        ws.close(1008, 'Authentication failed');
      }
    });
  }
}
```

### 4.2 실시간 협업 기능
```typescript
// websocket/collaboration.ts
export class CollaborationManager {
  private rooms: Map<string, Set<WebSocket>> = new Map();
  private userSessions: Map<string, UserSession> = new Map();
  
  joinRoom(documentId: string, ws: WebSocket, user: User): void {
    // 방 참여
    if (!this.rooms.has(documentId)) {
      this.rooms.set(documentId, new Set());
    }
    this.rooms.get(documentId)!.add(ws);
    
    // 사용자 세션 추가
    const sessionId = this.generateSessionId();
    this.userSessions.set(sessionId, {
      ws,
      user,
      documentId,
      joinedAt: new Date()
    });
    
    // 다른 사용자들에게 참여 알림
    this.broadcastToRoom(documentId, {
      type: 'user-joined',
      user: {
        id: user._id,
        name: user.displayName,
        avatar: user.avatar
      }
    }, ws);
  }
  
  leaveRoom(documentId: string, ws: WebSocket): void {
    const room = this.rooms.get(documentId);
    if (room) {
      room.delete(ws);
      
      // 사용자 세션 제거
      const session = Array.from(this.userSessions.entries())
        .find(([_, s]) => s.ws === ws)?.[1];
      
      if (session) {
        this.broadcastToRoom(documentId, {
          type: 'user-left',
          userId: session.user._id
        }, ws);
      }
    }
  }
  
  handleCursorUpdate(documentId: string, ws: WebSocket, cursor: CursorPosition): void {
    this.broadcastToRoom(documentId, {
      type: 'cursor-update',
      cursor
    }, ws);
  }
}
```

## 5. 실시간 저장 메커니즘

### 5.1 자동 저장 시스템
```typescript
// services/auto-save.service.ts
export class AutoSaveService {
  private saveQueues: Map<string, NodeJS.Timeout> = new Map();
  private yjsService: YjsService;
  
  constructor() {
    this.yjsService = new YjsService();
  }
  
  scheduleAutoSave(documentId: string, ydoc: Y.Doc, delayMs: number = 5000): void {
    // 기존 저장 스케줄 취소
    const existingTimeout = this.saveQueues.get(documentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // 새로운 저장 스케줄
    const timeout = setTimeout(async () => {
      try {
        await this.yjsService.saveDocument(documentId, ydoc);
        console.log(`Auto-saved document: ${documentId}`);
        
        // 클라이언트에게 저장 완료 알림
        this.notifyAutoSaveComplete(documentId);
        
      } catch (error) {
        console.error(`Auto-save failed for ${documentId}:`, error);
        this.notifyAutoSaveError(documentId, error);
      } finally {
        this.saveQueues.delete(documentId);
      }
    }, delayMs);
    
    this.saveQueues.set(documentId, timeout);
  }
  
  private notifyAutoSaveComplete(documentId: string): void {
    // WebSocket을 통해 저장 완료 알림
    const message = {
      type: 'auto-save-complete',
      documentId,
      timestamp: new Date().toISOString()
    };
    
    this.broadcastToDocument(documentId, message);
  }
}
```

### 5.2 변경 감지 및 저장 트리거
```typescript
// websocket/document-watcher.ts
export class DocumentWatcher {
  private documents: Map<string, Y.Doc> = new Map();
  private autoSaveService: AutoSaveService;
  
  constructor() {
    this.autoSaveService = new AutoSaveService();
  }
  
  watchDocument(documentId: string, ydoc: Y.Doc): void {
    this.documents.set(documentId, ydoc);
    
    // 모든 공유 타입에 대한 변경 감지
    const sharedTypes = [
      ydoc.getMap('elements'),
      ydoc.getXmlFragment('bpmn'),
      ydoc.getArray('comments')
    ];
    
    sharedTypes.forEach(sharedType => {
      sharedType.observe((event, transaction) => {
        // 로컬 변경인지 원격 변경인지 확인
        if (!transaction.local) {
          this.handleRemoteChange(documentId, event);
        }
        
        // 변경사항이 있으면 자동 저장 스케줄
        this.autoSaveService.scheduleAutoSave(documentId, ydoc);
      });
    });
  }
  
  private handleRemoteChange(documentId: string, event: Y.YEvent<any>): void {
    // 원격 변경사항 로깅
    console.log(`Remote change detected in ${documentId}:`, {
      path: event.path,
      changes: event.changes
    });
    
    // 실시간 알림 전송
    this.notifyChange(documentId, {
      type: 'document-changed',
      changes: event.changes,
      timestamp: new Date().toISOString()
    });
  }
}
```

## 6. 성능 최적화

### 6.1 MongoDB 최적화
```typescript
// config/mongodb.ts
export const mongoConfig = {
  // 연결 풀 설정
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  
  // 압축 설정
  compressors: ['zstd', 'zlib'],
  
  // 읽기 선호도
  readPreference: 'secondaryPreferred',
  
  // 쓰기 확인
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 5000
  }
};

// 집계 파이프라인 최적화
export class DocumentAggregationService {
  async getDocumentWithStats(documentId: string): Promise<any> {
    return await BpmnDocument.aggregate([
      { $match: { _id: new ObjectId(documentId) } },
      {
        $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'documentId',
          as: 'comments',
          pipeline: [
            { $match: { status: 'active' } },
            { $count: 'count' }
          ]
        }
      },
      {
        $lookup: {
          from: 'activitylogs',
          localField: '_id',
          foreignField: 'documentId',
          as: 'recentActivity',
          pipeline: [
            { $sort: { timestamp: -1 } },
            { $limit: 10 }
          ]
        }
      },
      {
        $addFields: {
          commentCount: { $arrayElemAt: ['$comments.count', 0] },
          lastActivity: { $arrayElemAt: ['$recentActivity.timestamp', 0] }
        }
      }
    ]);
  }
}
```

### 6.2 Redis 캐싱
```typescript
// services/cache.service.ts
import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }
  
  // 사용자 세션 캐싱
  async cacheUserSession(userId: string, sessionData: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(`session:${userId}`, ttl, JSON.stringify(sessionData));
  }
  
  // 문서 메타데이터 캐싱
  async cacheDocumentMeta(documentId: string, metadata: any): Promise<void> {
    await this.redis.hset(`doc:${documentId}:meta`, metadata);
    await this.redis.expire(`doc:${documentId}:meta`, 300); // 5분
  }
  
  // 프로젝트 권한 캐싱
  async cacheUserPermissions(userId: string, projectId: string, permissions: any): Promise<void> {
    const key = `perm:${userId}:${projectId}`;
    await this.redis.setex(key, 600, JSON.stringify(permissions)); // 10분
  }
}
```

## 7. 보안 구현

### 7.1 JWT 인증 미들웨어
```typescript
// middleware/auth.middleware.ts
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 7.2 권한 검증 미들웨어
```typescript
// middleware/permission.middleware.ts
export const checkProjectPermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { projectId } = req.params;
    const userId = req.user!._id;
    
    const permission = await Permission.findOne({ projectId, userId });
    
    if (!permission || !permission.permissions[requiredPermission]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

## 8. 배포 설정

### 8.1 Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    restart: always
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db
      
  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      
  backend:
    build: .
    restart: always
    ports:
      - "3001:3001"
      - "1234:1234"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://admin:password@mongodb:27017/bpmn_editor?authSource=admin
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret-key
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./logs:/app/logs

volumes:
  mongodb_data:
  redis_data:
```

### 8.2 환경 설정
```typescript
// config/environment.ts
export const config = {
  port: process.env.PORT || 3001,
  wsPort: process.env.WS_PORT || 1234,
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bpmn_editor',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret',
    expiresIn: '24h'
  },
  
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
};
```

이 백엔드 설계는 MongoDB를 중심으로 한 확장 가능하고 안전한 BPMN 동시편집 서비스를 구현합니다.