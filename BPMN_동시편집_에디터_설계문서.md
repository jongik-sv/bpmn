# BPMN 동시편집 에디터 설계문서
## bpmn-js + Yjs 기반 실시간 협업 솔루션

## 1. 아키텍처 개요

### 1.1 핵심 기술 스택
- **BPMN 엔진**: bpmn-js (모델링 및 렌더링)
- **실시간 협업**: Yjs CRDT (충돌 없는 동기화)
- **네트워크 계층**: y-websocket provider
- **프론트엔드**: React + TypeScript
- **백엔드**: Node.js + Express
- **데이터베이스**: MongoDB (메타데이터 + Y.Doc 퍼시스턴스)

### 1.2 시스템 아키텍처
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client A      │    │   WebSocket      │    │   Client B      │
│   bpmn-js       │◄──►│   Server         │◄──►│   bpmn-js       │
│   + Yjs         │    │   + y-websocket  │    │   + Yjs         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Persistence    │
                       │   Layer          │
                       │   (MongoDB)      │
                       └──────────────────┘
```

## 2. 상세 기술 설계

### 2.1 BPMN 모델링 레이어 (bpmn-js)

#### 2.1.1 핵심 컴포넌트 구조
```typescript
interface BpmnEditorConfig {
  container: HTMLElement;
  keyboard: { bindTo: HTMLElement };
  additionalModules: Module[];
}

class CollaborativeBpmnEditor {
  private modeler: BpmnJS;
  private propertiesPanel: PropertiesPanel;
  private minimap: Minimap;
  private yDoc: Y.Doc;
  private yXmlFragment: Y.XmlFragment;
  
  constructor(config: BpmnEditorConfig) {
    this.initializeModeler(config);
    this.initializeYjs();
    this.setupEventHandlers();
  }
}
```

#### 2.1.2 주요 모듈 구성
```typescript
// 필수 모듈 구성
const modules = [
  // Core modules
  BpmnModelerModule,
  PropertiesPanelModule,
  MinimapModule,
  
  // Custom modules
  CollaborationModule,
  CursorModule,
  CommentModule,
  
  // Provider modules
  WebSocketProviderModule
];
```

#### 2.1.3 BPMN 요소 관리
```typescript
interface BpmnElement {
  id: string;
  type: string;
  businessObject: ModdleElement;
  di: ModdleElement;
}

class BpmnElementManager {
  private yElements: Y.Map<BpmnElement>;
  
  createElement(elementData: Partial<BpmnElement>): void {
    const element = this.modeler.get('elementFactory').create(elementData.type, elementData);
    this.yElements.set(element.id, element);
  }
  
  updateElement(id: string, changes: Partial<BpmnElement>): void {
    const element = this.yElements.get(id);
    if (element) {
      Object.assign(element, changes);
      this.yElements.set(id, element);
    }
  }
}
```

### 2.2 실시간 협업 레이어 (Yjs)

#### 2.2.1 Yjs 문서 구조
```typescript
class CollaborativeDocument {
  public yDoc: Y.Doc;
  public yBpmn: Y.XmlFragment;        // BPMN XML 구조
  public yElements: Y.Map<any>;       // BPMN 요소들
  public ySelection: Y.Map<any>;      // 사용자 선택 상태
  public yCursors: Y.Map<any>;        // 커서 위치
  public yComments: Y.Array<any>;     // 댓글 시스템
  public yHistory: Y.Array<any>;      // 변경 이력
  
  constructor(docId: string) {
    this.yDoc = new Y.Doc();
    this.initializeSharedTypes();
    this.setupUndoManager();
  }
  
  private initializeSharedTypes(): void {
    this.yBpmn = this.yDoc.getXmlFragment('bpmn');
    this.yElements = this.yDoc.getMap('elements');
    this.ySelection = this.yDoc.getMap('selection');
    this.yCursors = this.yDoc.getMap('cursors');
    this.yComments = this.yDoc.getArray('comments');
    this.yHistory = this.yDoc.getArray('history');
  }
}
```

#### 2.2.2 동기화 메커니즘
```typescript
class BpmnSynchronizer {
  private doc: CollaborativeDocument;
  private modeler: BpmnJS;
  
  constructor(doc: CollaborativeDocument, modeler: BpmnJS) {
    this.doc = doc;
    this.modeler = modeler;
    this.setupObservers();
  }
  
