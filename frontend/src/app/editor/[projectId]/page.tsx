'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Tooltip,
  Menu,
  MenuItem,
  Badge,
  Chip,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Download,
  Share,
  Comment,
  People,
  Settings,
  Undo,
  Redo,
} from '@mui/icons-material';
import { BpmnEditor } from '@/components/BpmnEditor';
import { CollaborativePanel } from '@/components/CollaborativePanel';
import { CommentsPanel } from '@/components/CommentsPanel';
import { useAuthStore } from '@/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';
import { useCollaborationStore } from '@/stores/collaboration.store';
import { useCommentStore } from '@/stores/comment.store';

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  
  const { user } = useAuthStore();
  const { currentProject, getProject } = useProjectStore();
  const { 
    activeUsers, 
    connectToProject, 
    disconnectFromProject 
  } = useCollaborationStore();
  const { comments, fetchComments } = useCommentStore();
  
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [shareMenuAnchor, setShareMenuAnchor] = useState<null | HTMLElement>(null);
  
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (projectId) {
      // Load project data
      getProject(projectId);
      
      // Connect to collaborative session
      connectToProject(projectId);
      
      // Load comments
      fetchComments(projectId);

      // Cleanup on unmount
      return () => {
        disconnectFromProject();
      };
    }
  }, [projectId, user, router, getProject, connectToProject, disconnectFromProject, fetchComments]);

  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleSave = async () => {
    if (editorRef.current) {
      await editorRef.current.save();
    }
  };

  const handleExport = () => {
    if (editorRef.current) {
      editorRef.current.exportDiagram();
    }
  };

  const handleShareClick = (event: React.MouseEvent<HTMLElement>) => {
    setShareMenuAnchor(event.currentTarget);
  };

  const handleShareClose = () => {
    setShareMenuAnchor(null);
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.undo();
    }
  };

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.redo();
    }
  };

  if (!user || !currentProject) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        프로젝트를 불러오는 중...
      </Box>
    );
  }

  const unreadComments = comments.filter(c => c.status === 'active').length;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default">
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {currentProject.name}
          </Typography>

          {/* Active users */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            {activeUsers.slice(0, 3).map((user, index) => (
              <Tooltip key={user.id} title={user.name}>
                <Chip
                  size="small"
                  avatar={
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: user.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </Box>
                  }
                  label=""
                  sx={{ ml: index > 0 ? -1 : 0 }}
                />
              </Tooltip>
            ))}
            {activeUsers.length > 3 && (
              <Chip size="small" label={`+${activeUsers.length - 3}`} />
            )}
          </Box>

          {/* Editor controls */}
          <Tooltip title="실행 취소">
            <IconButton onClick={handleUndo}>
              <Undo />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="다시 실행">
            <IconButton onClick={handleRedo}>
              <Redo />
            </IconButton>
          </Tooltip>

          <Tooltip title="저장">
            <IconButton onClick={handleSave}>
              <Save />
            </IconButton>
          </Tooltip>

          <Tooltip title="내보내기">
            <IconButton onClick={handleExport}>
              <Download />
            </IconButton>
          </Tooltip>

          <Tooltip title="공유">
            <IconButton onClick={handleShareClick}>
              <Share />
            </IconButton>
          </Tooltip>

          <Tooltip title="협업자 보기">
            <IconButton onClick={() => setShowCollabPanel(!showCollabPanel)}>
              <Badge badgeContent={activeUsers.length} color="primary">
                <People />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="댓글">
            <IconButton onClick={() => setShowCommentsPanel(!showCommentsPanel)}>
              <Badge badgeContent={unreadComments} color="error">
                <Comment />
              </Badge>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Share menu */}
      <Menu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={handleShareClose}
      >
        <MenuItem onClick={handleShareClose}>링크로 공유</MenuItem>
        <MenuItem onClick={handleShareClose}>이메일로 초대</MenuItem>
        <MenuItem onClick={handleShareClose}>권한 관리</MenuItem>
      </Menu>

      {/* Editor area */}
      <Box sx={{ flexGrow: 1, display: 'flex', position: 'relative' }}>
        <Box sx={{ flexGrow: 1 }}>
          <BpmnEditor
            ref={editorRef}
            projectId={projectId}
            project={currentProject}
          />
        </Box>

        {/* Side panels */}
        {showCollabPanel && (
          <CollaborativePanel
            users={activeUsers}
            onClose={() => setShowCollabPanel(false)}
          />
        )}

        {showCommentsPanel && (
          <CommentsPanel
            projectId={projectId}
            comments={comments}
            onClose={() => setShowCommentsPanel(false)}
          />
        )}
      </Box>
    </Box>
  );
}