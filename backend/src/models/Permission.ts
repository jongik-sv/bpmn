import { Schema, model, Document, Types } from 'mongoose';

export interface IPermission {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
    share: boolean;
    comment: boolean;
  };
  grantedBy: Types.ObjectId;
  grantedAt: Date;
  expiresAt?: Date;
}

export type PermissionDocument = Document & IPermission;

const permissionSchema = new Schema<IPermission>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'editor', 'viewer', 'commenter'],
    required: true
  },
  permissions: {
    read: {
      type: Boolean,
      default: true
    },
    write: {
      type: Boolean,
      default: false
    },
    delete: {
      type: Boolean,
      default: false
    },
    share: {
      type: Boolean,
      default: false
    },
    comment: {
      type: Boolean,
      default: false
    }
  },
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  }
});

// Indexes
permissionSchema.index({ projectId: 1, userId: 1 }, { unique: true });
permissionSchema.index({ userId: 1, role: 1 });
permissionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static methods for role-based permissions
permissionSchema.statics.getRolePermissions = function(role: string) {
  const rolePermissions = {
    owner: {
      read: true,
      write: true,
      delete: true,
      share: true,
      comment: true
    },
    editor: {
      read: true,
      write: true,
      delete: false,
      share: false,
      comment: true
    },
    viewer: {
      read: true,
      write: false,
      delete: false,
      share: false,
      comment: true
    },
    commenter: {
      read: true,
      write: false,
      delete: false,
      share: false,
      comment: true
    }
  };

  return rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.viewer;
};

export const Permission = model<IPermission>('Permission', permissionSchema);