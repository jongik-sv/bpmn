# BPMN 프로젝트 코드 분석 리포트

## 🔍 분석 개요

이 문서는 `/src` 폴더 하위의 모든 코드를 분석하여 각 컴포넌트의 역할을 정리하고, 역할의 중복이나 불일치를 식별한 결과입니다.

---

## 📁 디렉토리 구조별 역할 분석

### 1. `/src/app/` - 애플리케이션 메인 관리

#### **AppManager.js** 
- **역할**: 전체 애플리케이션의 오케스트레이터
- **주요 기능**: 
  - 페이지 라우팅 (landing → dashboard → editor)
  - 사용자 인증 상태 관리
  - 프로젝트 데이터 로딩 및 관리
  - BPMN 에디터 초기화
  - VS Code Layout 관리
- **문제점**: 너무 많은 책임을 가지고 있음 (God Object 패턴)

#### **managers/AuthStateManager.js**
- **역할**: 사용자 인증 상태 전담 관리
- **주요 기능**: 로그인/로그아웃, 인증 상태 변경 감지
- **상태**: ✅ 역할이 명확하고 적절함

#### **managers/FileTreeManager.js**
- **역할**: 파일 트리 구조 관리
- **주요 기능**: 트리 노드 생성, 정렬, 검색, 업데이트
- **상태**: ✅ 역할이 명확함

#### **managers/PageManager.js**
- **역할**: 페이지 전환 및 라우팅 관리
- **주요 기능**: 페이지 표시/숨김, 브레드크럼 관리
- **상태**: ✅ 역할이 명확함

#### **managers/ProjectStateManager.js**
- **역할**: 프로젝트 상태 및 데이터 관리
- **주요 기능**: 프로젝트 CRUD, 데이터 로딩, 상태 동기화
- **⚠️ 문제점**: **데이터베이스 직접 접근** - 비즈니스 로직과 데이터 접근이 혼재

---

### 2. `/src/components/` - UI 컴포넌트

#### **A. 메인 컴포넌트**

##### **Explorer.js**
- **역할**: VS Code 스타일 파일 탐색기 통합
- **주요 기능**: 5개 전문 모듈 조합 (Core, EventHandler, Search, Actions, Accessibility)
- **상태**: ✅ 잘 모듈화됨

##### **VSCodeLayout.js**
- **역할**: VS Code 스타일 전체 레이아웃 관리
- **주요 기능**: 4개 전문 모듈 조합 (LayoutManager, EventHandler, ViewManager, BpmnIntegration)
- **상태**: ✅ 잘 모듈화됨

#### **B. 기능별 컴포넌트**

##### **features/auth/** - 인증 관련
- **AuthHandler.js**: 실제 인증 API 호출 및 에러 처리
- **AuthModalCore.js**: 인증 모달 UI 관리
- **SupabaseLoginModal.js**: 인증 컴포넌트 통합 오케스트레이터
- **상태**: ✅ 역할 분리가 잘 됨

##### **features/bpmn-editor/** - BPMN 에디터
- **BpmnEditorCore.js**: 순수 BPMN 편집 기능
- **BpmnCollaborationHandler.js**: 실시간 협업 기능
- **BpmnAutoSave.js**: 자동 저장 기능
- **BpmnUIIntegration.js**: UI 통합 및 헤더 관리
- **상태**: ✅ 책임이 명확하게 분리됨

##### **features/project-manager/** - 프로젝트 관리
- **ProjectManagerCore.js**: 프로젝트 관리 핵심 로직
- **ProjectManager.js**: 프로젝트 관리 통합
- **⚠️ 문제점**: **데이터베이스 직접 접근** 포함

#### **C. UI 레이아웃 컴포넌트**

##### **ui/layout/activity-bar/**
- **ActivityBarCore.js**: 액티비티 바 핵심 UI
- **ActivityBarEventHandler.js**: 이벤트 처리
- **ActivityBar.js**: 통합 컴포넌트
- **상태**: ✅ 잘 모듈화됨

##### **ui/layout/explorer/**
- **ExplorerCore.js**: 탐색기 핵심 UI
- **ExplorerEventHandler.js**: 이벤트 처리
- **ExplorerActions.js**: 액션 처리 (생성, 삭제, 이름변경 등)
- **ExplorerSearch.js**: 검색 기능
- **ExplorerAccessibility.js**: 접근성 지원
- **⚠️ 문제점**: **ExplorerActions.js에서 데이터베이스 직접 접근**

##### **ui/interactions/tree-data/**
- **TreeDataProvider.js**: 트리 데이터 구조 관리
- **상태**: ✅ 데이터 구조 관리에만 집중

#### **D. 모달 컴포넌트**

