# BpmnEditor.js & VSCodeLayout.js 상세 리팩토링 계획

## 📋 개요

**분석 대상**: 
- `src/editor/BpmnEditor.js` (1,275줄)
- `src/components/VSCodeLayout.js` (1,262줄)

**분석 일자**: 2025년 7월 8일  
**목표**: 대형 파일을 기능별로 분할하여 유지보수성과 테스트 가능성 향상

---

## 🔍 BpmnEditor.js 상세 분석 (1,275줄)

### 현재 상태 분석

**주요 문제점**:
- ✅ **하나의 파일에 너무 많은 책임**: BPMN 편집, 협업, 자동 저장, UI 통합 등
- ✅ **복잡한 상태 관리**: currentUser, currentProject, currentDiagram 등 여러 상태가 혼재
- ✅ **의존성 복잡성**: 거의 모든 모듈과 연결되어 있음
- ✅ **테스트 어려움**: 단위 테스트 작성이 복잡함

### 기능별 코드 분포

| 기능 영역 | 예상 라인 수 | 주요 메서드 |
|----------|-------------|------------|
| **BPMN 에디터 핵심** | ~350줄 | initializeModeler, openDiagram, exportDiagram |
| **협업 기능** | ~400줄 | initializeCollaboration, syncToCollaborationServer |
| **자동 저장** | ~200줄 | autoSaveDiagram, debouncedAutoSave, saveToLocalStorage |
| **UI 통합** | ~325줄 | updateBreadcrumb, showEditorHeader, updateCollaborationInfo |

### 📦 제안하는 분할 구조

#### 1. `BpmnEditorCore.js` (순수 편집 기능 - 350줄)

**책임**: BPMN 다이어그램의 핵심 편집 기능만 담당

```javascript
class BpmnEditorCore {
  constructor(containerSelector) {
    this.containerSelector = containerSelector;
    this.container = null;
    this.modeler = null;
    this.isInitialized = false;
  }

  // 포함 메서드:
  async initializeWhenReady()
  async setupContainer()
  async moveToContainer(newContainerSelector)
  initializeModeler(targetContainer = null)
  async openDiagram(diagramData)
  async createNewDiagram()
  async closeDiagram()
  async exportDiagram()
  isValidBpmnXml(xml)
  setupFileDrop()
  registerFileDrop(container, callback)
  exportArtifacts()
  setDownloadLink(selector, filename, data, mimeType)
  destroy()
}
```

**의존성**: 
- bpmn-js 라이브러리
- jQuery (최소한)
- newDiagramXML

**특징**:
- 협업, 자동 저장, UI 통합 로직 제거
- 순수한 BPMN 편집 기능만 제공
- 이벤트 에미터로 상태 변경 알림

#### 2. `BpmnCollaborationHandler.js` (협업 통합 - 400줄)

**책임**: 실시간 협업 기능 통합 관리

```javascript
class BpmnCollaborationHandler {
  constructor(bpmnEditorCore) {
    this.editorCore = bpmnEditorCore;
    this.collaborationModule = null;
    this.currentUser = null;
    this.currentProject = null;
  }

  // 포함 메서드:
  async setUser(user)
  async setProject(project)
  async changeCollaborationRoom(roomId)
  async initializeCollaboration(user)
  async syncToCollaborationServer()
  updateCollaborationStatus(connected)
  updateOnlineUsers(data)
  showCollaborationNotice()
  hideCollaborationNotice()
  getUserAvatar(user)
  disconnect()
}
```

**의존성**:
- BpmnEditorCore
- BpmnCollaborationModule
- CollaborationManager

**특징**:
- 에디터 핵심과 분리된 협업 로직
- 이벤트 기반 통신
- 독립적인 생명주기 관리

#### 3. `BpmnAutoSave.js` (자동 저장 관리 - 200줄)

**책임**: 자동 저장 및 데이터 영속성 관리

```javascript
class BpmnAutoSave {
  constructor(bpmnEditorCore) {
    this.editorCore = bpmnEditorCore;
    this.autoSaveTimeout = null;
    this.isSaving = false;
    this.lastSaveTime = 0;
    this.autoSaveDelay = 2000;
  }

  // 포함 메서드:
  async saveDiagram()
  debouncedAutoSave()
  async autoSaveDiagram()
  saveToLocalStorage(xml)
  showAutoSaveStatus(message)
  enableAutoSave()
  disableAutoSave()
  destroy()
}
```

**의존성**:
- BpmnEditorCore
- DatabaseManager
- 로컬 스토리지

**특징**:
- 디바운스 기반 자동 저장
- 로컬/서버 저장 전략 관리
- 저장 상태 사용자 피드백