  private setupObservers(): void {
    // BPMN 요소 변경 관찰
    this.doc.yElements.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          this.handleElementAdded(key, this.doc.yElements.get(key));
        } else if (change.action === 'update') {
          this.handleElementUpdated(key, this.doc.yElements.get(key));
        } else if (change.action === 'delete') {
          this.handleElementDeleted(key);
        }
      });
    });
    
    // 로컬 변경사항을 Yjs로 전파
    this.modeler.on('element.changed', (event) => {
      this.doc.yElements.set(event.element.id, {
        id: event.element.id,
        type: event.element.type,
        businessObject: event.element.businessObject,
        di: event.element.di
      });
    });
  }
}
```

### 2.3 네트워크 통신 레이어

#### 2.3.1 WebSocket Provider 설정
```typescript
class CollaborationProvider {
  private wsProvider: WebsocketProvider;
  private doc: Y.Doc;
  
  constructor(roomId: string, doc: Y.Doc) {
    this.doc = doc;
    this.wsProvider = new WebsocketProvider(
      'ws://localhost:1234', // WebSocket 서버 URL
      roomId,                // 방 ID
      doc,                   // Y.Doc 인스턴스
      {
        connect: true,
        awareness: new Awareness(doc) // 사용자 인식 기능
      }
    );
    
    this.setupAwareness();
  }
  
  private setupAwareness(): void {
    const awareness = this.wsProvider.awareness;
    
    // 로컬 사용자 정보 설정
    awareness.setLocalStateField('user', {
      name: 'User Name',
      color: '#ff0000',
      cursor: { x: 0, y: 0 }
    });
    
    // 다른 사용자 상태 변경 감지
    awareness.on('change', () => {
      this.updateRemoteUserStates();
    });
  }
}
```

#### 2.3.2 서버 사이드 구현
```typescript
// WebSocket 서버 (Node.js)
import WebSocket from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const wss = new WebSocket.Server({ port: 1234 });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, {
    // 문서 지속성 설정
    docName: req.url?.slice(1) || 'default-doc',
    
    // 인증 미들웨어
    authenticate: (docName, ws) => {
      // JWT 토큰 검증 로직
      return true;
    },
    
    // 권한 검증
    authorize: (docName, ydoc, ws) => {
      // 사용자 권한 확인 로직
      return true;
    }
  });
});
```

### 2.4 사용자 인터페이스 컴포넌트

#### 2.4.1 메인 에디터 컴포넌트
```typescript
interface BpmnCollaborativeEditorProps {
  roomId: string;
  userId: string;
  userName: string;
  initialBpmn?: string;
}

