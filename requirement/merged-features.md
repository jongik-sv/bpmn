# BPMN 협업 에디터: 기능 심화 및 확장 제안

본 문서는 기존 BPMN 에디터의 핵심 기능을 넘어, 사용자에게 실질적인 가치를 제공하고 기술적으로 지속 가능한 협업 플랫폼을 구축하기 위한 추가 기능들을 제안합니다. 각 기능은 **사용자 가치**, **기술 구현 방안**, 그리고 다른 기능과의 **시너지** 관점에서 상세히 기술합니다.

---

### 1. 코어 에디터 기능 강화

#### **1.1. 지능형 속성 패널 (Intelligent Properties Panel)**
- **사용자 가치**: 사용자가 BPMN 요소를 선택했을 때, 단순히 속성을 나열하는 것을 넘어 가장 자주 사용하거나 중요한 속성을 상단에 노출하고, 유효성 검사 결과를 실시간으로 피드백하여 오류 없는 다이어그램 작성을 돕습니다.
- **기술 구현 방안**:
    - **Frontend**: `bpmn-js`의 `eventBus`를 사용하여 요소 선택(`selection.changed`) 이벤트를 감지하고, 해당 요소의 타입(`element.type`)에 따라 동적으로 렌더링되는 React 컴포넌트를 구현합니다.
    - **Validation**: `bpmn-js-bpmnlint` 플러그인을 통합하여 실시간 린팅(Linting)을 수행하고, 결과를 속성 패널 UI에 직접 표시합니다.
- **시너지**: '다이어그램 유효성 검사' 기능과 직접적으로 연동되어 사용자에게 즉각적인 피드백 루프를 제공합니다.

#### **1.2. 다이어그램 이미지/데이터 내보내기 (Advanced Export)**
- **사용자 가치**: 다이어그램을 단순 이미지(SVG/PNG)뿐만 아니라, 다른 도구와의 호환성을 위한 표준 BPMN 2.0 XML, 그리고 데이터 분석을 위한 JSON 형태로도 내보낼 수 있어 활용성을 극대화합니다.
- **기술 구현 방안**:
    - **Frontend**: `bpmn-js`의 `saveXML`, `saveSVG` API를 활용합니다.
    - **Backend (Optional)**: 대용량 다이어그램의 경우, XML 데이터를 Supabase Edge Function으로 보내 서버 사이드에서 이미지를 생성하고, 생성된 이미지 URL을 사용자에게 제공하여 클라이언트의 부하를 줄일 수 있습니다.
- **시너지**: '워크스페이스 및 데이터 관리' 기능과 연계하여, 프로젝트 단위로 여러 다이어그램을 한 번에 백업하거나 내보내는 기능을 구현할 수 있습니다.
### 2. 차세대 실시간 협업 (Next-Gen Real-time Collaboration)

#### **2.1. CRDT 기반 실시간 동기화 (CRDT-based Real-time Sync)**
- **사용자 가치**: 여러 사용자가 동시에 편집해도 충돌이 발생하지 않으며, 인터넷 연결이 불안정하거나 잠시 끊겨도 오프라인으로 작업을 계속할 수 있습니다. 재연결 시 모든 변경사항은 자동으로 안전하게 병합됩니다. 이는 OT(Operational Transformation) 방식의 중앙 서버 의존성 문제를 해결한 것입니다.
- **기술 구현 방안**:
    - **Core Engine**: **Yjs (CRDT)** 라이브러리를 채택하여 데이터 동기화를 처리합니다. (`ot-crdt-comparison.md`의 결론)
    - **Data Structure**: BPMN의 요소(Element)와 연결(Connection)을 Yjs의 공유 타입(`Y.Map`과 `Y.Array`)으로 모델링합니다.
    - **Backend**: Supabase Realtime을 Yjs의 `y-supabase` Provider와 연결하여 변경사항을 모든 클라이언트에 브로드캐스팅하고, 동시에 Supabase 데이터베이스에 영구 저장합니다.
- **시너지**: '버전 히스토리'는 Yjs의 스냅샷 기능을 활용해 구현되며, '사용자 현재 상태 표시'는 Yjs의 Awareness Protocol을 통해 자연스럽게 확장됩니다.

#### **2.2. 사용자 현재 상태 및 활동 표시 (Live Presence & Activity)**
- **사용자 가치**: 다른 협업자의 실시간 커서 위치, 현재 선택한 다이어그램 요소, 그리고 "타이핑 중..."과 같은 상태를 시각적으로 확인하여 마치 같은 공간에서 함께 작업하는 듯한 생생한 경험을 제공합니다.
- **기술 구현 방안**:
    - **Protocol**: **Yjs Awareness Protocol**을 사용하여 커서 위치, 선택 정보, 사용자 이름/색상 등의 일시적인 상태를 공유합니다. 이 데이터는 DB에 저장되지 않아 부하가 적습니다.
    - **Frontend**: `bpmn-js`의 오버레이(Overlay) 기능을 사용하여 다른 사용자의 커서와 선택 영역을 다이어그램 위에 렌더링합니다.
- **시너지**: '역할 기반 접근 제어(RBAC)'와 연동하여, '뷰어' 역할의 사용자는 커서를 표시하지 않는 등 역할에 따라 상호작용을 달리할 수 있습니다.