#### 4. `BpmnUIIntegration.js` (UI 통합 - 325줄)

**책임**: 다른 UI 컴포넌트와의 통합 관리

```javascript
class BpmnUIIntegration {
  constructor(bpmnEditorCore) {
    this.editorCore = bpmnEditorCore;
    this.currentDiagram = null;
    this.currentProject = null;
  }

  // 포함 메서드:
  updateBreadcrumb()
  showEditorHeader()
  updateCollaborationInfo()
  updateConnectedUsersInHeader()
  updateEditorTitle()
  setupEventListeners()
  handleFileOperations()
}
```

**의존성**:
- BpmnEditorCore
- VSCodeLayout
- EditorHeader

**특징**:
- UI 상태 동기화
- 헤더 및 브레드크럼 관리
- 이벤트 리스너 설정

### 🔄 통합 클래스: `BpmnEditor.js` (새로운 구조)

```javascript
class BpmnEditor {
  constructor(containerSelector) {
    // 핵심 컴포넌트들 초기화
    this.core = new BpmnEditorCore(containerSelector);
    this.collaboration = new BpmnCollaborationHandler(this.core);
    this.autoSave = new BpmnAutoSave(this.core);
    this.uiIntegration = new BpmnUIIntegration(this.core);
    
    this.setupIntegration();
  }

  setupIntegration() {
    // 컴포넌트 간 이벤트 연결
    this.core.on('diagramChanged', () => {
      this.autoSave.debouncedAutoSave();
      this.collaboration.syncToCollaborationServer();
    });
    
    this.core.on('diagramLoaded', (diagram) => {
      this.uiIntegration.updateBreadcrumb();
      this.uiIntegration.updateEditorTitle();
    });
  }

  // 기존 공개 API 유지 (하위 호환성)
  async initializeWhenReady() {
    return this.core.initializeWhenReady();
  }

  async setUser(user) {
    return this.collaboration.setUser(user);
  }

  // ... 기타 델리게이션 메서드들
}
```

---

## 🔍 VSCodeLayout.js 상세 분석 (1,262줄)

### 현재 상태 분석

**주요 문제점**:
- ✅ **레이아웃 + 이벤트 + 비즈니스 로직이 혼재**: 너무 많은 책임
- ✅ **BPMN 특화 로직이 일반 레이아웃과 결합**: 재사용성 저하
- ✅ **복잡한 이벤트 처리**: 키보드, 마우스, 리사이즈 등이 하나의 클래스에 집중
- ✅ **파일 작업과 레이아웃이 혼재**: 관심사 분리 부족

### 기능별 코드 분포

| 기능 영역 | 예상 라인 수 | 주요 메서드 |
|----------|-------------|------------|
| **레이아웃 관리** | ~350줄 | createLayout, initializeComponents, setupComponentCallbacks |
| **이벤트 처리** | ~350줄 | setupEventListeners, handleGlobalKeydown, setupSidebarResize |
| **뷰 네비게이션** | ~200줄 | switchView, toggleSidebar, focus* 메서드들 |
| **BPMN 통합** | ~362줄 | integrateBPMNEditor, setupBPMNIntegration, openBPMNDiagram |

### 📦 제안하는 분할 구조

#### 1. `LayoutManager.js` (기본 레이아웃 - 350줄)

**책임**: VS Code 스타일 레이아웃의 기본 구조 관리

```javascript
class LayoutManager {
  constructor(container) {
    this.container = container;
    this.components = {};
    this.layoutState = {
      sidebarWidth: 240,
      isCollapsed: false,
      currentView: 'explorer'
    };
  }

  // 포함 메서드:
  init()
  createLayout()
  initializeComponents()
  setupComponentCallbacks()
  setupAccessibility()
  getActivityBar()
  getExplorer()
  getAccessibilityManager()
  saveLayoutState()
  loadLayoutState()
  destroy()
}
```

**의존성**:
- ActivityBar, Explorer, AccessibilityManager
- DragDropController, EditorHeader

**특징**:
- 순수한 레이아웃 구조 관리
- 컴포넌트 생명주기 관리
- 상태 영속성

#### 2. `EventHandler.js` (이벤트 처리 - 350줄)

**책임**: 모든 사용자 이벤트 처리

```javascript
class EventHandler {
  constructor(layoutManager) {
    this.layoutManager = layoutManager;
    this.shortcuts = new Map();
  }

  // 포함 메서드:
  setupEventListeners()
  handleGlobalKeydown(event)
  setupSidebarResize()
  setupViewShortcuts()
  handleWindowResize()
  getShortcutKey(event)
  registerShortcut(key, callback)
  destroy()
}
```