const BpmnCollaborativeEditor: React.FC<BpmnCollaborativeEditorProps> = ({
  roomId,
  userId,
  userName,
  initialBpmn
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modeler, setModeler] = useState<BpmnJS | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  
  useEffect(() => {
    initializeEditor();
    return () => cleanup();
  }, []);
  
  const initializeEditor = async () => {
    // Y.Doc 초기화
    const yDoc = new Y.Doc();
    
    // WebSocket Provider 설정
    const wsProvider = new WebsocketProvider(
      'ws://localhost:1234',
      roomId,
      yDoc
    );
    
    // bpmn-js 모델러 초기화
    const bpmnModeler = new BpmnJS({
      container: containerRef.current,
      keyboard: { bindTo: document },
      additionalModules: [
        PropertiesPanelModule,
        MinimapModule
      ]
    });
    
    // 협업 기능 설정
    const collaborator = new BpmnCollaborator(yDoc, bpmnModeler);
    
    setDoc(yDoc);
    setProvider(wsProvider);
    setModeler(bpmnModeler);
  };
  
  return (
    <div className="bpmn-collaborative-editor">
      <div className="editor-header">
        <ConnectedUsersList users={connectedUsers} />
        <div className="editor-controls">
          <button onClick={handleShare}>
            <ShareIcon /> 공유
          </button>
          <button onClick={handleSave}>저장</button>
          <button onClick={handleExport}>내보내기</button>
        </div>
      </div>
      
      <div className="editor-body">
        <div className="editor-main">
          <div ref={containerRef} className="bpmn-container" />
          <RemoteCursors doc={doc} />
        </div>
        
        <div className="editor-sidebar">
          <PropertiesPanel />
          <CommentsPanel doc={doc} />
          <Minimap />
        </div>
      </div>
    </div>
  );
};
```

#### 2.4.2 실시간 커서 컴포넌트
```typescript
const RemoteCursors: React.FC<{ doc: Y.Doc | null }> = ({ doc }) => {
  const [cursors, setCursors] = useState<Map<string, CursorState>>(new Map());
  
  useEffect(() => {
    if (!doc) return;
    
    const awareness = doc.getMap('awareness');
    
    const updateCursors = () => {
      const states = awareness.getStates();
      const newCursors = new Map();
      
      states.forEach((state, clientId) => {
        if (state.cursor && clientId !== doc.clientID) {
          newCursors.set(clientId, {
            x: state.cursor.x,
            y: state.cursor.y,
            user: state.user
          });
        }
      });
      
      setCursors(newCursors);
    };
    
    awareness.on('change', updateCursors);
    
    return () => {
      awareness.off('change', updateCursors);
    };
  }, [doc]);
  
  return (
    <div className="remote-cursors">
      {Array.from(cursors.entries()).map(([clientId, cursor]) => (
        <div
          key={clientId}
          className="remote-cursor"
          style={{
            left: cursor.x,
            top: cursor.y,
            borderColor: cursor.user.color
          }}
        >
          <div className="cursor-flag">
            {cursor.user.name}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 2.5 데이터 지속성 및 버전 관리

#### 2.5.1 문서 저장 메커니즘 (MongoDB 기반)
```typescript
import { MongoClient, Db } from 'mongodb';

class BpmnPersistence {
  private db: Db;
  
  constructor(mongoClient: MongoClient) {
    this.db = mongoClient.db('bpmn_editor');
  }
  
  async saveDocument(documentId: string, yDoc: Y.Doc, userId: string): Promise<void> {
    const yjsState = Y.encodeStateAsUpdate(yDoc);
    const yjsStateVector = Y.encodeStateVector(yDoc);
    const bpmnXml = this.extractBpmnXml(yDoc);
    
    await this.db.collection('documents').updateOne(
      { _id: documentId },
      {
        $set: {
          bpmnXml,
          yjsState,
          yjsStateVector,
          'metadata.lastModifiedBy': userId,
          'metadata.elementCount': this.countBpmnElements(bpmnXml),
          'metadata.fileSize': Buffer.byteLength(bpmnXml, 'utf8'),
          updatedAt: new Date()
        },
        $inc: { 'metadata.version': 1 }
      },
      { upsert: true }
    );
  }
  
  async loadDocument(documentId: string): Promise<Uint8Array | null> {
    const doc = await this.db.collection('documents').findOne(
      { _id: documentId },
      { projection: { yjsState: 1 } }
    );
    
    return doc?.yjsState || null;
  }
  
  private extractBpmnXml(yDoc: Y.Doc): string {
    const yBpmn = yDoc.getXmlFragment('bpmn');
    return yBpmn.toString();
  }
  
  private countBpmnElements(bpmnXml: string): number {
    // BPMN 요소 개수 계산 로직
    const matches = bpmnXml.match(/<(bpmn:|bpmn2:)\w+/g);
    return matches ? matches.length : 0;
  }
}
```

#### 2.5.2 버전 관리 시스템
```typescript
class BpmnVersionManager {
  private yDoc: Y.Doc;
  private undoManager: Y.UndoManager;
  
  constructor(yDoc: Y.Doc) {
    this.yDoc = yDoc;
    this.undoManager = new Y.UndoManager([
      yDoc.getMap('elements'),
      yDoc.getXmlFragment('bpmn')
    ]);
  }
  
  createSnapshot(name: string): void {
    const snapshot = Y.snapshot(this.yDoc);
    const versions = this.yDoc.getArray('versions');
    
    versions.push([{
      id: Date.now().toString(),
      name,
      snapshot,
      createdAt: new Date().toISOString(),
      author: this.getCurrentUser()
    }]);
  }
  
  restoreSnapshot(versionId: string): void {
    const versions = this.yDoc.getArray('versions');
    const version = versions.toArray().find(v => v.id === versionId);
    
    if (version) {
      Y.applyUpdate(this.yDoc, version.snapshot);
    }
  }
}
```

### 2.6 실시간 자동 저장 시스템

#### 2.6.1 자동 저장 트리거
```typescript
class AutoSaveManager {
  private saveQueue: Map<string, NodeJS.Timeout> = new Map();
  private persistence: BpmnPersistence;
  private saveDelay: number = 5000; // 5초 디바운스
  
  constructor(persistence: BpmnPersistence) {
    this.persistence = persistence;
  }
  
  scheduleAutoSave(documentId: string, yDoc: Y.Doc, userId: string): void {
    // 기존 저장 스케줄 취소
    const existingTimeout = this.saveQueue.get(documentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // 새로운 저장 스케줄
    const timeout = setTimeout(async () => {
      try {
        await this.persistence.saveDocument(documentId, yDoc, userId);
        this.notifyAutoSaveComplete(documentId);
        console.log(`자동 저장 완료: ${documentId}`);
      } catch (error) {
        this.notifyAutoSaveError(documentId, error);
        console.error(`자동 저장 실패: ${documentId}`, error);
      } finally {
        this.saveQueue.delete(documentId);
      }
    }, this.saveDelay);
    
    this.saveQueue.set(documentId, timeout);
  }
  
  private notifyAutoSaveComplete(documentId: string): void {
    // 클라이언트에게 저장 완료 알림
    const message = {
      type: 'auto-save-complete',
      documentId,
      timestamp: new Date().toISOString()
    };
    
    this.broadcastToDocument(documentId, message);
  }
}
```

#### 2.6.2 변경 감지 및 저장 로직
```typescript
class DocumentChangeWatcher {
  private autoSaveManager: AutoSaveManager;
  private documents: Map<string, Y.Doc> = new Map();
  
  constructor(autoSaveManager: AutoSaveManager) {
    this.autoSaveManager = autoSaveManager;
  }
  
  watchDocument(documentId: string, yDoc: Y.Doc, userId: string): void {
    this.documents.set(documentId, yDoc);
    
    // 모든 공유 타입에 대한 변경 감지
    const sharedTypes = [
      yDoc.getMap('elements'),      // BPMN 요소 변경
      yDoc.getXmlFragment('bpmn'),  // BPMN XML 변경
      yDoc.getArray('comments')     // 댓글 변경
    ];
    
    sharedTypes.forEach(sharedType => {
      sharedType.observe((event, transaction) => {
        // 변경이 발생하면 자동 저장 스케줄
        if (event.changes.keys.size > 0 || event.changes.added.size > 0 || event.changes.deleted.size > 0) {
          console.log(`문서 변경 감지: ${documentId}`);
          this.autoSaveManager.scheduleAutoSave(documentId, yDoc, userId);
        }
      });
    });
  }
  
  unwatchDocument(documentId: string): void {
    this.documents.delete(documentId);
  }
}
```

#### 2.6.3 UI 저장 상태 표시
```typescript
const AutoSaveIndicator: React.FC<{ documentId: string }> = ({ documentId }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  useEffect(() => {
    const handleAutoSaveEvent = (event: any) => {
      if (event.documentId !== documentId) return;
      
      switch (event.type) {
        case 'auto-save-start':
          setSaveStatus('saving');
          break;
        case 'auto-save-complete':
          setSaveStatus('saved');
          setLastSaved(new Date(event.timestamp));
          break;
        case 'auto-save-error':
          setSaveStatus('error');
          break;
      }
    };
    
    // WebSocket 메시지 리스너 등록
    window.addEventListener('auto-save-event', handleAutoSaveEvent);
    
    return () => {
      window.removeEventListener('auto-save-event', handleAutoSaveEvent);
    };
  }, [documentId]);
  
  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Spinner size="sm" />;
      case 'saved':
        return <CheckIcon color="green" />;
      case 'error':
        return <WarningIcon color="red" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="auto-save-indicator">
      {getStatusIcon()}
      <span className="save-status">
        {saveStatus === 'saving' && '저장 중...'}
        {saveStatus === 'saved' && lastSaved && `저장됨 ${formatTimeAgo(lastSaved)}`}
        {saveStatus === 'error' && '저장 실패'}
      </span>
    </div>
  );
};
```

#### 2.6.4 통합된 협업 에디터 컴포넌트
```typescript
const BpmnCollaborativeEditor: React.FC<BpmnCollaborativeEditorProps> = ({
  roomId,
  userId,
  userName,
  initialBpmn
}) => {
  const [autoSaveManager, setAutoSaveManager] = useState<AutoSaveManager | null>(null);
  const [changeWatcher, setChangeWatcher] = useState<DocumentChangeWatcher | null>(null);
  
  const initializeEditor = async () => {
    // ... 기존 초기화 코드 ...
    
    // 자동 저장 시스템 초기화
    const persistence = new BpmnPersistence(mongoClient);
    const autoSave = new AutoSaveManager(persistence);
    const watcher = new DocumentChangeWatcher(autoSave);
    
    // 문서 변경 감지 시작
    watcher.watchDocument(roomId, yDoc, userId);
    
    setAutoSaveManager(autoSave);
    setChangeWatcher(watcher);
    
    // ... 나머지 초기화 코드 ...
  };
  
  return (
    <div className="bpmn-collaborative-editor">
      <div className="editor-header">
        <ConnectedUsersList users={connectedUsers} />
        <AutoSaveIndicator documentId={roomId} />
        <div className="editor-controls">
          <button onClick={handleShare}>
            <ShareIcon /> 공유
          </button>
          <button onClick={handleManualSave}>수동 저장</button>
          <button onClick={handleExport}>내보내기</button>
        </div>
      </div>
      
      {/* 나머지 UI 컴포넌트들 */}
    </div>
  );
};
```

## 3. 구현 세부사항

### 3.1 충돌 해결 전략

#### 3.1.1 BPMN 요소 충돌 처리
```typescript
class BpmnConflictResolver {
  resolveElementConflict(
    localElement: BpmnElement, 
    remoteElement: BpmnElement
  ): BpmnElement {
    // 마지막 수정 시간 기준 해결
    if (localElement.lastModified > remoteElement.lastModified) {
      return localElement;
    }
    
    // 속성별 세밀한 병합
    return {
      ...remoteElement,
      ...this.mergeProperties(localElement, remoteElement)
    };
  }
  
  private mergeProperties(local: BpmnElement, remote: BpmnElement): any {
    // 비즈니스 로직에 따른 속성 병합
    const merged = { ...remote.businessObject };
    
    // 중요한 속성들은 로컬 우선
    if (local.businessObject.name !== remote.businessObject.name) {
      merged.name = local.businessObject.name;
    }
    
    return merged;
  }
}
```

### 3.2 성능 최적화

#### 3.2.1 렌더링 최적화
```typescript
class BpmnRenderOptimizer {
  private renderQueue: Map<string, BpmnElement> = new Map();
  private isRenderingScheduled = false;
  
  scheduleRender(elementId: string, element: BpmnElement): void {
    this.renderQueue.set(elementId, element);
    
    if (!this.isRenderingScheduled) {
      this.isRenderingScheduled = true;
      requestAnimationFrame(() => this.flushRenderQueue());
    }
  }
  
  private flushRenderQueue(): void {
    const batch = Array.from(this.renderQueue.entries());
    this.renderQueue.clear();
    this.isRenderingScheduled = false;
    
    // 배치 렌더링 실행
    this.batchUpdateElements(batch);
  }
}
```

### 3.3 보안 고려사항

#### 3.3.1 접근 권한 검증
```typescript
class BpmnSecurityManager {
  validateOperation(
    userId: string, 
    operation: BpmnOperation, 
    elementId?: string
  ): boolean {
    const userRole = this.getUserRole(userId);
    
    switch (operation) {
      case 'CREATE':
      case 'UPDATE':
      case 'DELETE':
        return userRole === 'EDITOR' || userRole === 'OWNER';
      case 'READ':
        return userRole !== 'NONE';
      default:
        return false;
    }
  }
  
  sanitizeBpmnContent(xml: string): string {
    // XSS 방지를 위한 XML 새니타이징
    return xml.replace(/<script[^>]*>.*?<\/script>/gi, '');
  }
}
```

## 4. 배포 및 운영

### 4.1 Docker 구성
```dockerfile
# Frontend Dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### 4.2 Kubernetes 배포
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bpmn-collaborative-editor
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bpmn-editor
  template:
    metadata:
      labels:
        app: bpmn-editor
    spec:
      containers:
      - name: bpmn-editor
        image: bpmn-editor:latest
        ports:
        - containerPort: 3000
        env:
        - name: WEBSOCKET_URL
          value: "ws://websocket-service:1234"
```

## 5. 테스트 전략

### 5.1 단위 테스트
```typescript
describe('BpmnCollaborator', () => {
  let collaborator: BpmnCollaborator;
  let yDoc: Y.Doc;
  let modeler: BpmnJS;
  
  beforeEach(() => {
    yDoc = new Y.Doc();
    modeler = new BpmnJS({ container: document.createElement('div') });
    collaborator = new BpmnCollaborator(yDoc, modeler);
  });
  
  it('should sync element creation', () => {
    const element = { id: 'task1', type: 'bpmn:Task' };
    collaborator.createElement(element);
    
    expect(yDoc.getMap('elements').get('task1')).toEqual(element);
  });
});
```

### 5.2 통합 테스트
```typescript
describe('Collaborative Editing Integration', () => {
  it('should sync changes between two clients', async () => {
    const [doc1, doc2] = await setupTwoClientScenario();
    
    // Client 1에서 요소 생성
    doc1.getMap('elements').set('task1', { type: 'bpmn:Task' });
    
    // Client 2에서 변경사항 확인
    await waitForSync();
    expect(doc2.getMap('elements').get('task1')).toBeDefined();
  });
});
```

이 설계문서는 bpmn-js와 Yjs를 활용하여 실시간 협업이 가능한 BPMN 에디터를 구현하는 구체적인 방법을 제시합니다.