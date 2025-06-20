import { Types, ObjectId } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DocumentShare, IDocumentShare } from '../models/DocumentShare';
import { ShareAccess } from '../models/ShareAccess';
import { BpmnDocument } from '../models/Document';
import { ProjectService } from './project.service';
import { config } from '../config/environment';

export interface CreateShareData {
  accessLevel: 'editor' | 'viewer';
  shareType: 'link' | 'email';
  settings: {
    requireAuth?: boolean;
    allowDownload?: boolean;
    allowComment?: boolean;
    expiresAt?: Date;
    accessLimit?: number;
    password?: string;
  };
}

export interface ShareAccessData {
  password?: string;
  ipAddress: string;
  userAgent: string;
  userId?: Types.ObjectId;
}

export class DocumentShareService {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  async createShare(documentId: Types.ObjectId, userId: Types.ObjectId, shareData: CreateShareData): Promise<IDocumentShare> {
    // Get document and check permissions
    const document = await BpmnDocument.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'share');
    if (!hasPermission) {
      throw new Error('Share permission denied');
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (shareData.settings.password) {
      hashedPassword = await bcrypt.hash(shareData.settings.password, 10);
    }

    // Create share
    const share = new DocumentShare({
      documentId,
      createdBy: userId,
      shareType: shareData.shareType,
      accessLevel: shareData.accessLevel,
      settings: {
        ...shareData.settings,
        password: hashedPassword
      }
    });

    await share.save();
    return share;
  }

  async getDocumentShares(documentId: Types.ObjectId, userId: Types.ObjectId): Promise<IDocumentShare[]> {
    // Get document and check permissions
    const document = await BpmnDocument.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    const shares = await DocumentShare.find({
      documentId,
      isActive: true
    })
    .populate('createdBy', 'username displayName')
    .sort({ createdAt: -1 });

    return shares;
  }

  async updateShare(shareId: Types.ObjectId, userId: Types.ObjectId, updateData: Partial<CreateShareData>): Promise<IDocumentShare> {
    const share = await DocumentShare.findById(shareId);
    if (!share) {
      throw new Error('Share not found');
    }

    // Check if user created the share or has permission to the document
    const document = await BpmnDocument.findById(share.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'share');
    if (!hasPermission && !share.createdBy.equals(userId)) {
      throw new Error('Access denied');
    }

    // Update share
    if (updateData.accessLevel) {
      share.accessLevel = updateData.accessLevel;
    }

    if (updateData.settings) {
      // Hash new password if provided
      if (updateData.settings.password) {
        updateData.settings.password = await bcrypt.hash(updateData.settings.password, 10);
      }

      Object.assign(share.settings, updateData.settings);
    }

    await share.save();
    return share;
  }

  async deleteShare(shareId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    const share = await DocumentShare.findById(shareId);
    if (!share) {
      throw new Error('Share not found');
    }

    // Check if user created the share or has permission to the document
    const document = await BpmnDocument.findById(share.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'share');
    if (!hasPermission && !share.createdBy.equals(userId)) {
      throw new Error('Access denied');
    }

    await DocumentShare.findByIdAndUpdate(shareId, { isActive: false });
  }

