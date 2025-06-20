import { Request, Response } from 'express';
import { DocumentService } from '../services/document.service';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  createDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const userId = req.user!._id;
      const documentData = req.body;

      if (!Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const document = await this.documentService.createDocument(
        new Types.ObjectId(projectId),
        userId,
        documentData
      );

      logger.info(`Document created: ${document.name} by ${req.user!.email}`);

      res.status(201).json({
        message: 'Document created successfully',
        document
      });
    } catch (error) {
      logger.error('Create document error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
        if (error.message.includes('already exists')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to create document' });
    }
  };

  getProjectDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(projectId)) {
        res.status(400).json({ error: 'Invalid project ID' });
        return;
      }

      const documents = await this.documentService.getProjectDocuments(
        new Types.ObjectId(projectId),
        userId
      );

      res.json({ documents });
    } catch (error) {
      logger.error('Get project documents error:', error);
      
      if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      
      res.status(500).json({ error: 'Failed to get documents' });
    }
  };

  getDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      const document = await this.documentService.getDocumentById(
        new Types.ObjectId(id),
        userId
      );

      res.json({ document });
    } catch (error) {
      logger.error('Get document error:', error);
      
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
      
      res.status(500).json({ error: 'Failed to get document' });
    }
  };

  updateDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;
      const updateData = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      const document = await this.documentService.updateDocument(
        new Types.ObjectId(id),
        userId,
        updateData
      );

      logger.info(`Document updated: ${document.name} by ${req.user!.email}`);

      res.json({
        message: 'Document updated successfully',
        document
      });
    } catch (error) {
      logger.error('Update document error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
        if (error.message.includes('already exists')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to update document' });
    }
  };

  deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      await this.documentService.deleteDocument(new Types.ObjectId(id), userId);

      logger.info(`Document deleted: ${id} by ${req.user!.email}`);

      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      logger.error('Delete document error:', error);
      
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
      
      res.status(500).json({ error: 'Failed to delete document' });
    }
  };

  createSnapshot = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;
      const { name } = req.body;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Snapshot name is required' });
        return;
      }

      await this.documentService.createSnapshot(new Types.ObjectId(id), userId, name);

      logger.info(`Snapshot created for document ${id} by ${req.user!.email}`);

      res.json({ message: 'Snapshot created successfully' });
    } catch (error) {
      logger.error('Create snapshot error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
        if (error.message === 'No document state to snapshot') {
          res.status(400).json({ error: 'No document state to snapshot' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to create snapshot' });
    }
  };

  getSnapshots = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      const snapshots = await this.documentService.getDocumentSnapshots(
        new Types.ObjectId(id),
        userId
      );

      res.json({ snapshots });
    } catch (error) {
      logger.error('Get snapshots error:', error);
      
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
      
      res.status(500).json({ error: 'Failed to get snapshots' });
    }
  };

  restoreSnapshot = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, snapshotId } = req.params;
      const userId = req.user!._id;

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      await this.documentService.restoreSnapshot(
        new Types.ObjectId(id),
        userId,
        snapshotId
      );

      logger.info(`Snapshot restored for document ${id} by ${req.user!.email}`);

      res.json({ message: 'Snapshot restored successfully' });
    } catch (error) {
      logger.error('Restore snapshot error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Document not found') {
          res.status(404).json({ error: 'Document not found' });
          return;
        }
        if (error.message === 'Snapshot not found') {
          res.status(404).json({ error: 'Snapshot not found' });
          return;
        }
        if (error.message === 'Access denied') {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
      
      res.status(500).json({ error: 'Failed to restore snapshot' });
    }
  };

  exportDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!._id;
      const format = req.query.format as 'xml' | 'json' || 'xml';

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid document ID' });
        return;
      }

      if (!['xml', 'json'].includes(format)) {
        res.status(400).json({ error: 'Invalid format. Use xml or json' });
        return;
      }

      const content = await this.documentService.exportDocument(
        new Types.ObjectId(id),
        userId,
        format
      );

      const contentType = format === 'xml' ? 'application/xml' : 'application/json';
      const filename = `document_${id}.${format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      logger.error('Export document error:', error);
      
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
      
      res.status(500).json({ error: 'Failed to export document' });
    }
  };
}