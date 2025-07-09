# 프로젝트 구조 가이드

## 📋 개요
BPMN 협업 에디터의 소스 코드 구조와 각 폴더/파일의 책임과 역할을 정리한 가이드입니다.

## 🗂️ 디렉토리 구조

```
src/
├── app/                    # 애플리케이션 레벨 매니저
├── assets/                 # 정적 자산
├── collaboration/          # 실시간 협업 관련
├── components/             # UI 컴포넌트 (모듈화 완료)
├── editor/                 # BPMN 에디터 관련
├── lib/                    # 라이브러리 및 유틸리티
├── styles/                 # 스타일시트
├── index.js                # 메인 진입점
└── index.html              # HTML 템플릿
```

## 📁 폴더별 상세 설명

### 🏗️ /app - 애플리케이션 관리자
**책임**: 애플리케이션의 전체적인 상태 및 페이지 관리

```
app/
├── AppManager.js           # 레거시 애플리케이션 매니저
├── AppManagerNew.js        # 모듈화된 애플리케이션 매니저
└── managers/               # 전문화된 관리자 모듈
    ├── AuthStateManager.js     # 인증 상태 관리
    ├── FileTreeManager.js      # 파일 트리 관리
    ├── PageManager.js          # 페이지 전환 관리
    └── ProjectStateManager.js  # 프로젝트 상태 관리
```

**역할**:
- 애플리케이션 전체 생명주기 관리
- 페이지 간 전환 로직
- 전역 상태 관리 (인증, 프로젝트 상태 등)
- 모듈 간 조율 및 통신

### 🎨 /components - UI 컴포넌트 (계층 구조 완료)
**책임**: 재사용 가능한 UI 컴포넌트 제공

```
components/
├── ui/                    # UI 컴포넌트
│   ├── layout/           # 레이아웃 컴포넌트
│   │   ├── vscode-layout/    # VS Code 메인 레이아웃
│   │   ├── activity-bar/     # 활동 바
│   │   ├── explorer/         # 파일 탐색기
│   │   └── editor-header/    # 에디터 헤더
│   └── interactions/     # UI 인터랙션
│       ├── context-menu/     # 컨텍스트 메뉴
│       ├── drag-drop/        # 드래그 앤 드롭
│       └── tree-data/        # 트리 데이터 관리
├── features/             # 기능별 컴포넌트
│   ├── bpmn-editor/          # BPMN 에디터
│   ├── project-manager/      # 프로젝트 관리자
│   └── auth/                 # 인증 관련
├── common/               # 공통 유틸리티
│   └── accessibility/        # 접근성 관리
├── modals/               # 모달 컴포넌트
│   ├── ProjectMembersModal.js
│   └── SupabaseLoginModal.js
├── ExplorerNew.js        # 통합 Explorer 클래스
├── VSCodeLayoutNew.js    # 통합 VSCode Layout 클래스
├── index.js              # 전체 컴포넌트 export
└── MIGRATION_GUIDE.md    # 마이그레이션 가이드
```

**모듈 패턴**:
- `Core.js`: 핵심 렌더링 및 상태 관리 로직
- `EventHandler.js`: 이벤트 처리 로직
- `New.js`: 통합 클래스 (Core + EventHandler)
- `index.js`: 모듈 전체 export

### 🔧 /lib - 라이브러리 및 유틸리티
**책임**: 공통 기능 및 외부 서비스 연동

```
lib/
├── database/              # 데이터베이스 관련 (모듈화 완료)
│   ├── ConnectionManager.js    # 연결 관리
│   ├── DatabaseManagerNew.js   # 통합 데이터베이스 매니저
│   ├── DiagramRepository.js    # 다이어그램 CRUD
│   ├── FolderRepository.js     # 폴더 CRUD
│   └── ProjectRepository.js    # 프로젝트 CRUD
├── collaboration.js       # 협업 관련 유틸리티
├── database.js           # 레거시 데이터베이스 파일
├── rbac.js               # Role-Based Access Control
└── supabase.js           # Supabase 클라이언트 설정
```

**역할**:
- 데이터베이스 연동 및 CRUD 작업
- 외부 API 연동 (Supabase)
- 공통 유틸리티 함수
- 권한 관리 (RBAC)

### 🤝 /collaboration - 실시간 협업
**책임**: 실시간 다중 사용자 협업 기능

```
collaboration/
├── BpmnCollaborationModule.js  # BPMN 특화 협업 모듈
└── CollaborationManager.js     # 협업 관리자 (Yjs CRDT)
```

**역할**:
- Yjs CRDT를 통한 실시간 동기화
- 사용자 커서 및 선택 상태 관리
- 협업 이벤트 처리
- WebSocket 연결 관리

### ✏️ /editor - BPMN 에디터
**책임**: BPMN 다이어그램 편집 기능

```
editor/
└── BpmnEditor.js         # 레거시 BPMN 에디터
```

**역할**:
- bpmn-js 라이브러리 통합
- 다이어그램 편집 기능
- 속성 패널 관리
- 파일 가져오기/내보내기

