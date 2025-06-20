# BPMN 동시편집 에디터 - 문서 공유 기능 설계

## 1. 공유 기능 개요

### 1.1 공유 방식
- **링크 공유**: 고유한 공유 링크를 통한 접근
- **이메일 초대**: 특정 사용자를 이메일로 초대
- **프로젝트 멤버**: 프로젝트 단위 멤버 관리

### 1.2 권한 레벨
- **편집자 (Editor)**: 문서 읽기/쓰기, 댓글 작성 가능
- **뷰어 (Viewer)**: 문서 읽기, 댓글 작성만 가능
- **소유자 (Owner)**: 모든 권한 + 공유 관리

## 2. 데이터베이스 스키마 확장

### 2.1 DocumentShares 컬렉션 (새로 추가)
```typescript
interface DocumentShare {
  _id: ObjectId;
  documentId: ObjectId;      // 문서 ID
  shareToken: string;        // 공유 토큰 (UUID)
  createdBy: ObjectId;       // 공유 생성자
  shareType: 'link' | 'email'; // 공유 타입
  accessLevel: 'editor' | 'viewer'; // 접근 권한
  settings: {
    requireAuth: boolean;    // 로그인 필요 여부
    allowDownload: boolean;  // 다운로드 허용
    allowComment: boolean;   // 댓글 허용
    expiresAt?: Date;        // 만료일
    accessLimit?: number;    // 접근 횟수 제한
    currentAccess: number;   // 현재 접근 횟수
    password?: string;       // 비밀번호 보호
  };
  isActive: boolean;         // 활성 상태
  createdAt: Date;
  updatedAt: Date;
}

const documentShareSchema = new Schema<DocumentShare>({
  documentId: { type: Schema.Types.ObjectId, ref: 'BpmnDocument', required: true },
  shareToken: { type: String, required: true, unique: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shareType: { type: String, enum: ['link', 'email'], required: true },
  accessLevel: { type: String, enum: ['editor', 'viewer'], required: true },
  settings: {
    requireAuth: { type: Boolean, default: false },
    allowDownload: { type: Boolean, default: true },
    allowComment: { type: Boolean, default: true },
    expiresAt: Date,
    accessLimit: Number,
    currentAccess: { type: Number, default: 0 },
    password: String
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// 인덱스 설정
documentShareSchema.index({ shareToken: 1 }, { unique: true });
documentShareSchema.index({ documentId: 1, isActive: 1 });
documentShareSchema.index({ createdBy: 1, createdAt: -1 });
```

### 2.2 ShareAccess 컬렉션 (접근 로그)
```typescript
interface ShareAccess {
  _id: ObjectId;
  shareId: ObjectId;         // DocumentShare ID
  documentId: ObjectId;      // 문서 ID
  userId?: ObjectId;         // 사용자 ID (로그인한 경우)
  ipAddress: string;         // IP 주소
  userAgent: string;         // User Agent
  accessedAt: Date;
  sessionDuration?: number;  // 세션 지속 시간 (초)
  actions: Array<{           // 수행한 액션들
    type: string;
    timestamp: Date;
    details?: any;
  }>;
}

const shareAccessSchema = new Schema<ShareAccess>({
  shareId: { type: Schema.Types.ObjectId, ref: 'DocumentShare', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'BpmnDocument', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  accessedAt: { type: Date, default: Date.now },
  sessionDuration: Number,
  actions: [{
    type: String,
    timestamp: { type: Date, default: Date.now },
    details: Schema.Types.Mixed
  }]
});
```

## 3. API 엔드포인트

### 3.1 문서 공유 API
```typescript
// document-share.routes.ts
const documentShareRoutes = [
  'POST   /api/documents/:id/share',           // 공유 링크 생성
  'GET    /api/documents/:id/share',           // 공유 설정 조회
  'PUT    /api/documents/:id/share/:shareId',  // 공유 설정 수정
  'DELETE /api/documents/:id/share/:shareId',  // 공유 중단
  'POST   /api/documents/:id/invite',          // 이메일 초대
  'GET    /api/share/:shareToken',             // 공유 링크로 문서 접근
  'POST   /api/share/:shareToken/access',      // 공유 문서 접근 권한 확인
  'GET    /api/documents/:id/share/stats',     // 공유 통계
];
```

