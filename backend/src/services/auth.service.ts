import jwt from 'jsonwebtoken';
import { User, IUser, UserDocument } from '../models/User';
import { config } from '../config/environment';
import { Types } from 'mongoose';

export interface LoginResult {
  user: IUser;
  token: string;
}

export interface RegisterData {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export class AuthService {
  generateToken(userId: Types.ObjectId): string {
    const payload = { userId: userId.toString() };
    const secret = config.jwt.secret as string;
    
    return jwt.sign(payload, secret, { expiresIn: '24h' });
  }

  async verifyToken(token: string): Promise<IUser | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      const user = await User.findById(decoded.userId).select('-passwordHash');
      return user;
    } catch (error) {
      return null;
    }
  }

  async register(userData: RegisterData): Promise<LoginResult> {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: userData.email },
        { username: userData.username }
      ]
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new Error('Email already registered');
      }
      if (existingUser.username === userData.username) {
        throw new Error('Username already taken');
      }
    }

    // Create new user
    const user = new User({
      email: userData.email,
      username: userData.username,
      displayName: userData.displayName,
      passwordHash: userData.password, // Will be hashed in pre-save hook
      provider: 'local'
    });

    await user.save();

    // Generate token
    const token = this.generateToken(user._id);

    return {
      user: user.toJSON(),
      token
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }) as UserDocument | null;
    
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login  
    (user as any).lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = this.generateToken(user._id);

    return {
      user: user.toJSON(),
      token
    };
  }

  async updateProfile(userId: Types.ObjectId, updateData: Partial<IUser>): Promise<IUser> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async changePassword(userId: Types.ObjectId, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId) as UserDocument | null;
    
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    (user as any).passwordHash = newPassword; // Will be hashed in pre-save hook
    await user.save();
  }

  async getUserById(userId: Types.ObjectId): Promise<IUser | null> {
    return User.findById(userId).select('-passwordHash') as Promise<IUser | null>;
  }

  async searchUsers(query: string, limit: number = 10): Promise<IUser[]> {
    const searchRegex = new RegExp(query, 'i');
    
    return User.find({
      $or: [
        { username: searchRegex },
        { displayName: searchRegex },
        { email: searchRegex }
      ]
    })
    .select('username displayName email avatar')
    .limit(limit) as Promise<IUser[]>;
  }
}