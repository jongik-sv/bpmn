import { create } from 'zustand';
import { Comment, CreateCommentForm } from '@/types';
import { commentService } from '@/services/comment.service';
import toast from 'react-hot-toast';

interface CommentState {
  comments: Comment[];
  isLoading: boolean;
  
  // Actions
  fetchComments: (projectId: string, documentId?: string) => Promise<void>;
  addComment: (projectId: string, data: CreateCommentForm) => Promise<Comment | null>;
  updateComment: (commentId: string, content: string) => Promise<boolean>;
  deleteComment: (commentId: string) => Promise<boolean>;
  resolveComment: (commentId: string) => Promise<boolean>;
  addReaction: (commentId: string, type: string) => Promise<boolean>;
  removeReaction: (commentId: string, type: string) => Promise<boolean>;
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  isLoading: false,

  fetchComments: async (projectId: string, documentId?: string) => {
    set({ isLoading: true });
    try {
      const comments = await commentService.getComments(projectId, documentId);
      set({ comments, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Failed to fetch comments:', error);
    }
  },

  addComment: async (projectId: string, data: CreateCommentForm) => {
    try {
      const comment = await commentService.createComment(projectId, data);
      const { comments } = get();
      set({ comments: [comment, ...comments] });
      toast.success('댓글이 추가되었습니다');
      return comment;
    } catch (error: any) {
      toast.error(error.message || '댓글 추가에 실패했습니다');
      return null;
    }
  },

  updateComment: async (commentId: string, content: string) => {
    try {
      const updatedComment = await commentService.updateComment(commentId, { content });
      const { comments } = get();
      set({
        comments: comments.map(c => 
          c._id === commentId ? updatedComment : c
        ),
      });
      toast.success('댓글이 수정되었습니다');
      return true;
    } catch (error: any) {
      toast.error(error.message || '댓글 수정에 실패했습니다');
      return false;
    }
  },

  deleteComment: async (commentId: string) => {
    try {
      await commentService.deleteComment(commentId);
      const { comments } = get();
      set({
        comments: comments.filter(c => c._id !== commentId),
      });
      toast.success('댓글이 삭제되었습니다');
      return true;
    } catch (error: any) {
      toast.error(error.message || '댓글 삭제에 실패했습니다');
      return false;
    }
  },

  resolveComment: async (commentId: string) => {
    try {
      const updatedComment = await commentService.updateComment(commentId, { 
        status: 'resolved' 
      });
      const { comments } = get();
      set({
        comments: comments.map(c => 
          c._id === commentId ? updatedComment : c
        ),
      });
      toast.success('댓글이 해결됨으로 표시되었습니다');
      return true;
    } catch (error: any) {
      toast.error(error.message || '댓글 상태 변경에 실패했습니다');
      return false;
    }
  },

  addReaction: async (commentId: string, type: string) => {
    try {
      await commentService.addReaction(commentId, type);
      // Refresh comments to get updated reactions
      // In a real app, you might want to update locally for better UX
      return true;
    } catch (error: any) {
      toast.error(error.message || '반응 추가에 실패했습니다');
      return false;
    }
  },

  removeReaction: async (commentId: string, type: string) => {
    try {
      await commentService.removeReaction(commentId, type);
      // Refresh comments to get updated reactions
      return true;
    } catch (error: any) {
      toast.error(error.message || '반응 제거에 실패했습니다');
      return false;
    }
  },
}));