### 3.2 컨트롤러 구현
```typescript
// document-share.controller.ts
export class DocumentShareController {
  
  // 공유 링크 생성
  async createShareLink(req: Request, res: Response): Promise<void> {
    const { id: documentId } = req.params;
    const {
      accessLevel = 'viewer',
      requireAuth = false,
      allowDownload = true,
      allowComment = true,
      expiresAt,
      accessLimit,
      password
    } = req.body;
    const createdBy = req.user!.id;
    
    // 문서 소유권 확인
    const hasPermission = await this.checkDocumentPermission(documentId, createdBy, 'share');
    if (!hasPermission) {
      res.status(403).json({ error: 'Share permission denied' });
      return;
    }
    
    // 공유 토큰 생성
    const shareToken = this.generateShareToken();
    
    const documentShare = new DocumentShare({
      documentId,
      shareToken,
      createdBy,
      shareType: 'link',
      accessLevel,
      settings: {
        requireAuth,
        allowDownload,
        allowComment,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        accessLimit,
        currentAccess: 0,
        password: password ? await bcrypt.hash(password, 10) : undefined
      }
    });
    
    await documentShare.save();
    
    const shareUrl = `${process.env.FRONTEND_URL}/share/${shareToken}`;
    
    res.status(201).json({
      shareId: documentShare._id,
      shareToken,
      shareUrl,
      accessLevel,
      settings: documentShare.settings
    });
  }
  
  // 이메일 초대
  async inviteByEmail(req: Request, res: Response): Promise<void> {
    const { id: documentId } = req.params;
    const { emails, accessLevel = 'viewer', message } = req.body;
    const inviterId = req.user!.id;
    
    // 권한 확인
    const hasPermission = await this.checkDocumentPermission(documentId, inviterId, 'share');
    if (!hasPermission) {
      res.status(403).json({ error: 'Share permission denied' });
      return;
    }
    
    const results = [];
    
    for (const email of emails) {
      try {
        // 사용자 찾기 또는 임시 초대 생성
        let user = await User.findOne({ email });
        
        if (!user) {
          // 미가입 사용자 - 초대 이메일 발송
          const inviteToken = this.generateInviteToken();
          await this.sendInvitationEmail(email, inviteToken, message, accessLevel);
          results.push({ email, status: 'invited', requiresSignup: true });
        } else {
          // 기존 사용자 - 직접 권한 부여
          const existingPermission = await Permission.findOne({
            projectId: await this.getProjectIdFromDocument(documentId),
            userId: user._id
          });
          
          if (existingPermission) {
            results.push({ email, status: 'already_member' });
          } else {
            // 프로젝트 권한 생성
            const permission = new Permission({
              projectId: await this.getProjectIdFromDocument(documentId),
              userId: user._id,
              role: accessLevel === 'editor' ? 'editor' : 'viewer',
              permissions: this.getRolePermissions(accessLevel),
              grantedBy: inviterId
            });
            
            await permission.save();
            await this.sendAccessGrantedEmail(user.email, message);
            results.push({ email, status: 'access_granted', userId: user._id });
          }
        }
      } catch (error) {
        results.push({ email, status: 'error', error: error.message });
      }
    }
    
    res.json({ results });
  }
  
  // 공유 링크로 문서 접근
  async accessSharedDocument(req: Request, res: Response): Promise<void> {
    const { shareToken } = req.params;
    const { password } = req.body;
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip;
    
    try {
      const share = await DocumentShare.findOne({
        shareToken,
        isActive: true
      }).populate('documentId');
      
      if (!share) {
        res.status(404).json({ error: 'Share link not found or expired' });
        return;
      }
      
      // 만료 확인
      if (share.settings.expiresAt && new Date() > share.settings.expiresAt) {
        res.status(410).json({ error: 'Share link has expired' });
        return;
      }
      
      // 접근 횟수 제한 확인
      if (share.settings.accessLimit && 
          share.settings.currentAccess >= share.settings.accessLimit) {
        res.status(429).json({ error: 'Access limit exceeded' });
        return;
      }
      
      // 비밀번호 확인
      if (share.settings.password) {\n        if (!password) {\n          res.status(401).json({ error: 'Password required', requiresPassword: true });\n          return;\n        }\n        \n        const isValidPassword = await bcrypt.compare(password, share.settings.password);\n        if (!isValidPassword) {\n          res.status(401).json({ error: 'Invalid password' });\n          return;\n        }\n      }\n      \n      // 로그인 필요 여부 확인\n      if (share.settings.requireAuth && !req.user) {\n        res.status(401).json({ error: 'Authentication required', requiresAuth: true });\n        return;\n      }\n      \n      // 접근 로그 기록\n      const accessLog = new ShareAccess({\n        shareId: share._id,\n        documentId: share.documentId,\n        userId: req.user?._id,\n        ipAddress,\n        userAgent\n      });\n      \n      await accessLog.save();\n      \n      // 접근 횟수 증가\n      await DocumentShare.findByIdAndUpdate(share._id, {\n        $inc: { 'settings.currentAccess': 1 }\n      });\n      \n      res.json({\n        document: share.documentId,\n        accessLevel: share.accessLevel,\n        settings: {\n          allowDownload: share.settings.allowDownload,\n          allowComment: share.settings.allowComment\n        },\n        accessToken: this.generateAccessToken(share._id, req.user?._id)\n      });\n      \n    } catch (error) {\n      res.status(500).json({ error: 'Server error' });\n    }\n  }\n  \n  // 공유 통계 조회\n  async getShareStats(req: Request, res: Response): Promise<void> {\n    const { id: documentId } = req.params;\n    const userId = req.user!.id;\n    \n    // 권한 확인\n    const hasPermission = await this.checkDocumentPermission(documentId, userId, 'read');\n    if (!hasPermission) {\n      res.status(403).json({ error: 'Access denied' });\n      return;\n    }\n    \n    const shares = await DocumentShare.find({ documentId, isActive: true });\n    const shareIds = shares.map(s => s._id);\n    \n    const accessStats = await ShareAccess.aggregate([\n      { $match: { shareId: { $in: shareIds } } },\n      {\n        $group: {\n          _id: '$shareId',\n          totalAccess: { $sum: 1 },\n          uniqueVisitors: { $addToSet: '$ipAddress' },\n          lastAccessed: { $max: '$accessedAt' }\n        }\n      },\n      {\n        $addFields: {\n          uniqueVisitorCount: { $size: '$uniqueVisitors' }\n        }\n      }\n    ]);\n    \n    const statsMap = new Map(accessStats.map(stat => [stat._id.toString(), stat]));\n    \n    const result = shares.map(share => ({\n      shareId: share._id,\n      shareToken: share.shareToken,\n      accessLevel: share.accessLevel,\n      createdAt: share.createdAt,\n      settings: share.settings,\n      stats: {\n        totalAccess: statsMap.get(share._id.toString())?.totalAccess || 0,\n        uniqueVisitors: statsMap.get(share._id.toString())?.uniqueVisitorCount || 0,\n        lastAccessed: statsMap.get(share._id.toString())?.lastAccessed\n      }\n    }));\n    \n    res.json({ shares: result });\n  }\n  \n  private generateShareToken(): string {\n    return crypto.randomBytes(32).toString('hex');\n  }\n  \n  private generateAccessToken(shareId: ObjectId, userId?: ObjectId): string {\n    return jwt.sign(\n      { shareId, userId, type: 'share_access' },\n      process.env.JWT_SECRET!,\n      { expiresIn: '24h' }\n    );\n  }\n}\n```\n\n## 4. 프론트엔드 컴포넌트\n\n### 4.1 공유 다이얼로그 컴포넌트\n```typescript\nconst ShareDialog: React.FC<{ documentId: string; isOpen: boolean; onClose: () => void }> = ({\n  documentId,\n  isOpen,\n  onClose\n}) => {\n  const [shareType, setShareType] = useState<'link' | 'email'>('link');\n  const [accessLevel, setAccessLevel] = useState<'viewer' | 'editor'>('viewer');\n  const [settings, setSettings] = useState({\n    requireAuth: false,\n    allowDownload: true,\n    allowComment: true,\n    expiresAt: '',\n    accessLimit: '',\n    password: ''\n  });\n  const [shareUrl, setShareUrl] = useState('');\n  const [inviteEmails, setInviteEmails] = useState(['']);\n  const [isLoading, setIsLoading] = useState(false);\n  \n  const handleCreateShareLink = async () => {\n    setIsLoading(true);\n    try {\n      const response = await fetch(`/api/documents/${documentId}/share`, {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${getAuthToken()}`\n        },\n        body: JSON.stringify({\n          accessLevel,\n          ...settings,\n          expiresAt: settings.expiresAt ? new Date(settings.expiresAt) : undefined,\n          accessLimit: settings.accessLimit ? parseInt(settings.accessLimit) : undefined\n        })\n      });\n      \n      const data = await response.json();\n      setShareUrl(data.shareUrl);\n      \n      // 클립보드에 복사\n      await navigator.clipboard.writeText(data.shareUrl);\n      toast.success('공유 링크가 생성되고 클립보드에 복사되었습니다.');\n      \n    } catch (error) {\n      toast.error('공유 링크 생성에 실패했습니다.');\n    } finally {\n      setIsLoading(false);\n    }\n  };\n  \n  const handleInviteByEmail = async () => {\n    const validEmails = inviteEmails.filter(email => email.trim() && isValidEmail(email));\n    \n    if (validEmails.length === 0) {\n      toast.error('유효한 이메일 주소를 입력해주세요.');\n      return;\n    }\n    \n    setIsLoading(true);\n    try {\n      const response = await fetch(`/api/documents/${documentId}/invite`, {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${getAuthToken()}`\n        },\n        body: JSON.stringify({\n          emails: validEmails,\n          accessLevel,\n          message: '함께 BPMN 문서를 편집해보세요!'\n        })\n      });\n      \n      const data = await response.json();\n      \n      // 결과 표시\n      const successCount = data.results.filter(r => r.status === 'invited' || r.status === 'access_granted').length;\n      toast.success(`${successCount}명에게 초대를 발송했습니다.`);\n      \n      setInviteEmails(['']);\n      \n    } catch (error) {\n      toast.error('초대 발송에 실패했습니다.');\n    } finally {\n      setIsLoading(false);\n    }\n  };\n  \n  return (\n    <Dialog open={isOpen} onClose={onClose} maxWidth=\"md\" fullWidth>\n      <DialogTitle>\n        문서 공유\n        <IconButton onClick={onClose} style={{ float: 'right' }}>\n          <CloseIcon />\n        </IconButton>\n      </DialogTitle>\n      \n      <DialogContent>\n        <Tabs value={shareType} onChange={(e, value) => setShareType(value)}>\n          <Tab label=\"링크 공유\" value=\"link\" />\n          <Tab label=\"이메일 초대\" value=\"email\" />\n        </Tabs>\n        \n        <Box mt={3}>\n          <FormControl fullWidth margin=\"normal\">\n            <InputLabel>접근 권한</InputLabel>\n            <Select\n              value={accessLevel}\n              onChange={(e) => setAccessLevel(e.target.value as 'viewer' | 'editor')}\n            >\n              <MenuItem value=\"viewer\">\n                <ListItemIcon><VisibilityIcon /></ListItemIcon>\n                뷰어 - 읽기 및 댓글만 가능\n              </MenuItem>\n              <MenuItem value=\"editor\">\n                <ListItemIcon><EditIcon /></ListItemIcon>\n                편집자 - 읽기, 쓰기, 댓글 가능\n              </MenuItem>\n            </Select>\n          </FormControl>\n        </Box>\n        \n        {shareType === 'link' ? (\n          <LinkSharePanel\n            settings={settings}\n            onSettingsChange={setSettings}\n            shareUrl={shareUrl}\n            onCreateLink={handleCreateShareLink}\n            isLoading={isLoading}\n          />\n        ) : (\n          <EmailInvitePanel\n            emails={inviteEmails}\n            onEmailsChange={setInviteEmails}\n            onInvite={handleInviteByEmail}\n            isLoading={isLoading}\n          />\n        )}\n      </DialogContent>\n    </Dialog>\n  );\n};\n```\n\n### 4.2 공유 문서 뷰어 컴포넌트\n```typescript\nconst SharedDocumentViewer: React.FC<{ shareToken: string }> = ({ shareToken }) => {\n  const [document, setDocument] = useState(null);\n  const [accessLevel, setAccessLevel] = useState<'viewer' | 'editor'>('viewer');\n  const [settings, setSettings] = useState({});\n  const [requiresPassword, setRequiresPassword] = useState(false);\n  const [requiresAuth, setRequiresAuth] = useState(false);\n  const [password, setPassword] = useState('');\n  const [isLoading, setIsLoading] = useState(true);\n  \n  const handleAccess = async (passwordAttempt?: string) => {\n    try {\n      const response = await fetch(`/api/share/${shareToken}/access`, {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'Authorization': getAuthToken() ? `Bearer ${getAuthToken()}` : undefined\n        },\n        body: JSON.stringify({\n          password: passwordAttempt || password\n        })\n      });\n      \n      if (response.status === 401) {\n        const data = await response.json();\n        if (data.requiresPassword) {\n          setRequiresPassword(true);\n        } else if (data.requiresAuth) {\n          setRequiresAuth(true);\n        }\n        return;\n      }\n      \n      if (!response.ok) {\n        throw new Error('Access denied');\n      }\n      \n      const data = await response.json();\n      setDocument(data.document);\n      setAccessLevel(data.accessLevel);\n      setSettings(data.settings);\n      \n      // WebSocket 연결 설정 (읽기 전용 또는 편집 가능)\n      initializeCollaborativeEditor(data.document._id, data.accessLevel);\n      \n    } catch (error) {\n      toast.error('문서에 접근할 수 없습니다.');\n    } finally {\n      setIsLoading(false);\n    }\n  };\n  \n  useEffect(() => {\n    handleAccess();\n  }, [shareToken]);\n  \n  if (isLoading) {\n    return <CircularProgress />;\n  }\n  \n  if (requiresPassword) {\n    return (\n      <PasswordPrompt\n        onSubmit={handleAccess}\n        password={password}\n        onPasswordChange={setPassword}\n      />\n    );\n  }\n  \n  if (requiresAuth) {\n    return <AuthRequired />;\n  }\n  \n  if (!document) {\n    return <div>문서를 찾을 수 없습니다.</div>;\n  }\n  \n  return (\n    <div className=\"shared-document-viewer\">\n      <div className=\"viewer-header\">\n        <div className=\"document-info\">\n          <h2>{document.name}</h2>\n          <Chip \n            label={accessLevel === 'editor' ? '편집 가능' : '읽기 전용'}\n            color={accessLevel === 'editor' ? 'primary' : 'default'}\n            size=\"small\"\n          />\n        </div>\n        \n        {settings.allowDownload && (\n          <Button \n            startIcon={<DownloadIcon />}\n            onClick={() => downloadDocument(document)}\n          >\n            다운로드\n          </Button>\n        )}\n      </div>\n      \n      <BpmnCollaborativeEditor\n        documentId={document._id}\n        initialBpmn={document.bpmnXml}\n        mode={accessLevel}\n        enableComments={settings.allowComment}\n        isSharedMode={true}\n      />\n    </div>\n  );\n};\n```\n\n## 5. 보안 고려사항\n\n### 5.1 접근 제어\n```typescript\n// middleware/share-access.middleware.ts\nexport const validateShareAccess = async (req: Request, res: Response, next: NextFunction) => {\n  const { shareToken } = req.params;\n  \n  try {\n    const share = await DocumentShare.findOne({\n      shareToken,\n      isActive: true\n    });\n    \n    if (!share) {\n      return res.status(404).json({ error: 'Share not found' });\n    }\n    \n    // 만료 확인\n    if (share.settings.expiresAt && new Date() > share.settings.expiresAt) {\n      return res.status(410).json({ error: 'Share expired' });\n    }\n    \n    // IP 기반 접근 제한 (옵션)\n    if (share.settings.allowedIPs && \n        !share.settings.allowedIPs.includes(req.ip)) {\n      return res.status(403).json({ error: 'IP not allowed' });\n    }\n    \n    req.share = share;\n    next();\n    \n  } catch (error) {\n    res.status(500).json({ error: 'Server error' });\n  }\n};\n```\n\n### 5.2 WebSocket 보안\n```typescript\n// websocket/share-connection.ts\nexport class ShareWebSocketHandler {\n  async handleShareConnection(ws: WebSocket, shareToken: string, accessLevel: string) {\n    const share = await DocumentShare.findOne({ \n      shareToken, \n      isActive: true \n    });\n    \n    if (!share) {\n      ws.close(1008, 'Invalid share token');\n      return;\n    }\n    \n    // 읽기 전용 모드로 WebSocket 연결 설정\n    setupWSConnection(ws, null, {\n      docName: share.documentId.toString(),\n      gc: true,\n      \n      // 쓰기 권한 제한\n      authenticate: () => true,\n      authorize: (docName, ydoc, ws) => {\n        return accessLevel === 'editor';\n      },\n      \n      // 읽기 전용 모드에서는 업데이트 무시\n      persistDoc: accessLevel === 'editor' ? undefined : () => {}\n    });\n  }\n}\n```\n\n이 설계는 안전하고 유연한 문서 공유 기능을 제공하며, 다양한 공유 시나리오를 지원합니다.