##### **modals/**
- **ProjectMembersModal.js**: 프로젝트 멤버 관리 모달
- **SupabaseLoginModal.js**: 인증 모달 래퍼
- **⚠️ 문제점**: **ProjectMembersModal.js에서 데이터베이스 직접 접근**

---

### 3. `/src/lib/` - 라이브러리 및 유틸리티

#### **database/** - 데이터베이스 관련
- **DatabaseManager.js**: 전체 데이터베이스 작업 오케스트레이터
- **ConnectionManager.js**: 연결 관리 (Supabase ↔ Local Storage)
- **ProjectRepository.js**: 프로젝트 데이터 전담
- **DiagramRepository.js**: 다이어그램 데이터 전담  
- **FolderRepository.js**: 폴더 데이터 전담
- **상태**: ✅ Repository 패턴으로 잘 분리됨

#### **기타 라이브러리**
- **supabase.js**: Supabase 클라이언트 설정
- **rbac.js**: 역할 기반 접근 제어
- **collaboration.js**: 협업 관련 유틸리티
- **상태**: ✅ 각자 명확한 역할

---

### 4. `/src/editor/` - 레거시 에디터

#### **BpmnEditor.js**
- **역할**: 기존 BPMN 에디터 (레거시)
- **⚠️ 문제점**: **features/bpmn-editor/**와 역할 중복

---

### 5. `/src/collaboration/` - 협업 기능

#### **CollaborationManager.js & BpmnCollaborationModule.js**
- **역할**: 실시간 협업 관리
- **상태**: ✅ 협업 기능에만 집중

---

## ⚠️ 주요 문제점 및 개선사항

### 1. **데이터베이스 직접 접근 문제**

다음 컴포넌트들이 본래 역할과 맞지 않게 데이터베이스에 직접 접근하고 있습니다:

#### **문제 컴포넌트들:**
- **ExplorerActions.js** (Line 135-189)
  ```javascript
  // UI 액션 컴포넌트가 직접 DB 접근
  const { dbManager } = await import('../../../../lib/database.js');
  const result = await dbManager.createDiagram(diagramData);
  ```

- **ProjectMembersModal.js** (Line 2-3)
  ```javascript
  // 모달 컴포넌트가 직접 DB 접근
  import { dbManager } from '../../lib/database.js';
  import { rbacManager } from '../../lib/rbac.js';
  ```

- **ProjectStateManager.js** (전체)
  ```javascript
  // 상태 관리자가 직접 DB 접근 (이건 적절할 수 있음)
  const { data, error } = await dbManager.getUserProjects(this.currentUser.id);
  ```

#### **개선 방안:**
1. **Service Layer 도입**: UI 컴포넌트와 데이터베이스 사이에 서비스 계층 추가
2. **Event-Driven Architecture**: 컴포넌트 간 이벤트로 통신
3. **Command Pattern**: 액션을 명령 객체로 분리

### 2. **역할 중복 문제**

#### **BPMN 에디터 중복:**
- `/src/editor/BpmnEditor.js` (레거시)
- `/src/components/features/bpmn-editor/` (신규 모듈형)

**해결방안**: 레거시 에디터 제거 또는 래퍼로 변경

### 3. **책임 과다 문제**

#### **AppManager.js**
현재 너무 많은 책임을 가지고 있습니다:
- 페이지 라우팅
- 사용자 인증
- 프로젝트 관리
- 에디터 초기화
- 레이아웃 관리

**개선방안**: 
- Router 클래스 분리
- Application 클래스와 Controller 클래스 분리

### 4. **파일 시스템 접근 문제**

온라인 전용으로 전환하면서 다음 기능들이 불필요해졌습니다:
- ✅ **해결됨**: BpmnEditorCore.js의 파일 드래그앤드롭 제거
- ✅ **해결됨**: BpmnUIIntegration.js의 파일 열기 제거

---

## 📊 개선 우선순위

### **High Priority (즉시 수정 필요)**
1. ✅ **파일 시스템 접근 제거** - 완료
2. ✅ **탐색기 데이터 로딩 문제 해결** - 완료
3. **데이터베이스 직접 접근 분리** - 진행 필요

### **Medium Priority (단계적 개선)**
4. **레거시 에디터 정리**
5. **AppManager 책임 분리**
6. **Service Layer 도입**

### **Low Priority (장기 과제)**
7. **Event-Driven Architecture 도입**
8. **Command Pattern 적용**
9. **테스트 코드 추가**

---

## 🎯 권장 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Components │    │  Service Layer  │    │  Data Layer     │
│                 │    │                 │    │                 │
│ • Explorer      │────│ • ProjectSvc    │────│ • Repositories  │
│ • Modals        │    │ • DiagramSvc    │    │ • DatabaseMgr   │
│ • Editors       │    │ • AuthSvc       │    │ • Supabase      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

이렇게 개선하면 각 계층의 책임이 명확해지고 유지보수성이 크게 향상될 것입니다.