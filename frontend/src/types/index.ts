import { ObjectId } from 'bson';

// User types
export interface User {
  _id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  provider: 'local' | 'google' | 'github';
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// Project types
export interface Project {
  _id: string;
  name: string;
  description?: string;
  ownerId: string;
  visibility: 'private' | 'public' | 'team';
  settings: {
    allowComments: boolean;
    allowExport: boolean;
    autoSave: boolean;
    autoSaveInterval: number;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

// Document types
export interface BpmnDocument {
  _id: string;
  projectId: string;
  name: string;
  bpmnXml: string;
  metadata: {
    elementCount: number;
    lastModifiedBy: string;
    version: number;
    fileSize: number;
  };
  snapshots: DocumentSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSnapshot {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

// Permission types
export interface Permission {
  _id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
    share: boolean;
    comment: boolean;
  };
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
}

// Share types
export interface DocumentShare {
  _id: string;
  documentId: string;
  shareToken: string;
  createdBy: string;
  shareType: 'link' | 'email';
  accessLevel: 'editor' | 'viewer';
  settings: {
    requireAuth: boolean;
    allowDownload: boolean;
    allowComment: boolean;
    expiresAt?: string;
    accessLimit?: number;
    currentAccess: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  shareUrl?: string;
}

// Comment types
export interface Comment {
  _id: string;
  documentId: string;
  elementId?: string;
  parentId?: string;
  authorId: string;
  content: string;
  position?: {
    x: number;
    y: number;
  };
  status: 'active' | 'resolved' | 'deleted';
  mentions: string[];
  reactions: Array<{
    userId: string;
    type: string;
  }>;
  createdAt: string;
  updatedAt: string;
  author?: User;
  replies?: Comment[];
}

// Collaboration types
export interface CollaborativeUser {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    elementId?: string;
  };
  selection?: string[];
  isActive: boolean;
  lastSeen: string;
  accessLevel: 'owner' | 'editor' | 'viewer';
}

export interface ActivityLog {
  _id: string;
  projectId: string;
  documentId?: string;
  userId: string;
  action: string;
  details: {
    elementId?: string;
    elementType?: string;
    oldValue?: any;
    newValue?: any;
    description?: string;
  };
  timestamp: string;
}

// API Response types
export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Form types
export interface CreateProjectForm {
  name: string;
  description?: string;
  visibility: 'private' | 'public' | 'team';
  tags?: string[];
}

export interface CreateDocumentForm {
  name: string;
  bpmnXml?: string;
}

export interface CreateShareForm {
  accessLevel: 'editor' | 'viewer';
  shareType: 'link' | 'email';
  settings: {
    requireAuth?: boolean;
    allowDownload?: boolean;
    allowComment?: boolean;
    expiresAt?: string;
    accessLimit?: number;
    password?: string;
  };
}

export interface InviteUsersForm {
  emails: string[];
  accessLevel: 'editor' | 'viewer';
  message?: string;
}

export interface CreateCommentForm {
  content: string;
  elementId?: string;
  parentId?: string;
  position?: {
    x: number;
    y: number;
  };
  mentions?: string[];
}

// UI types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// BPMN Editor types
export interface BpmnElement {
  id: string;
  type: string;
  businessObject: any;
  di: any;
}

export interface BpmnEditorConfig {
  container: HTMLElement;
  keyboard?: { bindTo: HTMLElement };
  additionalModules?: any[];
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp: string;
}

export interface CursorUpdateMessage extends WebSocketMessage {
  type: 'cursor-update';
  payload: {
    userId: string;
    cursor: {
      x: number;
      y: number;
      elementId?: string;
    };
  };
}

export interface UserJoinedMessage extends WebSocketMessage {
  type: 'user-joined';
  payload: {
    user: CollaborativeUser;
  };
}

export interface UserLeftMessage extends WebSocketMessage {
  type: 'user-left';
  payload: {
    userId: string;
  };
}

export interface CommentAddedMessage extends WebSocketMessage {
  type: 'comment-added';
  payload: {
    comment: Comment;
  };
}