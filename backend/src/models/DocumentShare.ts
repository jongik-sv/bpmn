import { Schema, model, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IDocumentShare {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  shareToken: string;
  createdBy: Types.ObjectId;
  shareType: 'link' | 'email';
  accessLevel: 'editor' | 'viewer';
  settings: {
    requireAuth: boolean;
    allowDownload: boolean;
    allowComment: boolean;
    expiresAt?: Date;
    accessLimit?: number;
    currentAccess: number;
    password?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  shareUrl: string; // Virtual property
}

export interface IDocumentShareMethods {
  isValid(): boolean;
  incrementAccess(): Promise<void>;
}

export type DocumentShareDocument = Document & IDocumentShare & IDocumentShareMethods;

const documentShareSchema = new Schema<IDocumentShare>({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'BpmnDocument',
    required: true
  },
  shareToken: {
    type: String,
    required: true,
    default: () => uuidv4().replace(/-/g, '')
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shareType: {
    type: String,
    enum: ['link', 'email'],
    required: true
  },
  accessLevel: {
    type: String,
    enum: ['editor', 'viewer'],
    required: true
  },
  settings: {
    requireAuth: {
      type: Boolean,
      default: false
    },
    allowDownload: {
      type: Boolean,
      default: true
    },
    allowComment: {
      type: Boolean,
      default: true
    },
    expiresAt: {
      type: Date
    },
    accessLimit: {
      type: Number,
      min: 1
    },
    currentAccess: {
      type: Number,
      default: 0,
      min: 0
    },
    password: {
      type: String
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
documentShareSchema.index({ shareToken: 1 }, { unique: true });
documentShareSchema.index({ documentId: 1, isActive: 1 });
documentShareSchema.index({ createdBy: 1, createdAt: -1 });
documentShareSchema.index({ 'settings.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Method to check if share is valid
documentShareSchema.methods.isValid = function(): boolean {
  if (!this.isActive) return false;
  
  // Check expiration
  if (this.settings.expiresAt && new Date() > this.settings.expiresAt) {
    return false;
  }
  
  // Check access limit
  if (this.settings.accessLimit && this.settings.currentAccess >= this.settings.accessLimit) {
    return false;
  }
  
  return true;
};

// Method to increment access count
documentShareSchema.methods.incrementAccess = async function(): Promise<void> {
  this.settings.currentAccess += 1;
  await this.save();
};

// Virtual for share URL
documentShareSchema.virtual('shareUrl').get(function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/share/${this.shareToken}`;
});

export const DocumentShare = model<IDocumentShare>('DocumentShare', documentShareSchema);