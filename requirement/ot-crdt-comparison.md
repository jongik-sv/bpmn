# BPMN 협업 에디터를 위한 실시간 협업 기술 비교 분석

## 1. 핵심 기술 비교: OT vs CRDT

### 1.1 Operational Transformation (OT)
**개념**: 동시 편집 시 작업(operation)을 변환하여 일관성 유지

**장점**:
- 30년 이상의 연구 역사
- Google Docs, Apache Wave 등에서 검증됨
- 작은 메타데이터 크기

**단점**:
- 중앙 서버 필수 (서버가 모든 변환 조정)
- 구현이 매우 복잡함 ("Google Wave는 개발에 2년 소요")
- 3-way 이상의 변환에서 엣지 케이스 많음
- 확장성 제한 (서버가 병목)

### 1.2 Conflict-free Replicated Data Type (CRDT)
**개념**: 순서에 관계없이 병합 가능한 데이터 구조

**장점**:
- P2P 가능 (서버 없이도 동작)
- 무한 확장 가능 (서버 수평 확장)
- 오프라인 편집 지원
- 작업 순서 무관 (commutative)

**단점**:
- 문서 크기가 지속적으로 증가
- 상대적으로 새로운 기술 (2011년 정식 정의)
- OT보다 약간 더 많은 메타데이터

## 2. Yjs 심층 분석

### 2.1 Yjs의 핵심 장점

**1. P2P 아키텍처**
- "You don't rely on a central server anymore, and you can actually scale your server environment"
- 중앙 서버 없이도 동작 가능
- 서버를 무한정 확장 가능

**2. 뛰어난 성능**
- "Even in the worst case scenario that a user edits text from right to left, Yjs achieves good performance even for huge documents"
- 효율적인 바이너리 인코딩 (3비트로 정수 표현)
- 연속된 작업을 하나로 병합하여 메타데이터 감소

**3. 풍부한 생태계**
- 다양한 에디터 지원 (ProseMirror, CodeMirror, Quill 등)
- WebRTC, WebSocket 등 다양한 네트워크 프로토콜 지원
- React, Vue, Angular 등 주요 프레임워크 통합

### 2.2 BPMN 에디터에 Yjs 적용 시 장점

**1. 복잡한 다이어그램 구조 처리**
```typescript
// Yjs의 공유 타입을 활용한 BPMN 요소 관리
const yDoc = new Y.Doc();
const yBpmnElements = yDoc.getMap('bpmnElements');
const yConnections = yDoc.getArray('connections');

// BPMN 요소 추가/수정이 자동으로 동기화됨
yBpmnElements.set('task1', {
  id: 'task1',
  type: 'bpmn:Task',
  x: 100,
  y: 100,
  label: 'Process Order'
});
```

**2. 오프라인 지원**
- 네트워크 연결이 끊겨도 계속 편집 가능
- 재연결 시 자동으로 변경사항 병합

**3. 버전 관리 내장**
- 스냅샷 기능으로 버전 저장
- Undo/Redo 기능 기본 제공

## 3. 다른 협업 도구와의 비교

### 3.1 주요 도구 비교표

| 특성 | Yjs (CRDT) | ShareJS (OT) | CKEditor (OT) | OT.js |
|------|------------|--------------|---------------|--------|
| 서버 의존성 | 선택적 | 필수 | 필수 | 필수 |
| P2P 지원 | ✅ | ❌ | ❌ | ❌ |
| 오프라인 편집 | ✅ | ❌ | 제한적 | ❌ |
| 확장성 | 무제한 | 제한적 | 제한적 | 제한적 |
| 구현 복잡도 | 중간 | 높음 | 낮음 | 매우 높음 |
| 성능 | 우수 | 보통 | 보통 | 보통 |
| 라이선스 | MIT | MIT | 상용 | MIT |

### 3.2 Tag1 Consulting의 실제 사례

