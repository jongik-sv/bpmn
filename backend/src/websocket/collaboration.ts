import { Types, ObjectId } from 'mongoose';
import { User } from '../models/User';
import { Comment } from '../models/Comment';
import { ActivityLog } from '../models/ActivityLog';

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
  lastSeen: Date;
  accessLevel: 'owner' | 'editor' | 'viewer';
}

export interface CollaborativeComment {
  id: string;
  elementId?: string;
  content: string;
  position?: { x: number; y: number };
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  mentions: string[];
  status: 'active' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
  replies?: CollaborativeComment[];
}

export interface CollaborativeActivity {
  id: string;
  userId: string;
  action: string;
  elementId?: string;
  elementType?: string;
  description: string;
  timestamp: Date;
}

export class CollaborationManager {
  private documentUsers: Map<string, Map<string, CollaborativeUser>> = new Map();
  private documentComments: Map<string, CollaborativeComment[]> = new Map();
  private documentActivities: Map<string, CollaborativeActivity[]> = new Map();

  // User management
  addUser(documentId: string, user: CollaborativeUser): void {
    if (!this.documentUsers.has(documentId)) {
      this.documentUsers.set(documentId, new Map());
    }

    const users = this.documentUsers.get(documentId)!;
    users.set(user.id, {
      ...user,
      isActive: true,
      lastSeen: new Date()
    });
  }

