'use client';

import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { CollaborativeUser } from '@/types';

interface CollaborativePanelProps {
  users: CollaborativeUser[];
  onClose: () => void;
}

export function CollaborativePanel({ users, onClose }: CollaborativePanelProps) {
  const getStatusColor = (user: CollaborativeUser) => {
    if (!user.isActive) return '#ccc';
    
    const now = new Date();
    const lastSeen = new Date(user.lastSeen);
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    
    if (diffMinutes < 1) return '#4caf50'; // Green - Active
    if (diffMinutes < 5) return '#ff9800'; // Orange - Away
    return '#f44336'; // Red - Offline
  };

  const getStatusText = (user: CollaborativeUser) => {
    if (!user.isActive) return '오프라인';
    
    const now = new Date();
    const lastSeen = new Date(user.lastSeen);
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    
    if (diffMinutes < 1) return '활성';
    if (diffMinutes < 5) return '자리비움';
    return '오프라인';
  };

  const getRoleColor = (accessLevel: string) => {
    switch (accessLevel) {
      case 'owner': return 'error';
      case 'editor': return 'primary';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  const getRoleText = (accessLevel: string) => {
    switch (accessLevel) {
      case 'owner': return '소유자';
      case 'editor': return '편집자';
      case 'viewer': return '조회자';
      default: return '게스트';
    }
  };

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 320,
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
          협업자 ({users.length})
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Users list */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {users.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              현재 접속 중인 사용자가 없습니다
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {users.map((user, index) => (
              <Box key={user.id}>
                <ListItem sx={{ px: 2, py: 1.5 }}>
                  <ListItemAvatar>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        src={user.avatar}
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: user.color,
                        }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: getStatusColor(user),
                          border: '2px solid white',
                        }}
                      />
                    </Box>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" noWrap>
                          {user.name}
                        </Typography>
                        <Chip
                          label={getRoleText(user.accessLevel)}
                          size="small"
                          color={getRoleColor(user.accessLevel) as any}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {getStatusText(user)}
                        {user.cursor && (
                          <>
                            {' • '}
                            {user.cursor.elementId ? `편집 중: ${user.cursor.elementId}` : '다이어그램 보기'}
                          </>
                        )}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < users.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          실시간 협업 상태가 표시됩니다
        </Typography>
      </Box>
    </Paper>
  );
}