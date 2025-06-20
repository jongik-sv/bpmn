import WebSocket from 'ws';
import { createServer } from 'http';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { DocumentService } from '../services/document.service';
import { AuthService } from '../services/auth.service';
import { BpmnDocument } from '../models/Document';
import * as Y from 'yjs';
import { ObjectId } from 'mongoose';

export interface ConnectionInfo {
  documentId: string;
  userId?: ObjectId;
  user?: any;
  shareToken?: string;
  accessLevel: 'owner' | 'editor' | 'viewer';
}

export class YjsWebSocketServer {
  private wss: WebSocket.Server;
  private documentService: DocumentService;
  private authService: AuthService;
  private connections: Map<WebSocket, ConnectionInfo> = new Map();
  private documentConnections: Map<string, Set<WebSocket>> = new Map();

  constructor(port: number = config.wsPort) {
    this.documentService = new DocumentService();
    this.authService = new AuthService();

    // Create HTTP server for WebSocket
    const server = createServer();
    this.wss = new WebSocket.Server({ server });

    this.setupConnectionHandling();

    server.listen(port, () => {
      logger.info(`WebSocket server is running on port ${port}`);
    });
  }

  private setupConnectionHandling(): void {
    this.wss.on('connection', async (ws, req) => {
      try {
        await this.handleConnection(ws, req);
      } catch (error) {
        logger.error('WebSocket connection error:', error);
        ws.close(1008, 'Connection failed');
      }
    });
  }

  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const documentId = url.pathname.slice(1);
    const token = url.searchParams.get('token');
    const shareToken = url.searchParams.get('shareToken');

    if (!documentId) {
      ws.close(1008, 'Document ID required');
      return;
    }

    let connectionInfo: ConnectionInfo;

    try {
      if (shareToken) {
        // Handle shared document access
        connectionInfo = await this.handleSharedAccess(documentId, shareToken, token);
      } else {
        // Handle regular authenticated access
        connectionInfo = await this.handleAuthenticatedAccess(documentId, token);
      }
    } catch (error) {
      logger.error('Authentication failed:', error);
      ws.close(1008, error instanceof Error ? error.message : 'Authentication failed');
      return;
    }

    // Store connection info
    this.connections.set(ws, connectionInfo);

    // Add to document connections
    if (!this.documentConnections.has(documentId)) {
      this.documentConnections.set(documentId, new Set());
    }
    this.documentConnections.get(documentId)!.add(ws);

    // Setup Yjs WebSocket connection
    setupWSConnection(ws, req, {
      docName: documentId,
      gc: true,

      // Load document from database
      getYDoc: async (docName: string) => {
        return await this.loadDocument(docName);
      },

      // Save document to database
      persistDoc: async (docName: string, ydoc: Y.Doc) => {
        if (connectionInfo.accessLevel !== 'viewer') {
          await this.saveDocument(docName, ydoc, connectionInfo.userId);
        }
      },

      // Authentication check
      authenticate: () => true, // Already authenticated above

      // Authorization check for write operations
      authorize: (docName: string, ydoc: Y.Doc, ws: WebSocket) => {
        const info = this.connections.get(ws);
        return info?.accessLevel === 'owner' || info?.accessLevel === 'editor';
      }
    });

    // Handle connection events
    this.setupConnectionEvents(ws, connectionInfo);

    // Notify other users about new connection
    this.broadcastUserJoined(documentId, connectionInfo, ws);