  removeUser(documentId: string, userId: string): void {
    const users = this.documentUsers.get(documentId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.documentUsers.delete(documentId);
      }
    }
  }

  updateUserCursor(documentId: string, userId: string, cursor: any): void {
    const users = this.documentUsers.get(documentId);
    if (users && users.has(userId)) {
      const user = users.get(userId)!;
      user.cursor = cursor;
      user.lastSeen = new Date();
      users.set(userId, user);
    }
  }

  updateUserSelection(documentId: string, userId: string, selection: string[]): void {
    const users = this.documentUsers.get(documentId);
    if (users && users.has(userId)) {
      const user = users.get(userId)!;
      user.selection = selection;
      user.lastSeen = new Date();
      users.set(userId, user);
    }
  }

  getDocumentUsers(documentId: string): CollaborativeUser[] {
    const users = this.documentUsers.get(documentId);
    if (!users) return [];

    // Clean up inactive users (haven't been seen in 30 seconds)
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30000);

    users.forEach((user, userId) => {
      if (user.lastSeen < cutoff) {
        user.isActive = false;
      }
    });

    return Array.from(users.values()).filter(user => user.isActive);
  }

  // Comment management
  async addComment(
    documentId: string,
    projectId: Types.ObjectId,
    authorId: Types.ObjectId,
    commentData: {
      content: string;
      elementId?: string;
      position?: { x: number; y: number };
      mentions?: Types.ObjectId[];
    }
  ): Promise<CollaborativeComment> {
    // Save to database
    const comment = new Comment({
      documentId: new Types.ObjectId(documentId),
      authorId,
      content: commentData.content,
      elementId: commentData.elementId,
      position: commentData.position,
      mentions: commentData.mentions || []
    });

    await comment.save();
    await comment.populate('authorId', 'username displayName avatar');

    // Create collaborative comment
    const collaborativeComment: CollaborativeComment = {
      id: comment._id.toString(),
      elementId: comment.elementId,
      content: comment.content,
      position: comment.position,
      author: {
        id: comment.authorId._id.toString(),
        name: (comment.authorId as any).displayName,
        avatar: (comment.authorId as any).avatar
      },
      mentions: comment.mentions.map(m => m.toString()),
      status: comment.status as 'active' | 'resolved',
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    };

    // Add to memory cache
    if (!this.documentComments.has(documentId)) {
      this.documentComments.set(documentId, []);
    }
    this.documentComments.get(documentId)!.push(collaborativeComment);

    // Log activity
    await this.logActivity(
      projectId,
      new Types.ObjectId(documentId) as Types.ObjectId,
      authorId,
      'comment_created',
      {
        commentId: comment._id.toString(),
        elementId: commentData.elementId,
        description: `Comment added: "${commentData.content.substring(0, 50)}..."`
      }
    );

    return collaborativeComment;
  }

  async updateComment(
    commentId: string,
    userId: Types.ObjectId,
    updates: { content?: string; status?: 'active' | 'resolved' }
  ): Promise<CollaborativeComment | null> {
    const comment = await Comment.findById(commentId).populate('authorId', 'username displayName avatar');
    
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check if user can update comment (author or has permissions)
    if (!comment.authorId._id.equals(userId)) {
      throw new Error('Access denied');
    }

    // Update comment
    if (updates.content) comment.content = updates.content;
    if (updates.status) comment.status = updates.status;

    await comment.save();

    // Update memory cache
    const documentId = comment.documentId.toString();
    const comments = this.documentComments.get(documentId);
    if (comments) {
      const index = comments.findIndex(c => c.id === commentId);
      if (index >= 0) {
        comments[index] = {
          ...comments[index],
          content: comment.content,
          status: comment.status as 'active' | 'resolved',
          updatedAt: comment.updatedAt
        };
      }
    }

    return comments?.find(c => c.id === commentId) || null;
  }

  async getDocumentComments(documentId: string): Promise<CollaborativeComment[]> {
    // Check cache first
    if (this.documentComments.has(documentId)) {
      return this.documentComments.get(documentId)!;
    }

    // Load from database
    const comments = await Comment.find({
      documentId: new Types.ObjectId(documentId),
      status: { $ne: 'deleted' }
    })
    .populate('authorId', 'username displayName avatar')
    .sort({ createdAt: 1 });

    const collaborativeComments: CollaborativeComment[] = comments.map(comment => ({
      id: comment._id.toString(),
      elementId: comment.elementId,
      content: comment.content,
      position: comment.position,
      author: {
        id: comment.authorId._id.toString(),
        name: (comment.authorId as any).displayName,
        avatar: (comment.authorId as any).avatar
      },
      mentions: comment.mentions.map(m => m.toString()),
      status: comment.status as 'active' | 'resolved',
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    }));

    // Cache comments
    this.documentComments.set(documentId, collaborativeComments);

    return collaborativeComments;
  }

  // Activity management
  async logActivity(
    projectId: Types.ObjectId,
    documentId: Types.ObjectId,
    userId: Types.ObjectId,
    action: string,
    details: any
  ): Promise<void> {
    try {
      const activity = new ActivityLog({
        projectId,
        documentId,
        userId,
        action,
        details,
        ipAddress: '0.0.0.0', // Will be set by the calling context
        userAgent: 'collaboration-manager',
        timestamp: new Date()
      });

      await activity.save();

      // Add to memory cache
      const docId = documentId.toString();
      if (!this.documentActivities.has(docId)) {
        this.documentActivities.set(docId, []);
      }

      const collaborativeActivity: CollaborativeActivity = {
        id: activity._id.toString(),
        userId: userId.toString(),
        action,
        elementId: details.elementId,
        elementType: details.elementType,
        description: details.description || action,
        timestamp: activity.timestamp
      };

      const activities = this.documentActivities.get(docId)!;
      activities.unshift(collaborativeActivity);

      // Keep only last 100 activities in memory
      if (activities.length > 100) {
        activities.splice(100);
      }

    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async getDocumentActivities(documentId: string, limit: number = 50): Promise<CollaborativeActivity[]> {
    // Check cache first
    if (this.documentActivities.has(documentId)) {
      const cached = this.documentActivities.get(documentId)!;
      return cached.slice(0, limit);
    }

    // Load from database
    const activities = await ActivityLog.find({
      documentId: new Types.ObjectId(documentId)
    })
    .populate('userId', 'username displayName')
    .sort({ timestamp: -1 })
    .limit(limit);

    const collaborativeActivities: CollaborativeActivity[] = activities.map(activity => ({
      id: activity._id.toString(),
      userId: activity.userId.toString(),
      action: activity.action,
      elementId: activity.details?.elementId,
      elementType: activity.details?.elementType,
      description: activity.details?.description || activity.action,
      timestamp: activity.timestamp
    }));

    // Cache activities
    this.documentActivities.set(documentId, collaborativeActivities);

    return collaborativeActivities;
  }

  // Conflict resolution
  resolveElementConflict(localElement: any, remoteElement: any): any {
    // Simple last-write-wins strategy
    // In a real implementation, you might want more sophisticated conflict resolution
    
    if (!localElement.lastModified || !remoteElement.lastModified) {
      return remoteElement; // Default to remote if no timestamp
    }

    if (new Date(localElement.lastModified) > new Date(remoteElement.lastModified)) {
      return localElement;
    }

    return remoteElement;
  }

  // Cleanup old data
  cleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 300000); // 5 minutes

    // Clean up inactive users
    this.documentUsers.forEach((users, documentId) => {
      users.forEach((user, userId) => {
        if (user.lastSeen < cutoff) {
          users.delete(userId);
        }
      });

      if (users.size === 0) {
        this.documentUsers.delete(documentId);
      }
    });

    // Clean up old activities from memory (keep only recent ones)
    this.documentActivities.forEach((activities, documentId) => {
      const filtered = activities.filter(activity => 
        activity.timestamp > new Date(now.getTime() - 3600000) // 1 hour
      );
      
      if (filtered.length === 0) {
        this.documentActivities.delete(documentId);
      } else {
        this.documentActivities.set(documentId, filtered);
      }
    });
  }

  // Get collaboration statistics
  getStats(): any {
    return {
      activeDocuments: this.documentUsers.size,
      totalUsers: Array.from(this.documentUsers.values())
        .reduce((sum, users) => sum + users.size, 0),
      totalComments: Array.from(this.documentComments.values())
        .reduce((sum, comments) => sum + comments.length, 0),
      totalActivities: Array.from(this.documentActivities.values())
        .reduce((sum, activities) => sum + activities.length, 0)
    };
  }
}

// Singleton instance
export const collaborationManager = new CollaborationManager();

// Cleanup timer
setInterval(() => {
  collaborationManager.cleanup();
}, 60000); // Clean up every minute