### 🎨 /styles - 스타일시트
**책임**: 애플리케이션 스타일링

```
styles/
├── app.css               # 전체 애플리케이션 스타일
├── editor-header.css     # 에디터 헤더 스타일
├── login.css            # 로그인 관련 스타일
├── main.css             # 메인 스타일
├── project-manager.css  # 프로젝트 매니저 스타일
└── vscode-ui.css        # VS Code UI 스타일
```

### 📦 /assets - 정적 자산
**책임**: 정적 파일 및 템플릿 관리

```
assets/
└── newDiagram.bpmn      # 새 다이어그램 템플릿
```

## 📋 개발 규칙 및 가이드라인

### 🔄 모듈화 패턴
새로운 컴포넌트 개발 시 다음 패턴을 따르세요:

1. **Core 모듈**: 핵심 로직과 렌더링
2. **EventHandler 모듈**: 이벤트 처리
3. **통합 클래스**: Core + EventHandler 조합
4. **index.js**: 모듈 전체 export

### 📂 파일 구조 규칙

```javascript
// 새 모듈 생성 시
components/
└── new-component/
    ├── NewComponentCore.js        # 핵심 기능
    ├── NewComponentEventHandler.js # 이벤트 처리
    ├── NewComponentNew.js         # 통합 클래스
    └── index.js                   # Export 관리
```

### 🔗 import/export 규칙

```javascript
// 모듈 내부 export (index.js)
export { NewComponentCore } from './NewComponentCore.js';
export { NewComponentEventHandler } from './NewComponentEventHandler.js';
export { NewComponent } from './NewComponentNew.js';

// 외부에서 사용 시
import { NewComponent } from './components/new-component/index.js';
```

### 🎯 책임 분리 원칙

1. **Single Responsibility**: 각 모듈은 하나의 책임만 가짐
2. **Separation of Concerns**: 렌더링과 이벤트 처리 분리
3. **Loose Coupling**: EventEmitter를 통한 모듈 간 통신
4. **High Cohesion**: 관련 기능들을 모듈로 묶음

### 🔄 이벤트 통신 패턴

```javascript
// EventEmitter 기반 통신
class ComponentNew extends EventEmitter {
    constructor() {
        super();
        this.core = new ComponentCore();
        this.eventHandler = new ComponentEventHandler();
        
        // 모듈 간 이벤트 연결
        this.eventHandler.on('action', (data) => {
            this.emit('action', data);
        });
    }
}
```

## 📊 마이그레이션 현황

### ✅ 완료된 계층 구조 모듈화

#### UI 레이아웃 컴포넌트
- **VSCodeLayout**: `ui/layout/vscode-layout/` 폴더
- **ActivityBar**: `ui/layout/activity-bar/` 폴더
- **Explorer**: `ui/layout/explorer/` 폴더
- **EditorHeader**: `ui/layout/editor-header/` 폴더

#### UI 인터랙션 컴포넌트
- **ContextMenu**: `ui/interactions/context-menu/` 폴더
- **DragDropController**: `ui/interactions/drag-drop/` 폴더
- **TreeDataProvider**: `ui/interactions/tree-data/` 폴더

#### 기능별 컴포넌트
- **BpmnEditor**: `features/bpmn-editor/` 폴더
- **ProjectManager**: `features/project-manager/` 폴더
- **Auth**: `features/auth/` 폴더

#### 공통 유틸리티
- **AccessibilityManager**: `common/accessibility/` 폴더

#### 모달 컴포넌트
- **ProjectMembersModal**: `modals/ProjectMembersModal.js`
- **SupabaseLoginModal**: `modals/SupabaseLoginModal.js`

#### 기타 모듈화
- **Database**: `lib/database/` 폴더
- **AppManager**: `app/managers/` 폴더

### 📋 통합 클래스 파일들
```
components/
├── ExplorerNew.js              # → ui/layout/explorer/ 모듈들을 통합
└── VSCodeLayoutNew.js          # → ui/layout/vscode-layout/ 모듈들을 통합
```

## 🚀 향후 개발 방향

### 1. 추가 최적화
- 통합 클래스들의 성능 최적화
- 공통 유틸리티 함수 분리
- 컴포넌트 간 의존성 최소화

### 2. 성능 최적화
- 레이지 로딩 구현
- 번들 크기 최적화
- 메모리 사용량 최적화

### 3. 타입 안정성
- JSDoc 문서화 강화
- TypeScript 마이그레이션 검토

### 4. 테스트 강화
- 단위 테스트 작성
- 통합 테스트 구현
- E2E 테스트 추가

## 📝 개발 시 주의사항

### 🚫 금지사항
1. 순환 참조 생성 금지
2. 직접적인 DOM 조작 최소화
3. 전역 변수 사용 금지
4. 하드코딩된 값 사용 금지

### ✅ 권장사항
1. EventEmitter를 통한 모듈 간 통신
2. 상수는 별도 파일로 관리
3. 에러 처리 및 로깅 강화
4. 성능 고려한 코드 작성

---

*문서 생성일: 2025년 7월 8일*
*마지막 업데이트: 계층 구조 재정리 완료 후*