    logger.info(`User connected to document ${documentId}: ${connectionInfo.user?.displayName || 'Anonymous'}`);
  }

  private async handleAuthenticatedAccess(documentId: string, token: string | null): Promise<ConnectionInfo> {
    if (!token) {
      throw new Error('Authentication token required');
    }

    const user = await this.authService.verifyToken(token);
    if (!user) {
      throw new Error('Invalid authentication token');
    }

    // Check if user has access to the document
    try {
      await this.documentService.getDocumentById(new ObjectId(documentId), user._id);
    } catch (error) {
      throw new Error('Access denied to document');
    }

    // Determine access level based on project permissions
    // For now, assume editor access for authenticated users
    return {
      documentId,
      userId: user._id,
      user,
      accessLevel: 'editor'
    };
  }

  private async handleSharedAccess(documentId: string, shareToken: string, accessToken: string | null): Promise<ConnectionInfo> {
    // Import share service dynamically to avoid circular dependencies
    const { DocumentShareService } = await import('../services/document-share.service');
    const shareService = new DocumentShareService();

    if (!accessToken) {
      throw new Error('Share access token required');
    }

    try {
      const verification = await shareService.verifyShareAccess(shareToken, accessToken);
      
      return {
        documentId,
        userId: verification.userId,
        shareToken,
        accessLevel: verification.accessLevel as 'editor' | 'viewer'
      };
    } catch (error) {
      throw new Error('Invalid share access');
    }
  }

  private async loadDocument(documentId: string): Promise<Y.Doc> {
    try {
      const document = await BpmnDocument.findById(documentId);
      const ydoc = new Y.Doc();

      if (document && document.yjsState) {
        // Apply existing state
        Y.applyUpdate(ydoc, document.yjsState);
      } else {
        // Initialize empty document
        const yBpmn = ydoc.getXmlFragment('bpmn');
        const yElements = ydoc.getMap('elements');
        const yComments = ydoc.getArray('comments');
        
        // Set default BPMN content if document exists
        if (document && document.bpmnXml) {
          // Parse and set BPMN XML - simplified for now
          yBpmn.insert(0, [document.bpmnXml]);
        }
      }

      return ydoc;
    } catch (error) {
      logger.error('Failed to load document:', error);
      // Return empty document on error
      return new Y.Doc();
    }
  }

  private async saveDocument(documentId: string, ydoc: Y.Doc, userId?: ObjectId): Promise<void> {
    try {
      if (!userId) {
        logger.warn('Cannot save document: no user ID provided');
        return;
      }

      const yjsState = Y.encodeStateAsUpdate(ydoc);
      
      // Extract BPMN XML from Yjs document
      const yBpmn = ydoc.getXmlFragment('bpmn');
      let bpmnXml = '';
      
      if (yBpmn.length > 0) {
        // Simplified BPMN extraction - in real implementation, 
        // you'd need proper BPMN XML generation from Yjs structure
        bpmnXml = yBpmn.toString();
      }

      // Save to database
      await this.documentService.saveDocumentContent(
        new ObjectId(documentId),
        userId,
        bpmnXml,
        yjsState
      );

      logger.debug(`Document saved: ${documentId}`);
    } catch (error) {
      logger.error('Failed to save document:', error);
    }
  }

  private setupConnectionEvents(ws: WebSocket, connectionInfo: ConnectionInfo): void {
    ws.on('close', () => {
      this.handleDisconnection(ws, connectionInfo);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.handleDisconnection(ws, connectionInfo);
    });

    // Handle custom messages for collaboration features
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleCustomMessage(ws, connectionInfo, message);
      } catch (error) {
        // Ignore non-JSON messages (they might be Yjs protocol messages)
      }
    });
  }

  private handleCustomMessage(ws: WebSocket, connectionInfo: ConnectionInfo, message: any): void {
    switch (message.type) {
      case 'cursor-update':
        this.broadcastCursorUpdate(connectionInfo.documentId, connectionInfo, message.cursor, ws);
        break;
      case 'user-activity':
        this.broadcastUserActivity(connectionInfo.documentId, connectionInfo, message.activity, ws);
        break;
      case 'comment-added':
        this.broadcastComment(connectionInfo.documentId, connectionInfo, message.comment, ws);
        break;
      default:
        // Unknown message type, ignore
        break;
    }
  }

  private handleDisconnection(ws: WebSocket, connectionInfo: ConnectionInfo): void {
    // Remove from connections
    this.connections.delete(ws);

    // Remove from document connections
    const docConnections = this.documentConnections.get(connectionInfo.documentId);
    if (docConnections) {
      docConnections.delete(ws);
      if (docConnections.size === 0) {
        this.documentConnections.delete(connectionInfo.documentId);
      }
    }

    // Notify other users about disconnection
    this.broadcastUserLeft(connectionInfo.documentId, connectionInfo, ws);

    logger.info(`User disconnected from document ${connectionInfo.documentId}: ${connectionInfo.user?.displayName || 'Anonymous'}`);
  }

  private broadcastUserJoined(documentId: string, connectionInfo: ConnectionInfo, excludeWs: WebSocket): void {
    const message = {
      type: 'user-joined',
      user: {
        id: connectionInfo.userId?.toString(),
        name: connectionInfo.user?.displayName || 'Anonymous',
        avatar: connectionInfo.user?.avatar,
        accessLevel: connectionInfo.accessLevel
      },
      timestamp: new Date().toISOString()
    };

    this.broadcastToDocument(documentId, message, excludeWs);
  }

  private broadcastUserLeft(documentId: string, connectionInfo: ConnectionInfo, excludeWs: WebSocket): void {
    const message = {
      type: 'user-left',
      userId: connectionInfo.userId?.toString(),
      timestamp: new Date().toISOString()
    };

    this.broadcastToDocument(documentId, message, excludeWs);
  }

  private broadcastCursorUpdate(documentId: string, connectionInfo: ConnectionInfo, cursor: any, excludeWs: WebSocket): void {
    const message = {
      type: 'cursor-update',
      userId: connectionInfo.userId?.toString(),
      user: {
        name: connectionInfo.user?.displayName || 'Anonymous',
        color: this.getUserColor(connectionInfo.userId?.toString() || '')
      },
      cursor,
      timestamp: new Date().toISOString()
    };

    this.broadcastToDocument(documentId, message, excludeWs);
  }

  private broadcastUserActivity(documentId: string, connectionInfo: ConnectionInfo, activity: any, excludeWs: WebSocket): void {
    const message = {
      type: 'user-activity',
      userId: connectionInfo.userId?.toString(),
      user: {
        name: connectionInfo.user?.displayName || 'Anonymous'
      },
      activity,
      timestamp: new Date().toISOString()
    };

    this.broadcastToDocument(documentId, message, excludeWs);
  }

  private broadcastComment(documentId: string, connectionInfo: ConnectionInfo, comment: any, excludeWs: WebSocket): void {
    const message = {
      type: 'comment-added',
      comment: {
        ...comment,
        author: {
          id: connectionInfo.userId?.toString(),
          name: connectionInfo.user?.displayName || 'Anonymous',
          avatar: connectionInfo.user?.avatar
        }
      },
      timestamp: new Date().toISOString()
    };

    this.broadcastToDocument(documentId, message, excludeWs);
  }

  private broadcastToDocument(documentId: string, message: any, excludeWs?: WebSocket): void {
    const connections = this.documentConnections.get(documentId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);

    connections.forEach(ws => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          logger.error('Failed to send message to client:', error);
        }
      }
    });
  }

  private getUserColor(userId: string): string {
    // Generate consistent color for user based on ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#FFC312', '#C4E538', '#12CBC4', '#FDA7DF', '#ED4C67'
    ];
    
    const hash = userId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    return colors[hash % colors.length];
  }

  public getConnectionStats(): any {
    const totalConnections = this.connections.size;
    const documentStats = new Map();

    this.documentConnections.forEach((connections, documentId) => {
      documentStats.set(documentId, {
        connections: connections.size,
        users: Array.from(connections).map(ws => {
          const info = this.connections.get(ws);
          return {
            userId: info?.userId?.toString(),
            name: info?.user?.displayName || 'Anonymous',
            accessLevel: info?.accessLevel
          };
        })
      });
    });

    return {
      totalConnections,
      activeDocuments: this.documentConnections.size,
      documentStats: Object.fromEntries(documentStats)
    };
  }
}