Tag1은 Fortune 50 기업을 위해 실시간 협업 솔루션을 평가한 결과 Yjs를 선택했습니다:
- "Resource allocation is also much easier with Yjs because many servers can store and update the same document"
- ShareDB는 Google Docs와 같은 OT 방식으로 확장성 제한
- CKEditor는 폐쇄적 소스와 독점적 의존성 문제
- Yjs는 에디터 독립적이어서 ProseMirror, CodeMirror 등 자유롭게 선택 가능

## 4. BPMN.io와 Yjs 통합 전략

### 4.1 아키텍처 설계

```typescript
// 1. Yjs 문서 구조 설계
interface YjsBpmnDocument {
  elements: Y.Map<BpmnElement>;      // BPMN 요소들
  connections: Y.Array<Connection>;   // 연결선들
  metadata: Y.Map<any>;              // 메타데이터
  comments: Y.Array<Comment>;        // 주석들
}

// 2. BPMN.io 이벤트와 Yjs 동기화
class BpmnYjsAdapter {
  constructor(
    private modeler: BpmnModeler,
    private yDoc: Y.Doc
  ) {
    this.setupSync();
  }

  private setupSync() {
    // BPMN → Yjs
    this.modeler.on('element.changed', (e) => {
      this.yDoc.transact(() => {
        this.syncElementToYjs(e.element);
      });
    });

    // Yjs → BPMN
    this.yDoc.on('update', (update) => {
      this.applyYjsUpdateToBpmn(update);
    });
  }
}
```

### 4.2 협업 기능 구현

```typescript
// 1. 실시간 커서 공유
class RemoteCursorManager {
  private awareness: awarenessProtocol.Awareness;
  
  updateCursor(position: Point) {
    this.awareness.setLocalStateField('cursor', {
      x: position.x,
      y: position.y,
      color: this.userColor,
      name: this.userName
    });
  }
}

// 2. 선택 영역 공유
class SelectionSync {
  shareSelection(selectedIds: string[]) {
    this.awareness.setLocalStateField('selection', {
      elements: selectedIds,
      timestamp: Date.now()
    });
  }
}
```

## 5. 구현 권장사항

### 5.1 단계별 접근

**Phase 1: MVP (1-2개월)**
- Yjs 기본 통합
- 단순 요소 동기화 (추가/삭제/이동)
- WebSocket 기반 동기화

**Phase 2: 고급 기능 (2-3개월)**
- 복잡한 BPMN 속성 동기화
- 실시간 커서/선택 영역
- 오프라인 지원

**Phase 3: 최적화 (1-2개월)**
- 성능 최적화
- 대용량 다이어그램 지원
- WebRTC 옵션 추가

### 5.2 주의사항

1. **초기 동기화**
   - 큰 다이어그램의 초기 로딩 최적화 필요
   - 점진적 로딩 고려

2. **충돌 해결**
   - BPMN 규칙 위반 시 처리 방안
   - 동시에 같은 연결선 수정 시 정책

3. **성능 고려**
   - 1000개 이상 요소를 가진 다이어그램 테스트
   - 디바운싱/스로틀링 적용

## 6. 결론 및 추천

### Yjs를 선택해야 하는 이유:

1. **미래 지향적**: CRDT는 분산 시스템의 미래
2. **확장성**: 사용자 수 제한 없음
3. **유연성**: 다양한 네트워크 토폴로지 지원
4. **생태계**: 활발한 커뮤니티와 지속적 개발
5. **BPMN 특화**: 복잡한 그래프 구조에 적합

### 대안 고려사항:

- **단순한 요구사항**: 간단한 잠금 기반 협업으로 시작
- **기존 인프라**: OT 기반 시스템이 이미 있다면 ShareJS 고려
- **상용 지원**: 기업 지원이 필요하면 CKEditor 검토

**최종 추천**: BPMN 협업 에디터에는 **Yjs가 최선의 선택**입니다. 특히 Supabase와 함께 사용하면 실시간 동기화와 영구 저장을 효과적으로 구현할 수 있습니다.