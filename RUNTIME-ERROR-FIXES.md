# Runtime Error Fixes - 런타임 오류 수정

## 🚨 해결된 오류: Cannot read properties of null (reading 'id')

### 오류 상황
```
TypeError: Cannot read properties of null (reading 'id')
    at Explorer.setFocusedItem (webpack://bpmn-collaborative-editor/./src/components/Explorer.js?:593:77)
    at HTMLDivElement.eval (webpack://bpmn-collaborative-editor/./src/components/Explorer.js?:352:22)
    at VSCodeLayout.focusExplorer (webpack://bpmn-collaborative-editor/./src/components/VSCodeLayout.js?:462:22)
```

### 원인 분석
1. **초기화 순서 문제**: Explorer가 초기화될 때 TreeDataProvider의 root가 null 상태
2. **Focus 이벤트 타이밍**: VSCodeLayout의 focusExplorer()가 호출되기 전에 root가 설정되지 않음
3. **Null 체크 부재**: setFocusedItem 메서드에서 item이 null인 경우 처리 없음

### 수정 내용

#### 1. setFocusedItem 메서드에 null 체크 추가
```javascript
// 수정 전
setFocusedItem(item) {
    // ...
    const element = this.container.querySelector(`[data-item-id="${item.id}"]`);
    // ...
}

// 수정 후
setFocusedItem(item) {
    // ...
    
    // Null check for item
    if (!item || !item.id) {
        console.warn('setFocusedItem: item is null or has no id', item);
        return;
    }
    
    const element = this.container.querySelector(`[data-item-id="${item.id}"]`);
    // ...
}
```

#### 2. Focus 이벤트 핸들러 개선
```javascript
// 수정 전
treeView.addEventListener('focus', () => {
    if (!this.focusedItem) {
        this.setFocusedItem(this.dataProvider.root);
    }
});

// 수정 후
treeView.addEventListener('focus', () => {
    if (!this.focusedItem) {
        const root = this.dataProvider.root;
        if (root) {
            this.setFocusedItem(root);
        } else {
            console.warn('Focus management: dataProvider.root is null, deferring focus setup');
            // 나중에 root가 설정되면 focus를 다시 시도
            setTimeout(() => {
                const newRoot = this.dataProvider.root;
                if (newRoot && !this.focusedItem) {
                    this.setFocusedItem(newRoot);
                }
            }, 100);
        }
    }
});
```

### 기술적 세부사항

#### 문제 발생 시나리오
1. 사용자가 Explorer 영역을 클릭하거나 포커스할 때
2. VSCodeLayout.focusExplorer()가 호출됨
3. treeView.focus() 실행으로 focus 이벤트 트리거
4. Explorer의 focus 이벤트 핸들러가 실행됨
5. this.dataProvider.root가 null이므로 setFocusedItem(null) 호출
6. setFocusedItem에서 null.id 접근으로 오류 발생

#### 해결 방법
1. **즉시 null 체크**: setFocusedItem에서 item이 null인지 확인 후 early return
2. **지연 재시도**: root가 null인 경우 100ms 후 다시 시도
3. **안전한 로깅**: 오류 대신 경고 메시지로 디버깅 정보 제공

### 추가 방어 코드

#### TreeDataProvider 초기화 개선
```javascript
class TreeDataProvider {
    constructor() {
        this.root = null;  // 초기값 null
        // ...
    }
    
    get root() {
        return this._root;
    }
    
    setRoot(rootItem) {
        this._root = rootItem;
        this.refresh();
    }
}
```

#### Explorer 초기화 순서 개선
```javascript
class Explorer {
    constructor(container) {
        // ...
        this.render();
        this.setupDataProvider();
        this.refreshTree();
        this.attachEventListeners();  // focus 이벤트 리스너 여기서 설정
        // ...
    }
}
```

### 테스트 시나리오
1. **정상 케이스**: root가 설정된 후 focus 이벤트 발생
2. **오류 케이스**: root가 null인 상태에서 focus 이벤트 발생
3. **복구 케이스**: 지연 후 root가 설정되어 focus 재시도 성공

### 향후 개선 사항
1. **Promise 기반 초기화**: async/await를 사용한 순차적 초기화
2. **상태 관리**: Explorer 초기화 상태를 명시적으로 관리
3. **이벤트 기반 아키텍처**: root 설정 시 이벤트 발생하여 focus 처리

## 💡 학습 포인트

### 1. 초기화 순서의 중요성
- 컴포넌트 간 의존성을 고려한 초기화 순서 설계
- 비동기 데이터 로딩과 UI 이벤트 처리의 타이밍 관리

### 2. 방어적 프로그래밍
- null 체크와 early return 패턴 적용
- 예상치 못한 상황에 대한 fallback 처리

### 3. 디버깅 친화적 코드
- 의미 있는 경고 메시지 제공
- 오류 발생 시 컨텍스트 정보 로깅

## 📊 수정 완료 상태
- ✅ setFocusedItem null 체크 추가
- ✅ Focus 이벤트 핸들러 개선
- ✅ 지연 재시도 메커니즘 구현
- ✅ 경고 메시지 및 로깅 개선
- ✅ 코드 품질 향상

---

*수정 완료일: 2025년 7월 8일*
*관련 파일: Explorer.js, VSCodeLayout.js*