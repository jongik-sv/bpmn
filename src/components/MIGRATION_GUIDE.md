# 모듈화 마이그레이션 가이드

## 개요
기존 단일 파일 컴포넌트들을 모듈화하여 관심사 분리, 재사용성, 유지보수성을 향상시켰습니다.

## 모듈화된 컴포넌트들

### 1. ActivityBar
- **기존**: `ActivityBar.js`
- **새로운**: `activity-bar/` 폴더
  - `ActivityBarCore.js` - 렌더링 및 상태 관리
  - `ActivityBarEventHandler.js` - 이벤트 처리
  - `ActivityBarNew.js` - 통합 클래스

### 2. ContextMenu
- **기존**: `ContextMenu.js`
- **새로운**: `context-menu/` 폴더
  - `ContextMenuCore.js` - 메뉴 생성 및 렌더링
  - `ContextMenuEventHandler.js` - 이벤트 처리
  - `ContextMenuNew.js` - 통합 클래스

### 3. DragDropController
- **기존**: `DragDropController.js`
- **새로운**: `drag-drop/` 폴더
  - `DragDropCore.js` - 핵심 드래그 앤 드롭 로직
  - `DragDropEventHandler.js` - DOM 이벤트 처리
  - `DragDropControllerNew.js` - 통합 클래스

### 4. EditorHeader
- **기존**: `EditorHeader.js`
- **새로운**: `editor-header/` 폴더
  - `EditorHeaderCore.js` - 헤더 렌더링 및 상태 관리
  - `EditorHeaderEventHandler.js` - 이벤트 처리
  - `EditorHeaderNew.js` - 통합 클래스

### 5. ProjectManager
- **기존**: `ProjectManager.js`
- **새로운**: `project-manager/` 폴더
  - `ProjectManagerCore.js` - 프로젝트 관리 로직
  - `ProjectManagerNew.js` - 통합 클래스

### 6. TreeDataProvider
- **기존**: `TreeDataProvider.js`
- **새로운**: `tree-data/` 폴더
  - `TreeDataProvider.js` - 개선된 트리 데이터 제공자

### 7. AccessibilityManager
- **기존**: `AccessibilityManager.js`
- **새로운**: `accessibility/` 폴더
  - `AccessibilityCore.js` - 접근성 핵심 기능
  - `AccessibilityManagerNew.js` - 통합 클래스

## 사용 방법

### 새로운 모듈 사용
```javascript
// 전체 모듈 import
import { ActivityBar } from './components/activity-bar/index.js';

// 또는 개별 모듈 import
import { ActivityBarCore } from './components/activity-bar/ActivityBarCore.js';
import { ActivityBarEventHandler } from './components/activity-bar/ActivityBarEventHandler.js';

// 사용
const activityBar = new ActivityBar(container);
```

### 기존 코드와의 호환성
```javascript
// 기존 방식도 계속 작동
import ActivityBar from './components/ActivityBar.js';
const activityBar = new ActivityBar(container);

// 새로운 방식
import { ActivityBar } from './components/activity-bar/index.js';
const activityBar = new ActivityBar(container);
```

## 마이그레이션 단계

### 1단계: 점진적 마이그레이션
- 기존 코드는 그대로 유지
- 새로운 기능 개발 시 모듈화된 컴포넌트 사용

### 2단계: 레거시 코드 업데이트
- 기존 import 구문을 새로운 모듈 경로로 변경
- 기존 API는 하위 호환성 유지

### 3단계: 레거시 파일 제거
- 충분한 테스트 후 기존 파일들 제거
- 완전히 모듈화된 구조로 전환

## 장점

### 1. 관심사 분리
- 렌더링 로직과 이벤트 처리 로직 분리
- 각 모듈이 단일 책임을 가짐

### 2. 재사용성
- 개별 모듈을 독립적으로 사용 가능
- 다른 프로젝트에서도 재사용 가능

### 3. 유지보수성
- 작은 파일 크기로 코드 이해 용이
- 버그 수정 시 영향 범위 최소화

### 4. 테스트 용이성
- 개별 모듈을 독립적으로 테스트 가능
- 모킹(Mocking) 용이

### 5. 확장성
- 새로운 기능 추가 시 기존 코드 영향 최소화
- 플러그인 형태로 기능 확장 가능

## 주의사항

### 1. 순환 참조 방지
- 모듈 간 순환 참조를 피하도록 설계
- 의존성 방향을 명확히 정의

### 2. 이벤트 관리
- 모듈 간 통신을 위한 이벤트 시스템 활용
- 메모리 누수 방지를 위한 적절한 정리

### 3. 하위 호환성
- 기존 API 유지로 점진적 마이그레이션 지원
- deprecated 경고를 통한 사용자 안내

## 향후 계획

### 1. 추가 모듈화
- 남은 컴포넌트들의 모듈화
- 공통 유틸리티 모듈 분리

### 2. 타입스크립트 지원
- 모듈별 타입 정의 추가
- 타입 안정성 향상

### 3. 문서화
- 각 모듈별 상세 API 문서 작성
- 사용 예제 및 가이드 제공

### 4. 성능 최적화
- 레이지 로딩 지원
- 번들 크기 최적화