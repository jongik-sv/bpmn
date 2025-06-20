import { apiClient, handleApiError } from './api';
import { Comment, CreateCommentForm } from '@/types';

export class CommentService {
  // Comment CRUD operations
  async getComments(projectId: string, documentId?: string): Promise<Comment[]> {
    try {
      const endpoint = documentId
        ? `/projects/${projectId}/documents/${documentId}/comments`
        : `/projects/${projectId}/comments`;
      
      const response = await apiClient.get<{ comments: Comment[] }>(endpoint);
      return response.comments;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async createComment(projectId: string, data: CreateCommentForm): Promise<Comment> {
    try {
      const response = await apiClient.post<{ comment: Comment }>(
        `/projects/${projectId}/comments`,
        data
      );
      return response.comment;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async updateComment(commentId: string, data: Partial<CreateCommentForm & { status: string }>): Promise<Comment> {
    try {
      const response = await apiClient.put<{ comment: Comment }>(
        `/comments/${commentId}`,
        data
      );
      return response.comment;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async deleteComment(commentId: string): Promise<void> {
    try {
      await apiClient.delete(`/comments/${commentId}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Comment reactions
  async addReaction(commentId: string, type: string): Promise<void> {
    try {
      await apiClient.post(`/comments/${commentId}/reactions`, { type });
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async removeReaction(commentId: string, type: string): Promise<void> {
    try {
      await apiClient.delete(`/comments/${commentId}/reactions/${type}`);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Comment replies
  async getReplies(commentId: string): Promise<Comment[]> {
    try {
      const response = await apiClient.get<{ replies: Comment[] }>(
        `/comments/${commentId}/replies`
      );
      return response.replies;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async createReply(commentId: string, data: CreateCommentForm): Promise<Comment> {
    try {
      const response = await apiClient.post<{ comment: Comment }>(
        `/comments/${commentId}/replies`,
        data
      );
      return response.comment;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Comment mentions
  async getMentionedUsers(projectId: string, query: string): Promise<any[]> {
    try {
      const response = await apiClient.get<{ users: any[] }>(
        `/projects/${projectId}/users/mentions`,
        { params: { q: query } }
      );
      return response.users;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
}

// Export singleton instance
export const commentService = new CommentService();