**의존성**:
- LayoutManager
- AccessibilityManager

**특징**:
- 중앙집중화된 이벤트 관리
- 키보드 단축키 시스템
- 반응형 레이아웃 처리

#### 3. `ViewManager.js` (뷰 네비게이션 - 200줄)

**책임**: 뷰 전환 및 포커스 관리

```javascript
class ViewManager {
  constructor(layoutManager) {
    this.layoutManager = layoutManager;
    this.currentView = 'explorer';
  }

  // 포함 메서드:
  switchView(viewId)
  toggleSidebar()
  focusActivityBar()
  focusSidebar()
  focusExplorer()
  focusEditor()
  getViewDisplayName(viewId)
  getCurrentView()
}
```

**의존성**:
- LayoutManager
- AccessibilityManager

**특징**:
- 뷰 상태 관리
- 포커스 흐름 제어
- 접근성 지원

#### 4. `BpmnIntegration.js` (BPMN 통합 - 362줄)

**책임**: BPMN 에디터와의 통합 로직

```javascript
class BpmnIntegration {
  constructor(layoutManager) {
    this.layoutManager = layoutManager;
    this.bpmnEditor = null;
  }

  // 포함 메서드:
  async integrateBPMNEditor(editorInstance)
  async setupBPMNIntegration()
  async createBPMNProjectStructure(dataProvider)
  setupBPMNFileAssociations()
  async openBPMNDiagram(item)
  async createFolderTreeItem(folder, allFolders, allDiagrams)
  async createDiagramTreeItem(diagram)
  showEditorHeader()
  hideEditorHeader()
  updateBreadcrumb(breadcrumbData)
  updateConnectedUsers(users)
  async createNewFolder()
  async createNewDiagram()
}
```

**의존성**:
- LayoutManager
- BpmnEditor
- TreeDataProvider
- AppManager

**특징**:
- BPMN 특화 기능 분리
- 파일 트리 동적 구성
- 에디터 헤더 관리

### 🔄 통합 클래스: `VSCodeLayout.js` (새로운 구조)

```javascript
class VSCodeLayout {
  constructor(container) {
    // 핵심 매니저들 초기화
    this.layoutManager = new LayoutManager(container);
    this.eventHandler = new EventHandler(this.layoutManager);
    this.viewManager = new ViewManager(this.layoutManager);
    this.bpmnIntegration = new BpmnIntegration(this.layoutManager);
    
    this.setupIntegration();
  }

  setupIntegration() {
    // 매니저 간 이벤트 연결
    this.eventHandler.registerShortcut('Ctrl+Shift+E', () => {
      this.viewManager.switchView('explorer');
    });
    
    // ... 기타 통합 로직
  }

  // 기존 공개 API 유지 (하위 호환성)
  switchView(viewId) {
    return this.viewManager.switchView(viewId);
  }

  async integrateBPMNEditor(editorInstance) {
    return this.bpmnIntegration.integrateBPMNEditor(editorInstance);
  }

  // ... 기타 델리게이션 메서드들
}
```

---

## 🚀 리팩토링 실행 계획

### Phase 1: BpmnEditor.js 분할 (1-2주)

**1.1 BpmnEditorCore 추출**
- [ ] 순수 편집 기능만 분리
- [ ] 이벤트 에미터 패턴 도입
- [ ] 단위 테스트 작성

**1.2 협업 핸들러 분리**
- [ ] BpmnCollaborationHandler 생성
- [ ] 협업 상태 관리 분리
- [ ] 연결 관리 로직 이전

**1.3 자동 저장 모듈 분리**
- [ ] BpmnAutoSave 클래스 생성
- [ ] 디바운스 로직 이전
- [ ] 저장 상태 관리 분리

**1.4 UI 통합 모듈 생성**
- [ ] BpmnUIIntegration 클래스 생성
- [ ] 헤더/브레드크럼 로직 이전
- [ ] 이벤트 리스너 관리 분리

### Phase 2: VSCodeLayout.js 분할 (1-2주)

**2.1 LayoutManager 추출**
- [ ] 기본 레이아웃 구조 분리
- [ ] 컴포넌트 관리 로직 이전
- [ ] 상태 영속성 기능 유지

**2.2 EventHandler 분리**
- [ ] 모든 이벤트 처리 로직 이전
- [ ] 키보드 단축키 시스템 구축
- [ ] 반응형 처리 로직 분리

**2.3 ViewManager 생성**
- [ ] 뷰 전환 로직 분리
- [ ] 포커스 관리 기능 이전
- [ ] 접근성 지원 유지