#### **2.3. 요소 기반 인라인 댓글 (Element-based Inline Comments)**
- **사용자 가치**: 이메일이나 별도의 메신저 없이, 다이어그램의 특정 Task나 Gateway에 직접 댓글을 달고 스레드를 만들어 관련 논의를 컨텍스트 안에서 진행할 수 있습니다.
- **기술 구현 방안**:
    - **Database**: `diagram_comments` 테이블을 사용하며, `element_id` 필드를 통해 특정 BPMN 요소와 댓글을 연결합니다. (`supabase-bpmn-db-design.md` 참조)
    - **Real-time**: Supabase Realtime을 구독하여 새로운 댓글이나 답글이 달리면 모든 협업자에게 즉시 푸시 알림을 보냅니다.
    - **Frontend**: 사용자가 댓글을 남긴 요소 옆에 작은 아이콘을 표시하고, 클릭 시 댓글 스레드를 보여주는 UI를 구현합니다.
- **시너지**: `@` 멘션 기능을 통해 '사용자 관리' 시스템과 연동하여 특정 협업자에게 알림을 보낼 수 있습니다.
### 3. 지능형 워크스페이스 및 데이터 관리 (Intelligent Workspace & Data Management)

#### **3.1. 자동 버전 히스토리 및 복원 (Automated Version History & Restore)**
- **사용자 가치**: 모든 변경사항이 자동으로 기록되므로, 사용자는 언제든지 특정 시점의 버전으로 다이어그램을 되돌리거나 두 버전 간의 변경 내용을 시각적으로 비교할 수 있습니다.
- **기술 구현 방안**:
    - **Database Trigger**: `diagrams` 테이블에 `UPDATE`가 발생할 때마다 이전 `content`를 `diagram_versions` 테이블에 자동으로 저장하는 PostgreSQL 트리거(`create_diagram_version`)를 설정합니다. (`supabase-bpmn-db-design.md` 참조)
    - **Frontend**: 버전 히스토리 UI에서 특정 버전을 선택하면, 해당 버전의 XML 데이터를 `bpmn-js` 뷰어에 로드하여 보여주고, `bpmn-js-diffing` 유틸리티로 현재 버전과의 차이점을 시각적으로 하이라이트합니다.
- **시너지**: CRDT 동기화와 결합하여, 단순한 텍스트 저장이 아닌 의미 있는 변경 묶음(Transaction) 단위로 버전을 기록할 수 있습니다.

#### **3.2. 다이어그램 썸네일 자동 생성 (Automated Diagram Thumbnails)**
- **사용자 가치**: 폴더나 프로젝트 뷰에서 각 다이어그램의 내용을 미리 볼 수 있는 썸네일 이미지를 제공하여, 텍스트 이름만으로 파일을 찾는 수고를 덜어줍니다.
- **기술 구현 방안**:
    - **Compute**: 다이어그램이 저장될 때, `bpmnXml` 데이터를 **Supabase Edge Function**으로 전송합니다.
    - **Rendering**: Edge Function 내에서 Deno 기반의 헤드리스 브라우저 또는 WASM 기반 렌더링 라이브러리를 사용해 BPMN XML을 PNG 이미지로 변환합니다.
    - **Storage**: 생성된 썸네일 이미지를 **Supabase Storage**의 공개(public) 버킷에 저장하고, 그 URL을 `diagrams` 테이블의 `thumbnail_url` 필드에 업데이트합니다.
- **시너지**: 이 기능은 Supabase의 데이터베이스, 서버리스 컴퓨트, 스토리지를 모두 활용하는 완벽한 예시로, 백엔드 인프라 관리 부담 없이 강력한 기능을 구현할 수 있음을 보여줍니다.
### 4. 보안 및 접근 제어 (Security & Access Control)

#### **4.1. 역할 기반 접근 제어 (Role-Based Access Control - RBAC)**
- **사용자 가치**: 프로젝트 소유자는 이메일로 동료를 초대하고 '관리자', '편집자', '뷰어' 등 명확한 역할을 부여하여 민감한 프로세스 다이어그램의 보안을 유지하고 협업 범위를 제어할 수 있습니다.
- **기술 구현 방안**:
    - **Authentication**: **Supabase Auth**를 통해 사용자 가입 및 로그인을 처리합니다.
    - **Authorization**: `project_members` 테이블에 정의된 `role`('admin', 'editor', 'viewer')을 기반으로 **PostgreSQL의 RLS(Row Level Security)** 정책을 설정합니다. 예를 들어, 'viewer'는 `diagrams` 테이블에 대해 `SELECT`만 가능하고 `UPDATE`는 불가능하도록 정책을 적용합니다.
    - **Invitation**: 사용자를 초대하면 `project_members` 테이블에 레코드가 생성되고, 수락 시 `accepted_at` 타임스탬프가 기록됩니다.
- **시너지**: '인라인 댓글' 기능에서 '뷰어'는 댓글 읽기만 가능하고, '편집자' 이상은 댓글 작성 및 해결이 가능하도록 역할을 연동할 수 있습니다.

이처럼 각 기능들은 독립적으로도 가치가 있지만, 서로 유기적으로 결합될 때 사용자에게 훨씬 더 강력하고 일관된 협업 경험을 제공할 수 있습니다. 다음 단계로 특정 기능의 프로토타입을 개발하거나, MVP(최소 기능 제품) 범위를 정의하는 것을 제안합니다.
