# BPMN 협업 에디터

실시간 협업 기능을 갖춘 BPMN(Business Process Model and Notation) 다이어그램 편집기입니다.

## 🚀 현재 구현된 기능

### ✅ Phase 1-A 완료 (2025-07-05)
- **완전한 BPMN 편집기**: BPMN.js 기반의 전문적인 다이어그램 편집
- **모던 프론트엔드**: React 18 + TypeScript + Vite
- **반응형 UI**: Tailwind CSS 기반 깔끔한 디자인
- **기본 편집 기능**: 
  - 드래그 앤 드롭으로 요소 추가
  - 요소 간 연결 생성
  - 다이어그램 저장 (BPMN XML)
  - 줌/팬 기능

## 🛠️ 기술 스택

### Frontend
- **React 18+** with TypeScript
- **Vite** - 빠른 개발 서버 및 빌드 도구
- **Tailwind CSS** - 유틸리티 기반 스타일링
- **bpmn-js** - BPMN 다이어그램 편집 라이브러리

### 향후 계획
- **Supabase** - 백엔드 및 실시간 동기화
- **Yjs** - CRDT 기반 충돌 없는 협업
- **실시간 협업** - 다중 사용자 동시 편집

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 18 이상
- npm 또는 yarn

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone https://github.com/jongik-sv/bpmn.git
   cd bpmn
   ```

2. **의존성 설치**
   ```bash
   cd bpmn-editor
   npm install
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

4. **브라우저에서 확인**
   - 로컬: http://localhost:5173/
   - 네트워크: `npm run dev -- --host` 실행 후 표시되는 네트워크 주소

## 📱 사용법

### 기본 편집
1. **요소 추가**: 왼쪽 팔레트에서 원하는 BPMN 요소를 드래그하여 캔버스에 놓기
2. **요소 연결**: 요소를 클릭하고 나타나는 컨텍스트 메뉴에서 연결 옵션 선택
3. **요소 편집**: 요소를 더블클릭하여 이름 변경
4. **저장**: 상단 "저장" 버튼으로 BPMN XML 내보내기

### 캔버스 조작
- **줌**: 마우스 휠
- **팬**: 캔버스 드래그
- **전체보기**: 자동으로 fit-viewport 적용

## 🗂️ 프로젝트 구조

```
bpmn/
├── bpmn-editor/                 # React 애플리케이션
│   ├── src/
│   │   ├── components/
│   │   │   └── BpmnEditor.tsx   # 메인 BPMN 에디터 컴포넌트
│   │   ├── App.tsx              # 앱 루트 컴포넌트
│   │   └── index.css            # 글로벌 스타일
│   ├── package.json
│   └── vite.config.ts
├── development-design-document.md    # 개발 설계 문서
├── project-todo-management.md        # 프로젝트 진행 관리
└── requirement/                      # 요구사항 분석 문서
```

## 📋 개발 로드맵

### 🎯 Phase 1: MVP (6-8주)
- [x] **Phase 1-A**: 기본 BPMN 에디터 ✅ 완료
- [ ] **Phase 1-B**: Supabase 통합 및 사용자 인증
- [ ] **Phase 1-C**: 기본 실시간 협업

### 🚀 Phase 2: 고급 협업 기능 (8-10주)
- [ ] Yjs CRDT 기반 실시간 동기화
- [ ] 사용자 커서 및 선택 영역 표시
- [ ] 댓글 시스템
- [ ] 자동 버전 관리

### 🎨 Phase 3: 프로덕션 준비 (6-8주)
- [ ] 성능 최적화
- [ ] 모바일 반응형
- [ ] 고급 내보내기 기능
- [ ] 배포 및 모니터링

## 📚 문서

- **[개발 설계 문서](./development-design-document.md)**: 상세한 기술 설계 및 아키텍처
- **[TODO 관리](./project-todo-management.md)**: 프로젝트 진행 상황 및 작업 목록
- **[요구사항 분석](./requirement/)**: 초기 요구사항 및 기술 분석

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 👥 개발자

- **jongik-sv** - *Initial work* - [GitHub](https://github.com/jongik-sv)

## 🙏 감사의 말

- [bpmn-js](https://bpmn.io/) - 뛰어난 BPMN 라이브러리 제공
- [React](https://reactjs.org/) - 현대적인 UI 개발 프레임워크
- [Vite](https://vitejs.dev/) - 빠른 개발 경험
- [Tailwind CSS](https://tailwindcss.com/) - 유틸리티 기반 CSS 프레임워크