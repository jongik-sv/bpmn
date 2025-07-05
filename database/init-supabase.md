# Supabase 프로젝트 설정 가이드

## 1. Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 접속
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - **Name**: `bpmn-collaborative-editor`
   - **Database Password**: 강력한 패스워드 설정
   - **Region**: 가장 가까운 지역 선택 (Seoul 권장)

## 2. 데이터베이스 스키마 적용

1. Supabase Dashboard → SQL Editor
2. `database/schema.sql` 파일의 내용을 복사하여 실행
3. 모든 테이블과 정책이 생성되었는지 확인

## 3. 환경 변수 설정

1. Supabase Dashboard → Settings → API
2. 다음 값들을 복사:
   - **Project URL**
   - **anon/public key**

3. 프로젝트 루트에 `.env` 파일 생성:
```bash
# .env
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
WEBSOCKET_URL=ws://localhost:1234
NODE_ENV=development
```

## 4. 인증 제공자 설정 (선택사항)

### Google OAuth 설정
1. Supabase Dashboard → Authentication → Providers
2. Google 활성화
3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
4. 클라이언트 ID와 시크릿을 Supabase에 입력

### 이메일 인증 설정
1. Authentication → Settings
2. Email 확인 설정
3. SMTP 서버 설정 (선택사항)

## 5. RLS (Row Level Security) 확인

1. Database → Tables에서 각 테이블 확인
2. 모든 테이블에 RLS가 활성화되어 있는지 확인
3. Policies 탭에서 정책들이 올바르게 설정되었는지 확인

## 6. Realtime 기능 활성화

1. Database → Replication
2. 다음 테이블들의 Realtime 활성화:
   - `collaboration_sessions`
   - `diagrams`
   - `diagram_comments`
   - `activity_logs`

## 7. 테스트 데이터 삽입 (개발용)

```sql
-- 테스트 프로젝트 생성 (사용자 로그인 후 실행)
INSERT INTO projects (name, description, owner_id) 
VALUES ('테스트 프로젝트', 'BPMN 에디터 테스트용 프로젝트', auth.uid());

-- 기본 폴더 생성
INSERT INTO folders (project_id, name, created_by)
SELECT id, '기본 폴더', auth.uid() 
FROM projects 
WHERE owner_id = auth.uid() 
LIMIT 1;
```

## 8. 개발 서버 연결 테스트

1. `.env` 파일이 올바르게 설정되었는지 확인
2. 개발 서버 재시작: `npm run dev`
3. 브라우저 개발자 도구에서 Supabase 연결 확인

## 9. 다음 단계

- [ ] 사용자 인증 UI 구현
- [ ] 프로젝트 관리 기능 구현
- [ ] Yjs WebSocket 서버 설정
- [ ] 실시간 협업 기능 통합

## 주의사항

1. **보안**: `.env` 파일을 Git에 커밋하지 마세요
2. **API 키**: anon key는 클라이언트 사이드에서 사용 가능하지만 service_role key는 서버에서만 사용
3. **RLS**: 모든 데이터 접근은 RLS 정책을 통해 제어됩니다
4. **백업**: 프로덕션 배포 전 데이터베이스 백업 설정 필요