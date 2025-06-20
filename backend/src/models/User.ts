import { Schema, model, Document, ObjectId } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: ObjectId;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  passwordHash: string;
  provider: 'local' | 'google' | 'github';
  providerId?: string;
  emailVerified: boolean;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface IUserMethods {
  comparePassword(password: string): Promise<boolean>;
  toJSON(): any;
}

const userSchema = new Schema<IUser, {}, IUserMethods>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens and underscores']
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  avatar: {
    type: String,
    default: null
  },
  passwordHash: {
    type: String,
    required: function(this: IUser) {
      return this.provider === 'local';
    }
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'github'],
    default: 'local'
  },
  providerId: {
    type: String,
    sparse: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'ko'
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ provider: 1, providerId: 1 });

// Methods
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

// Pre-save hook for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

export const User = model<IUser, {}, IUserMethods>('User', userSchema);