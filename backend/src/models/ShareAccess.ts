import { Schema, model, Document, ObjectId } from 'mongoose';

export interface IShareAccess extends Document {
  _id: ObjectId;
  shareId: ObjectId;
  documentId: ObjectId;
  userId?: ObjectId;
  ipAddress: string;
  userAgent: string;
  accessedAt: Date;
  sessionDuration?: number;
  actions: Array<{
    type: string;
    timestamp: Date;
    details?: any;
  }>;
}

const actionSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['view', 'edit', 'comment', 'download', 'export']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: {
    type: Schema.Types.Mixed
  }
}, { _id: false });

const shareAccessSchema = new Schema<IShareAccess>({
  shareId: {
    type: Schema.Types.ObjectId,
    ref: 'DocumentShare',
    required: true
  },
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'BpmnDocument',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  accessedAt: {
    type: Date,
    default: Date.now
  },
  sessionDuration: {
    type: Number,
    min: 0
  },
  actions: [actionSchema]
});

// Indexes
shareAccessSchema.index({ shareId: 1, accessedAt: -1 });
shareAccessSchema.index({ documentId: 1, accessedAt: -1 });
shareAccessSchema.index({ ipAddress: 1 });
shareAccessSchema.index({ userId: 1, accessedAt: -1 });

// Method to add action
shareAccessSchema.methods.addAction = function(type: string, details?: any): void {
  this.actions.push({
    type,
    timestamp: new Date(),
    details
  });
};

export const ShareAccess = model<IShareAccess>('ShareAccess', shareAccessSchema);