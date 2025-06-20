import { apiClient, handleApiError } from './api';
import { BpmnDocument, CreateDocumentForm, PaginatedResponse } from '@/types';

export class DocumentService {
  // Document CRUD operations
  async getDocuments(projectId: string, params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<BpmnDocument>> {
    try {
      const response = await apiClient.get<PaginatedResponse<BpmnDocument>>(
        `/projects/${projectId}/documents`,
        { params }
      );
      return response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getDocument(projectId: string, documentId?: string): Promise<BpmnDocument> {
    try {
      const endpoint = documentId 
        ? `/projects/${projectId}/documents/${documentId}`
        : `/projects/${projectId}/documents/main`;
      
      const response = await apiClient.get<{ document: BpmnDocument }>(endpoint);
      return response.document;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async createDocument(projectId: string, data: CreateDocumentForm): Promise<BpmnDocument> {
    try {
      const response = await apiClient.post<{ document: BpmnDocument }>(
        `/projects/${projectId}/documents`,
        data
      );
      return response.document;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async updateDocument(
    projectId: string,
    data: { bpmnXml: string },
    documentId?: string
  ): Promise<BpmnDocument> {
    try {
      const endpoint = documentId 
        ? `/projects/${projectId}/documents/${documentId}`
        : `/projects/${projectId}/documents/main`;
        
      const response = await apiClient.put<{ document: BpmnDocument }>(endpoint, data);
      return response.document;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async deleteDocument(projectId: string, documentId: string): Promise<void> {
    try {
      await apiClient.delete(`/projects/${projectId}/documents/${documentId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Document snapshots
  async createSnapshot(
    projectId: string,
    documentId: string,
    data: { name: string; description?: string }
  ): Promise<any> {
    try {
      const response = await apiClient.post<{ snapshot: any }>(
        `/projects/${projectId}/documents/${documentId}/snapshots`,
        data
      );
      return response.snapshot;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getSnapshots(projectId: string, documentId: string): Promise<any[]> {
    try {
      const response = await apiClient.get<{ snapshots: any[] }>(
        `/projects/${projectId}/documents/${documentId}/snapshots`
      );
      return response.snapshots;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async restoreSnapshot(
    projectId: string,
    documentId: string,
    snapshotId: string
  ): Promise<BpmnDocument> {
    try {
      const response = await apiClient.post<{ document: BpmnDocument }>(
        `/projects/${projectId}/documents/${documentId}/snapshots/${snapshotId}/restore`
      );
      return response.document;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async deleteSnapshot(
    projectId: string,
    documentId: string,
    snapshotId: string
  ): Promise<void> {
    try {
      await apiClient.delete(
        `/projects/${projectId}/documents/${documentId}/snapshots/${snapshotId}`
      );
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Document export
  async exportDocument(
    projectId: string,
    documentId: string,
    format: 'xml' | 'svg' | 'png' | 'pdf'
  ): Promise<Blob> {
    try {
      const response = await apiClient.get(
        `/projects/${projectId}/documents/${documentId}/export`,
        {
          params: { format },
          responseType: 'blob',
        }
      );
      return response as unknown as Blob;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Document validation
  async validateDocument(projectId: string, documentId: string): Promise<any> {
    try {
      const response = await apiClient.post<{ validation: any }>(
        `/projects/${projectId}/documents/${documentId}/validate`
      );
      return response.validation;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
}

// Export singleton instance
export const documentService = new DocumentService();