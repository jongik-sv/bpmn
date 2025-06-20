'use client';

import { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItem,
  TextField,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Reply as ReplyIcon,
  ThumbUp as ThumbUpIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { Comment, CreateCommentForm } from '@/types';
import { useCommentStore } from '@/stores/comment.store';
import { useAuthStore } from '@/stores/auth.store';

interface CommentsPanelProps {
  projectId: string;
  comments: Comment[];
  onClose: () => void;
}

interface CommentItemProps {
  comment: Comment;
  onReply: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId: string;
}

function CommentItem({ 
  comment, 
  onReply, 
  onResolve, 
  onEdit, 
  onDelete, 
  currentUserId 
}: CommentItemProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);

  const isOwner = comment.authorId === currentUserId;
  const isResolved = comment.status === 'resolved';

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEditSave = () => {
    onEdit(comment._id, editContent);
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  return (
    <ListItem
      sx={{
        alignItems: 'flex-start',
        px: 2,
        py: 1.5,
        opacity: isResolved ? 0.6 : 1,
        backgroundColor: isResolved ? '#f5f5f5' : 'transparent',
      }}
    >
      <Avatar
        src={comment.author?.avatar}
        sx={{ width: 32, height: 32, mr: 1.5, mt: 0.5 }}
      >
        {comment.author?.displayName?.charAt(0).toUpperCase()}
      </Avatar>
      
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2">
            {comment.author?.displayName || 'Unknown User'}
          </Typography>
          {isResolved && (
            <Chip
              icon={<CheckIcon />}
              label="해결됨"
              size="small"
              color="success"
              variant="outlined"
            />
          )}
          <Typography variant="caption" color="text.secondary">
            {new Date(comment.createdAt).toLocaleString('ko-KR')}
          </Typography>
        </Box>

        {isEditing ? (
          <Box sx={{ mb: 1 }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={handleEditSave}>
                저장
              </Button>
              <Button size="small" onClick={handleEditCancel}>
                취소
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
            {comment.content}
          </Typography>
        )}

        {/* Comment actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => onReply(comment._id)}>
            <ReplyIcon fontSize="small" />
          </IconButton>
          
          <IconButton size="small">
            <ThumbUpIcon fontSize="small" />
          </IconButton>
          
          {comment.reactions.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {comment.reactions.length}
            </Typography>
          )}

          {!isResolved && (
            <Button
              size="small"
              startIcon={<CheckIcon />}
              onClick={() => onResolve(comment._id)}
            >
              해결
            </Button>
          )}

          {isOwner && (
            <>
              <IconButton size="small" onClick={handleMenuClick}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={() => { setIsEditing(true); handleMenuClose(); }}>
                  수정
                </MenuItem>
                <MenuItem onClick={() => { onDelete(comment._id); handleMenuClose(); }}>
                  삭제
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              onClick={() => setShowReplies(!showReplies)}
            >
              {showReplies ? '답글 숨기기' : `답글 ${comment.replies.length}개 보기`}
            </Button>
            {showReplies && (
              <Box sx={{ ml: 2, mt: 1 }}>
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply._id}
                    comment={reply}
                    onReply={onReply}
                    onResolve={onResolve}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    currentUserId={currentUserId}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </ListItem>
  );
}

export function CommentsPanel({ projectId, comments, onClose }: CommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textFieldRef = useRef<HTMLDivElement>(null);
  
  const { addComment, updateComment, deleteComment, resolveComment } = useCommentStore();
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const commentData: CreateCommentForm = {
        content: newComment.trim(),
      };
      
      await addComment(projectId, commentData);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = (commentId: string) => {
    // TODO: Implement reply functionality
    console.log('Reply to comment:', commentId);
  };

  const handleResolve = async (commentId: string) => {
    await resolveComment(commentId);
  };

  const handleEdit = async (commentId: string, content: string) => {
    await updateComment(commentId, content);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
  };

  const activeComments = comments.filter(c => c.status === 'active');
  const resolvedComments = comments.filter(c => c.status === 'resolved');

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 400,
        height: '100%',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6">
          댓글 ({comments.length})
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Comments list */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {comments.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              아직 댓글이 없습니다
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {/* Active comments */}
            {activeComments.map((comment, index) => (
              <Box key={comment._id}>
                <CommentItem
                  comment={comment}
                  onReply={handleReply}
                  onResolve={handleResolve}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  currentUserId={user?._id || ''}
                />
                {index < activeComments.length - 1 && <Divider />}
              </Box>
            ))}

            {/* Resolved comments */}
            {resolvedComments.length > 0 && (
              <>
                {activeComments.length > 0 && <Divider sx={{ my: 1 }} />}
                <Box sx={{ px: 2, py: 1, backgroundColor: '#f5f5f5' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    해결된 댓글 ({resolvedComments.length})
                  </Typography>
                </Box>
                {resolvedComments.map((comment, index) => (
                  <Box key={comment._id}>
                    <CommentItem
                      comment={comment}
                      onReply={handleReply}
                      onResolve={handleResolve}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      currentUserId={user?._id || ''}
                    />
                    {index < resolvedComments.length - 1 && <Divider />}
                  </Box>
                ))}
              </>
            )}
          </List>
        )}
      </Box>

      {/* New comment form */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 2,
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f9f9f9',
        }}
      >
        <TextField
          ref={textFieldRef}
          fullWidth
          placeholder="댓글을 입력하세요..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          multiline
          minRows={2}
          maxRows={4}
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!newComment.trim() || isSubmitting}
            size="small"
          >
            {isSubmitting ? '게시 중...' : '게시'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}