  async accessSharedDocument(shareToken: string, accessData: ShareAccessData): Promise<{
    document: any;
    accessLevel: string;
    settings: any;
    accessToken: string;
  }> {
    const share = await DocumentShare.findOne({
      shareToken,
      isActive: true
    }).populate('documentId');

    if (!share) {
      throw new Error('Share link not found or expired');
    }

    // Check if share is valid
    if (!(share as any).isValid()) {
      throw new Error('Share link has expired or access limit exceeded');
    }

    // Check password if required
    if (share.settings.password) {
      if (!accessData.password) {
        throw new Error('Password required');
      }

      const isValidPassword = await bcrypt.compare(accessData.password, share.settings.password);
      if (!isValidPassword) {
        throw new Error('Invalid password');
      }
    }

    // Check authentication requirement
    if (share.settings.requireAuth && !accessData.userId) {
      throw new Error('Authentication required');
    }

    // Log access
    const accessLog = new ShareAccess({
      shareId: share._id,
      documentId: share.documentId._id,
      userId: accessData.userId,
      ipAddress: accessData.ipAddress,
      userAgent: accessData.userAgent
    });

    await accessLog.save();

    // Increment access count
    await (share as any).incrementAccess();

    // Generate access token
    const accessToken = this.generateAccessToken(share._id, accessData.userId);

    return {
      document: share.documentId,
      accessLevel: share.accessLevel,
      settings: {
        allowDownload: share.settings.allowDownload,
        allowComment: share.settings.allowComment
      },
      accessToken
    };
  }

  async getShareStats(documentId: Types.ObjectId, userId: Types.ObjectId): Promise<any> {
    // Check permissions
    const document = await BpmnDocument.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    const shares = await DocumentShare.find({ documentId, isActive: true });
    const shareIds = shares.map(s => s._id);

    // Get access statistics
    const accessStats = await ShareAccess.aggregate([
      { $match: { shareId: { $in: shareIds } } },
      {
        $group: {
          _id: '$shareId',
          totalAccess: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          lastAccessed: { $max: '$accessedAt' },
          userAccess: {
            $push: {
              $cond: [
                { $ne: ['$userId', null] },
                '$userId',
                '$$REMOVE'
              ]
            }
          }
        }
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
          authenticatedUsers: { $size: '$userAccess' }
        }
      }
    ]);

    const statsMap = new Map(accessStats.map(stat => [stat._id.toString(), stat]));

    const result = shares.map(share => ({
      shareId: share._id,
      shareToken: share.shareToken,
      shareUrl: share.shareUrl,
      accessLevel: share.accessLevel,
      createdAt: share.createdAt,
      settings: {
        ...share.settings,
        password: share.settings.password ? '[PROTECTED]' : undefined
      },
      stats: {
        totalAccess: statsMap.get(share._id.toString())?.totalAccess || 0,
        uniqueVisitors: statsMap.get(share._id.toString())?.uniqueVisitorCount || 0,
        authenticatedUsers: statsMap.get(share._id.toString())?.authenticatedUsers || 0,
        lastAccessed: statsMap.get(share._id.toString())?.lastAccessed
      }
    }));

    return { shares: result };
  }

  async verifyShareAccess(shareToken: string, accessToken: string): Promise<{
    shareId: Types.ObjectId;
    userId?: Types.ObjectId;
    accessLevel: string;
  }> {
    try {
      const decoded = jwt.verify(accessToken, config.jwt.secret) as any;
      
      if (decoded.type !== 'share_access') {
        throw new Error('Invalid access token');
      }

      const share = await DocumentShare.findOne({
        _id: decoded.shareId,
        shareToken,
        isActive: true
      });

      if (!share || !(share as any).isValid()) {
        throw new Error('Share access expired');
      }

      return {
        shareId: share._id,
        userId: decoded.userId,
        accessLevel: share.accessLevel
      };

    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  async logShareAction(shareId: Types.ObjectId, action: string, details?: any): Promise<void> {
    try {
      const share = await DocumentShare.findById(shareId);
      if (!share) return;

      // Find the most recent access log for this share
      const accessLog = await ShareAccess.findOne({ shareId })
        .sort({ accessedAt: -1 });

      if (accessLog) {
        (accessLog as any).addAction(action, details);
        await accessLog.save();
      }
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log share action:', error);
    }
  }

  private generateAccessToken(shareId: Types.ObjectId, userId?: Types.ObjectId): string {
    return jwt.sign(
      {
        shareId: shareId.toString(),
        userId: userId?.toString(),
        type: 'share_access'
      },
      config.jwt.secret,
      { expiresIn: '24h' }
    );
  }
}