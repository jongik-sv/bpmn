import { Schema, model, Document, ObjectId } from 'mongoose';

export interface IProject extends Document {
  _id: ObjectId;
  name: string;
  description?: string;
  ownerId: ObjectId;
  visibility: 'private' | 'public' | 'team';
  settings: {
    allowComments: boolean;
    allowExport: boolean;
    autoSave: boolean;
    autoSaveInterval: number;
  };
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

const projectSchema = new Schema<IProject>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visibility: {
    type: String,
    enum: ['private', 'public', 'team'],
    default: 'private'
  },
  settings: {
    allowComments: {
      type: Boolean,
      default: true
    },
    allowExport: {
      type: Boolean,
      default: true
    },
    autoSave: {
      type: Boolean,
      default: true
    },
    autoSaveInterval: {
      type: Number,
      default: 30,
      min: 10,
      max: 300
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ ownerId: 1, createdAt: -1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ visibility: 1, updatedAt: -1 });
projectSchema.index({ name: 'text', description: 'text' });

export const Project = model<IProject>('Project', projectSchema);