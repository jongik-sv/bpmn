# BPMN Collaborative Editor - Backend

실시간 협업이 가능한 BPMN 에디터의 백엔드 서버입니다.

## 기술 스택

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 6.0+
- **ODM**: Mongoose
- **Authentication**: JWT
- **Real-time**: WebSocket + Yjs
- **Language**: TypeScript

## 주요 기능

- 사용자 인증 및 관리
- 프로젝트 및 문서 CRUD
- 실시간 협업 (Yjs)
- 문서 공유 및 권한 관리
- 버전 관리 및 스냅샷
- 댓글 시스템
- 활동 로그

## 설치 및 실행

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 실제 값으로 수정
```

### 2. 환경 변수

```env
# Server Configuration
PORT=3001
WS_PORT=1234
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/bpmn_editor
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

### 3. 데이터베이스 설정

MongoDB와 Redis가 실행 중이어야 합니다:

```bash
# MongoDB 실행 (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:6.0

# Redis 실행 (Docker)
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 4. 개발 서버 실행

```bash
# 개발 모드 (TypeScript 파일 직접 실행)
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## API 엔드포인트

### 인증 (Authentication)
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/profile` - 프로필 조회
- `PUT /api/auth/profile` - 프로필 수정
- `POST /api/auth/change-password` - 비밀번호 변경

### 프로젝트 (Projects)
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects/:id` - 프로젝트 상세
- `PUT /api/projects/:id` - 프로젝트 수정
- `DELETE /api/projects/:id` - 프로젝트 삭제
- `GET /api/projects/:id/members` - 멤버 목록
- `POST /api/projects/:id/share` - 프로젝트 공유

### 문서 (Documents)
- `GET /api/documents/project/:projectId` - 프로젝트 문서 목록
- `POST /api/documents/project/:projectId` - 문서 생성
- `GET /api/documents/:id` - 문서 조회
- `PUT /api/documents/:id` - 문서 수정
- `DELETE /api/documents/:id` - 문서 삭제
- `GET /api/documents/:id/export` - 문서 내보내기

### 문서 공유 (Document Sharing)
- `POST /api/documents/:id/share` - 공유 링크 생성
- `GET /api/documents/:id/share` - 공유 설정 조회
- `PUT /api/documents/:id/share/:shareId` - 공유 설정 수정
- `DELETE /api/documents/:id/share/:shareId` - 공유 중단
- `POST /api/share/:shareToken/access` - 공유 문서 접근

## 데이터 모델

### User (사용자)
```typescript
{
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  provider: 'local' | 'google' | 'github';
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
  };
}
```

### Project (프로젝트)
```typescript
{
  name: string;
  description?: string;
  ownerId: ObjectId;
  visibility: 'private' | 'public' | 'team';
  settings: {
    allowComments: boolean;
    allowExport: boolean;
    autoSave: boolean;
    autoSaveInterval: number;
  };
  tags: string[];
}
```

### Document (문서)
```typescript
{
  projectId: ObjectId;
  name: string;
  bpmnXml: string;
  yjsState: Buffer;
  yjsStateVector: Buffer;
  metadata: {
    elementCount: number;
    lastModifiedBy: ObjectId;
    version: number;
    fileSize: number;
  };
  snapshots: Array<{
    id: string;
    name: string;
    yjsState: Buffer;
    createdBy: ObjectId;
    createdAt: Date;
  }>;
}
```

## 개발 도구

### 린팅
```bash
npm run lint
npm run lint:fix
```

### 테스트
```bash
npm test
npm run test:watch
```

### TypeScript 빌드
```bash
npm run build
```

## 보안

- JWT 토큰 기반 인증
- bcrypt를 사용한 비밀번호 해싱
- Helmet.js를 사용한 보안 헤더
- Rate limiting으로 API 남용 방지
- CORS 설정
- 입력값 검증 (Joi)

## 성능 최적화

- MongoDB 인덱스 최적화
- Redis 캐싱
- 압축 미들웨어
- 요청 크기 제한
- Connection pooling

## 로깅

모든 중요한 이벤트는 로그로 기록됩니다:
- 사용자 인증 이벤트
- API 요청/응답
- 에러 및 예외
- 비즈니스 로직 실행

## 배포

Docker를 사용한 배포를 권장합니다:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## 기여

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request