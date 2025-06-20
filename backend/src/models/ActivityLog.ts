import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityLog {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  documentId?: Types.ObjectId;
  userId: Types.ObjectId;
  action: string;
  details: {
    elementId?: string;
    elementType?: string;
    oldValue?: any;
    newValue?: any;
    description?: string;
  };
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export type ActivityLogDocument = Document & IActivityLog;

const activityLogSchema = new Schema<IActivityLog>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'BpmnDocument'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Project actions
      'project_created',
      'project_updated',
      'project_deleted',
      'project_shared',
      
      // Document actions
      'document_created',
      'document_updated',
      'document_deleted',
      'document_shared',
      'document_exported',
      
      // BPMN element actions
      'element_created',
      'element_updated',
      'element_deleted',
      'element_moved',
      
      // Comment actions
      'comment_created',
      'comment_updated',
      'comment_deleted',
      'comment_resolved',
      
      // User actions
      'user_joined',
      'user_left',
      'permission_granted',
      'permission_revoked'
    ]
  },
  details: {
    elementId: String,
    elementType: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    description: String
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Indexes
activityLogSchema.index({ projectId: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ documentId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

// TTL index to automatically delete old logs (30 days)
activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const ActivityLog = model<IActivityLog>('ActivityLog', activityLogSchema);