**2.4 BpmnIntegration 분리**
- [ ] BPMN 특화 로직 분리
- [ ] 파일 트리 구성 로직 이전
- [ ] 다이어그램 열기 기능 이전

### Phase 3: 통합 및 테스트 (1주)

**3.1 통합 클래스 구현**
- [ ] 기존 API 호환성 유지
- [ ] 컴포넌트 간 이벤트 연결
- [ ] 의존성 주입 패턴 적용

**3.2 테스트 작성**
- [ ] 각 분할된 모듈의 단위 테스트
- [ ] 통합 테스트 작성
- [ ] 기존 기능 회귀 테스트

**3.3 문서화**
- [ ] API 문서 업데이트
- [ ] 아키텍처 다이어그램 작성
- [ ] 마이그레이션 가이드 작성

---

## 📊 예상 효과

### 정량적 개선
- **파일 크기**: 평균 50% 감소 (1,200줄 → 600줄 이하)
- **복잡도**: 순환 복잡도 30% 감소
- **테스트 커버리지**: 80% 이상 달성 가능
- **빌드 시간**: 코드 스플리팅으로 20% 단축

### 정성적 개선
- **유지보수성**: 단일 책임 원칙으로 버그 수정 용이
- **확장성**: 새로운 기능 추가 시 영향 범위 최소화
- **재사용성**: 개별 모듈의 다른 프로젝트 활용 가능
- **팀 협업**: 모듈별 병렬 개발 가능

### 아키텍처 개선
- **결합도 감소**: 각 모듈이 명확한 인터페이스로 소통
- **응집도 증가**: 관련 기능들이 한 모듈에 집중
- **의존성 명확화**: 각 모듈의 의존성이 명시적
- **테스트 용이성**: 모킹과 스텁 활용한 격리 테스트

---

## ⚠️ 리팩토링 시 주의사항

### 기술적 고려사항
1. **하위 호환성**: 기존 API 인터페이스 유지 필수
2. **이벤트 순서**: 기존 이벤트 처리 순서 보장
3. **상태 동기화**: 분할된 모듈 간 상태 일관성 유지
4. **메모리 누수**: 이벤트 리스너 정리 로직 강화

### 프로젝트 관리 고려사항
1. **점진적 적용**: 한 번에 모든 것을 바꾸지 말고 단계적 적용
2. **테스트 우선**: 리팩토링 전 기존 기능의 테스트 케이스 확보
3. **백업 유지**: 기존 코드의 백업 브랜치 유지
4. **팀 커뮤니케이션**: 변경사항에 대한 팀 내 충분한 공유

### 성능 고려사항
1. **모듈 로딩**: 동적 import로 필요 시점에 로딩
2. **이벤트 오버헤드**: 과도한 이벤트 발생 방지
3. **메모리 사용량**: 분할로 인한 메모리 사용량 증가 모니터링
4. **초기화 시간**: 여러 모듈 초기화로 인한 지연 최소화

---

## 🎯 성공 지표

### 코드 품질 지표
- [ ] 파일당 평균 라인 수 500줄 이하
- [ ] 함수당 평균 라인 수 20줄 이하
- [ ] 순환 복잡도 10 이하
- [ ] 테스트 커버리지 80% 이상

### 성능 지표
- [ ] 초기 로딩 시간 20% 단축
- [ ] 번들 크기 15% 감소
- [ ] 메모리 사용량 변화 ±5% 이내
- [ ] 런타임 성능 변화 없음

### 개발 효율성 지표
- [ ] 새 기능 개발 시간 30% 단축
- [ ] 버그 수정 시간 40% 단축
- [ ] 코드 리뷰 시간 25% 단축
- [ ] 신규 개발자 온보딩 시간 50% 단축

---

## 📝 결론

두 대형 파일 **BpmnEditor.js**와 **VSCodeLayout.js**는 현재 기능적으로는 잘 작동하지만, **단일 책임 원칙 위반**과 **높은 복잡도**로 인해 유지보수에 어려움이 있습니다.

**제안된 리팩토링 계획**:
1. **BpmnEditor.js** → 4개 모듈로 분할
2. **VSCodeLayout.js** → 4개 모듈로 분할
3. **점진적 리팩토링**으로 안정성 확보
4. **하위 호환성 유지**로 기존 코드 보호

이러한 리팩토링을 통해 **코드 품질**, **유지보수성**, **테스트 가능성**을 크게 향상시킬 수 있으며, 향후 프로젝트 확장과 팀 협업에 큰 도움이 될 것으로 예상됩니다.

**추천 시작점**: BpmnEditor.js의 BpmnEditorCore 분리부터 시작하여 점진적으로 확장하는 것이 가장 안전하고 효과적입니다.