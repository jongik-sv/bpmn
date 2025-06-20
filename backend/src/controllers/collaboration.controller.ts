import { Request, Response } from 'express';
import { collaborationManager } from '../websocket/collaboration';
import { logger } from '../utils/logger';
import { ObjectId } from 'mongoose';

export class CollaborationController {
  
  getDocumentUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const users = collaborationManager.getDocumentUsers(documentId);
      
      res.json({ users });
    } catch (error) {
      logger.error('Get document users error:', error);
      res.status(500).json({ error: 'Failed to get document users' });
    }
  };

  getDocumentComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const comments = await collaborationManager.getDocumentComments(documentId);
      
      res.json({ comments });
    } catch (error) {
      logger.error('Get document comments error:', error);
      res.status(500).json({ error: 'Failed to get document comments' });
    }
  };

  addComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const userId = req.user!._id;
      const { content, elementId, position, mentions } = req.body;

      // Get project ID from document
      const { BpmnDocument } = await import('../models/Document');
      const document = await BpmnDocument.findById(documentId);
      
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const comment = await collaborationManager.addComment(
        documentId,
        document.projectId,
        userId,
        {
          content,
          elementId,
          position,
          mentions: mentions?.map((id: string) => new ObjectId(id))
        }
      );

      logger.info(`Comment added to document ${documentId} by ${req.user!.email}`);
      
      res.status(201).json({
        message: 'Comment added successfully',
        comment
      });
    } catch (error) {
      logger.error('Add comment error:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  };

  updateComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { commentId } = req.params;
      const userId = req.user!._id;
      const updates = req.body;

      const comment = await collaborationManager.updateComment(commentId, userId, updates);
      
      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }

      logger.info(`Comment updated: ${commentId} by ${req.user!.email}`);
      
      res.json({
        message: 'Comment updated successfully',
        comment
      });
    } catch (error) {
      logger.error('Update comment error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Comment not found') {
          res.status(404).json({ error: 'Comment not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to update comment' });
    }
  };

  getDocumentActivities = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const activities = await collaborationManager.getDocumentActivities(documentId, limit);
      
      res.json({ activities });
    } catch (error) {
      logger.error('Get document activities error:', error);
      res.status(500).json({ error: 'Failed to get document activities' });
    }
  };

  getCollaborationStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = collaborationManager.getStats();
      res.json({ stats });
    } catch (error) {
      logger.error('Get collaboration stats error:', error);
      res.status(500).json({ error: 'Failed to get collaboration statistics' });
    }
  };
}