import { Request, Response } from 'express';
import { DocumentShareService } from '../services/document-share.service';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export class DocumentShareController {
  private shareService: DocumentShareService;

  constructor() {
    this.shareService = new DocumentShareService();
  }

  createShare = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;
      const shareData = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      const share = await this.shareService.createShare(
        new Types.ObjectId(id),
        userId,
        shareData
      );

      logger.info(`Share created for document ${id} by ${req.user!.email}`);

      res.status(201).json({
        message: 'Share created successfully',
        shareId: share._id,
        shareToken: share.shareToken,
        shareUrl: share.shareUrl,
        accessLevel: share.accessLevel,
        settings: {
          ...share.settings,
          password: share.settings.password ? '[PROTECTED]' : undefined
        }
      });
    } catch (error) {
      logger.error('Create share error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Share permission denied') {
          res.status(403).json({ error: 'Share permission denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to create share' });
    }
  };

  getDocumentShares = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      const shares = await this.shareService.getDocumentShares(
        new Types.ObjectId(id),
        userId
      );

      // Remove password from response
      const sanitizedShares = shares.map(share => ({
        ...(share as any).toObject(),
        settings: {
          ...share.settings,
          password: share.settings.password ? '[PROTECTED]' : undefined
        }
      }));

      res.json({ shares: sanitizedShares });
    } catch (error) {
      logger.error('Get document shares error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to get shares' });
    }
  };

  updateShare = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, shareId } = req.params;
      const userId = req.user!._id;
      const updateData = req.body;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(shareId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const share = await this.shareService.updateShare(
        new Types.ObjectId(shareId),
        userId,
        updateData
      );

      logger.info(`Share updated: ${shareId} by ${req.user!.email}`);

      res.json({
        message: 'Share updated successfully',
        share: {
          ...(share as any).toObject(),
          settings: {
            ...share.settings,
            password: share.settings.password ? '[PROTECTED]' : undefined
          }
        }
      });
    } catch (error) {
      logger.error('Update share error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Share not found') {
          res.status(404).json({ error: 'Share not found' });
          return;
        }
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to update share' });
    }
  };

  deleteShare = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, shareId } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(shareId)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      await this.shareService.deleteShare(new Types.ObjectId(shareId), userId);

      logger.info(`Share deleted: ${shareId} by ${req.user!.email}`);

      res.json({ message: 'Share deleted successfully' });
    } catch (error) {
      logger.error('Delete share error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Share not found') {
          res.status(404).json({ error: 'Share not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to delete share' });
    }
  };

  accessSharedDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareToken } = req.params;
      const { password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent') || '';
      const userId = req.user?._id;

      const result = await this.shareService.accessSharedDocument(shareToken, {
        password,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        userId
      });

      logger.info(`Shared document accessed via token: ${shareToken}`);

      res.json(result);
    } catch (error) {
      logger.error('Access shared document error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Share link not found or expired') {
          res.status(404).json({ error: 'Share link not found or expired' });
          return;
        }
        if (error.message === 'Share link has expired or access limit exceeded') {
          res.status(410).json({ error: 'Share link has expired or access limit exceeded' });
          return;
        }
        if (error.message === 'Password required') {
          res.status(401).json({ 
            error: 'Password required', 
            requiresPassword: true 
          });
          return;
        }
        if (error.message === 'Invalid password') {
          res.status(401).json({ error: 'Invalid password' });
          return;
        }
        if (error.message === 'Authentication required') {
          res.status(401).json({ 
            error: 'Authentication required', 
            requiresAuth: true 
          });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to access shared document' });
    }
  };

  getShareStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      const stats = await this.shareService.getShareStats(
        new Types.ObjectId(id),
        userId
      );

      res.json(stats);
    } catch (error) {
      logger.error('Get share stats error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to get share statistics' });
    }
  };

  verifyShareAccess = async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareToken } = req.params;
      const { accessToken } = req.body;

      if (!accessToken) {
        res.status(400).json({ error: 'Access token required' });
        return;
      }

      const result = await this.shareService.verifyShareAccess(shareToken, accessToken);

      res.json({
        valid: true,
        shareId: result.shareId,
        userId: result.userId,
        accessLevel: result.accessLevel
      });
    } catch (error) {
      logger.error('Verify share access error:', error);
      
      res.status(401).json({
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid access token'
      });
    }
  };

  logShareAction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { shareToken } = req.params;
      const { action, details } = req.body;
      const { accessToken } = req.headers;

      if (!accessToken || typeof accessToken !== 'string') {
        res.status(400).json({ error: 'Access token required' });
        return;
      }

      // Verify access first
      const verification = await this.shareService.verifyShareAccess(shareToken, accessToken);
      
      // Log the action
      await this.shareService.logShareAction(verification.shareId, action, details);

      res.json({ message: 'Action logged successfully' });
    } catch (error) {
      logger.error('Log share action error:', error);
      res.status(401).json({ error: 'Invalid access token' });
    }
  };
}