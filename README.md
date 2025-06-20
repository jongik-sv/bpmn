# BPMN Collaborative Editor

실시간 협업이 가능한 BPMN(Business Process Model and Notation) 에디터입니다.

## 🚀 주요 기능

- **실시간 협업**: 여러 사용자가 동시에 BPMN 다이어그램 편집
- **문서 공유**: 링크 공유 및 권한 기반 접근 제어
- **버전 관리**: 스냅샷 생성 및 이전 버전 복원
- **댓글 시스템**: 요소별 댓글 및 멘션 기능
- **사용자 관리**: JWT 기반 인증 및 프로젝트 멤버 관리
- **BPMN 2.0 지원**: 표준 BPMN 요소 및 내보내기

## 🏗 기술 스택

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js + TypeScript
- **Database**: MongoDB 6.0+ with Mongoose
- **Real-time**: WebSocket + Yjs CRDT
- **Authentication**: JWT + bcryptjs
- **Cache**: Redis

### Frontend
- **Framework**: Next.js 14 + React 18
- **UI Library**: Material-UI (MUI)
- **Language**: TypeScript
- **BPMN Engine**: bpmn-js
- **Real-time**: Yjs + y-websocket
- **HTTP Client**: Axios
- **State Management**: Zustand

## 📁 프로젝트 구조

```
bpmn-collaborative-editor/
├── backend/                 # Node.js 백엔드 서버
│   ├── src/
│   │   ├── controllers/     # API 컨트롤러
│   │   ├── models/         # MongoDB 모델
│   │   ├── routes/         # API 라우트
│   │   ├── services/       # 비즈니스 로직
│   │   ├── middleware/     # 미들웨어
│   │   ├── websocket/      # WebSocket 및 Yjs 서버
│   │   ├── config/         # 설정 파일
│   │   └── utils/          # 유틸리티
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Next.js 프론트엔드
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── pages/          # 페이지 컴포넌트
│   │   ├── services/       # API 서비스
│   │   ├── types/          # TypeScript 타입
│   │   ├── hooks/          # 커스텀 훅
│   │   └── utils/          # 유틸리티
│   ├── package.json
│   └── next.config.js
├── docs/                   # 설계 문서
└── README.md
```

## 🛠 설치 및 실행

### 사전 요구사항

- Node.js 18+
- MongoDB 6.0+
- Redis 7+
- Git

### 1. 저장소 클론

```bash
git clone https://github.com/YOUR_USERNAME/bpmn-collaborative-editor.git
cd bpmn-collaborative-editor
```

### 2. 백엔드 설정

```bash
cd backend

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 실제 값으로 수정

# 개발 서버 실행
npm run dev
```

### 3. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 실제 값으로 수정

# 개발 서버 실행
npm run dev
```

### 4. 데이터베이스 설정

MongoDB와 Redis가 실행 중이어야 합니다:

```bash
# Docker를 사용하는 경우
docker run -d -p 27017:27017 --name mongodb mongo:6.0
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 5. 접속

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001
- **WebSocket**: ws://localhost:1234

## 📖 API 문서

### 인증 API
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/profile` - 프로필 조회
- `PUT /api/auth/profile` - 프로필 수정

### 프로젝트 API
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects/:id` - 프로젝트 상세
- `PUT /api/projects/:id` - 프로젝트 수정
- `DELETE /api/projects/:id` - 프로젝트 삭제

### 문서 API
- `GET /api/documents/project/:projectId` - 프로젝트 문서 목록
- `POST /api/documents/project/:projectId` - 문서 생성
- `GET /api/documents/:id` - 문서 조회
- `PUT /api/documents/:id` - 문서 수정
- `DELETE /api/documents/:id` - 문서 삭제

### 공유 API
- `POST /api/documents/:id/share` - 공유 링크 생성
- `GET /api/documents/:id/share` - 공유 설정 조회
- `POST /api/share/:shareToken/access` - 공유 문서 접근

## 🔧 개발 도구

### 백엔드

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm start

# 린트
npm run lint
npm run lint:fix

# 테스트
npm test
```

### 프론트엔드

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm start

# 타입 체크
npm run type-check

# 린트
npm run lint
```

## 📋 환경 변수

### 백엔드 (.env)

```env
PORT=3001
WS_PORT=1234
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/bpmn_editor
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

FRONTEND_URL=http://localhost:3000
```

### 프론트엔드 (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=ws://localhost:1234
NEXT_PUBLIC_APP_NAME=BPMN Collaborative Editor
```

## 🚀 배포

### Docker를 사용한 배포

1. **Docker Compose 실행**:
```bash
docker-compose up -d
```

2. **개별 서비스 빌드**:
```bash
# 백엔드
cd backend
docker build -t bpmn-backend .

# 프론트엔드
cd frontend
docker build -t bpmn-frontend .
```

### 클라우드 배포

- **백엔드**: AWS EC2, Google Cloud Run, Heroku
- **프론트엔드**: Vercel, Netlify, AWS S3 + CloudFront
- **데이터베이스**: MongoDB Atlas, AWS DocumentDB
- **캐시**: Redis Cloud, AWS ElastiCache

## 📚 설계 문서

자세한 설계 내용은 docs 폴더의 문서들을 참고하세요:

- [요구사항 정의서](./BPMN_동시편집_에디터_요구사항정의서.md)
- [프론트엔드 설계문서](./BPMN_동시편집_에디터_설계문서.md)
- [백엔드 서비스 설계문서](./BPMN_Backend_서비스_설계문서.md)
- [문서 공유 기능 설계](./BPMN_문서공유_기능_설계.md)

## 🧪 테스트

### 단위 테스트

```bash
# 백엔드
cd backend
npm test

# 프론트엔드
cd frontend
npm test
```

### E2E 테스트

```bash
# Cypress 또는 Playwright를 사용한 E2E 테스트
npm run test:e2e
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 👥 작성자

- **BPMN Team** - 초기 작업 및 개발

## 🔗 관련 링크

- [BPMN 2.0 스펙](https://www.omg.org/spec/BPMN/2.0.2/)
- [bpmn-js 문서](https://bpmn.io/toolkit/bpmn-js/)
- [Yjs 문서](https://docs.yjs.dev/)
- [Next.js 문서](https://nextjs.org/docs)
- [Express.js 문서](https://expressjs.com/)

## 📞 지원

문제가 있거나 질문이 있으시면 [Issues](https://github.com/YOUR_USERNAME/bpmn-collaborative-editor/issues)에 등록해 주세요.

---

⭐ 이 프로젝트가 도움이 되었다면 Star를 눌러주세요!