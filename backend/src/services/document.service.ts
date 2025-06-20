import { ObjectId } from 'mongoose';
import { BpmnDocument, IBpmnDocument } from '../models/Document';
import { ProjectService } from './project.service';
import { ActivityLog } from '../models/ActivityLog';
import * as Y from 'yjs';

export interface CreateDocumentData {
  name: string;
  bpmnXml?: string;
}

export interface UpdateDocumentData {
  name?: string;
  bpmnXml?: string;
}

export class DocumentService {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  async createDocument(projectId: ObjectId, userId: ObjectId, documentData: CreateDocumentData): Promise<IBpmnDocument> {
    // Check if user has write permission to project
    const hasPermission = await this.projectService.checkPermission(projectId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    // Check if document name already exists in project
    const existingDoc = await BpmnDocument.findOne({
      projectId,
      name: documentData.name
    });

    if (existingDoc) {
      throw new Error('Document name already exists in this project');
    }

    // Create document
    const document = new BpmnDocument({
      projectId,
      name: documentData.name,
      bpmnXml: documentData.bpmnXml,
      metadata: {
        lastModifiedBy: userId,
        version: 1,
        elementCount: 0,
        fileSize: 0
      }
    });

    await document.save();

    // Initialize Yjs document
    const yDoc = new Y.Doc();
    const yjsState = Y.encodeStateAsUpdate(yDoc);
    const yjsStateVector = Y.encodeStateVector(yDoc);

    document.yjsState = yjsState;
    document.yjsStateVector = yjsStateVector;
    await document.save();

    // Log activity
    await this.logActivity(projectId, document._id, userId, 'document_created', {
      description: `Document "${document.name}" created`
    });

    return document;
  }

  async getProjectDocuments(projectId: ObjectId, userId: ObjectId): Promise<IBpmnDocument[]> {
    // Check if user has read permission to project
    const hasPermission = await this.projectService.checkPermission(projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    const documents = await BpmnDocument.find({ projectId })
      .populate('metadata.lastModifiedBy', 'username displayName avatar')
      .sort({ updatedAt: -1 })
      .lean();

    return documents;
  }

  async getDocumentById(documentId: ObjectId, userId: ObjectId): Promise<IBpmnDocument> {
    const document = await BpmnDocument.findById(documentId)
      .populate('projectId', 'name ownerId')
      .populate('metadata.lastModifiedBy', 'username displayName avatar');

    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has read permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId._id, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    return document;
  }

  async updateDocument(documentId: ObjectId, userId: ObjectId, updateData: UpdateDocumentData): Promise<IBpmnDocument> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has write permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    // Check if new name conflicts (if name is being changed)
    if (updateData.name && updateData.name !== document.name) {
      const existingDoc = await BpmnDocument.findOne({
        projectId: document.projectId,
        name: updateData.name,
        _id: { $ne: documentId }
      });

      if (existingDoc) {
        throw new Error('Document name already exists in this project');
      }
    }

    // Update document
    Object.assign(document, updateData);
    document.metadata.lastModifiedBy = userId;
    document.metadata.version += 1;

    await document.save();

    // Log activity
    await this.logActivity(document.projectId, documentId, userId, 'document_updated', {
      description: `Document "${document.name}" updated`
    });

    return document;
  }

  async deleteDocument(documentId: ObjectId, userId: ObjectId): Promise<void> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has delete permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'delete');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    await BpmnDocument.findByIdAndDelete(documentId);

    // Log activity
    await this.logActivity(document.projectId, documentId, userId, 'document_deleted', {
      description: `Document "${document.name}" deleted`
    });
  }

  async saveDocumentContent(documentId: ObjectId, userId: ObjectId, bpmnXml: string, yjsState?: Buffer): Promise<void> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has write permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    // Update document content
    document.bpmnXml = bpmnXml;
    document.metadata.lastModifiedBy = userId;
    
    if (yjsState) {
      document.yjsState = yjsState;
      document.yjsStateVector = Y.encodeStateVector(Y.decodeUpdate(yjsState));
    }

    await document.save();
  }

  async createSnapshot(documentId: ObjectId, userId: ObjectId, name: string): Promise<void> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has write permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    // Create snapshot
    if (document.yjsState) {
      document.addSnapshot(name, document.yjsState, userId);
      await document.save();

      // Log activity
      await this.logActivity(document.projectId, documentId, userId, 'document_updated', {
        description: `Snapshot "${name}" created for document "${document.name}"`
      });
    } else {
      throw new Error('No document state to snapshot');
    }
  }

  async restoreSnapshot(documentId: ObjectId, userId: ObjectId, snapshotId: string): Promise<void> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has write permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'write');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    // Find snapshot
    const snapshot = document.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // Restore from snapshot
    document.yjsState = snapshot.yjsState;
    document.yjsStateVector = Y.encodeStateVector(Y.decodeUpdate(snapshot.yjsState));
    document.metadata.lastModifiedBy = userId;
    document.metadata.version += 1;

    // Extract BPMN XML from Yjs state
    const yDoc = new Y.Doc();
    Y.applyUpdate(yDoc, snapshot.yjsState);
    const yBpmn = yDoc.getXmlFragment('bpmn');
    if (yBpmn.toString()) {
      document.bpmnXml = yBpmn.toString();
    }

    await document.save();

    // Log activity
    await this.logActivity(document.projectId, documentId, userId, 'document_updated', {
      description: `Document "${document.name}" restored from snapshot "${snapshot.name}"`
    });
  }

  async getDocumentSnapshots(documentId: ObjectId, userId: ObjectId): Promise<any[]> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has read permission to project
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    return document.snapshots.map(snapshot => ({
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      createdBy: snapshot.createdBy
    }));
  }

  async exportDocument(documentId: ObjectId, userId: ObjectId, format: 'xml' | 'json' = 'xml'): Promise<string> {
    const document = await BpmnDocument.findById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if user has read permission to project and if export is allowed
    const hasPermission = await this.projectService.checkPermission(document.projectId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Access denied');
    }

    // Log activity
    await this.logActivity(document.projectId, documentId, userId, 'document_exported', {
      description: `Document "${document.name}" exported as ${format.toUpperCase()}`
    });

    if (format === 'xml') {
      return document.bpmnXml;
    } else {
      return JSON.stringify({
        name: document.name,
        bpmnXml: document.bpmnXml,
        metadata: document.metadata,
        exportedAt: new Date().toISOString()
      }, null, 2);
    }
  }

  private async logActivity(projectId: ObjectId, documentId: ObjectId, userId: ObjectId, action: string, details: any): Promise<void> {
    try {
      const activityLog = new ActivityLog({
        projectId,
        documentId,
        userId,
        action,
        details,
        ipAddress: '0.0.0.0', // Will be updated from request
        userAgent: 'server',
        timestamp: new Date()
      });

      await activityLog.save();
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log activity:', error);
    }
  }
}