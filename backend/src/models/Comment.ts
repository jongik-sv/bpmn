import { Schema, model, Document, ObjectId } from 'mongoose';

export interface IComment extends Document {
  _id: ObjectId;
  documentId: ObjectId;
  elementId?: string;
  parentId?: ObjectId;
  authorId: ObjectId;
  content: string;
  position?: {
    x: number;
    y: number;
  };
  status: 'active' | 'resolved' | 'deleted';
  mentions: ObjectId[];
  reactions: Array<{
    userId: ObjectId;
    type: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const reactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['like', 'love', 'laugh', 'angry', 'sad', 'thumbsup', 'thumbsdown']
  }
}, { _id: false });

const commentSchema = new Schema<IComment>({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'BpmnDocument',
    required: true
  },
  elementId: {
    type: String,
    trim: true
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  },
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  position: {
    x: {
      type: Number
    },
    y: {
      type: Number
    }
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'deleted'],
    default: 'active'
  },
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [reactionSchema]
}, {
  timestamps: true
});

// Indexes
commentSchema.index({ documentId: 1, elementId: 1 });
commentSchema.index({ authorId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });
commentSchema.index({ status: 1, createdAt: -1 });

// Virtual for reply count
commentSchema.virtual('replyCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentId',
  count: true,
  match: { status: 'active' }
});

// Method to add reaction
commentSchema.methods.addReaction = function(userId: ObjectId, reactionType: string): void {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    (reaction: any) => !reaction.userId.equals(userId)
  );
  
  // Add new reaction
  this.reactions.push({
    userId,
    type: reactionType
  });
};

// Method to remove reaction
commentSchema.methods.removeReaction = function(userId: ObjectId): void {
  this.reactions = this.reactions.filter(
    (reaction: any) => !reaction.userId.equals(userId)
  );
};

export const Comment = model<IComment>('Comment', commentSchema);