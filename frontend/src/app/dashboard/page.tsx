'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Fab,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  AccountCircle,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { projects, isLoading, fetchProjects } = useProjectStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // 페이지 로드 시 항상 새로운 프로젝트 목록 가져오기
    fetchProjects();
  }, [user, router, fetchProjects]);

  useEffect(() => {
    // 페이지가 다시 보여질 때 (visibility change) 새로고침
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('페이지가 다시 보여짐, 프로젝트 목록 새로고침');
        fetchProjects();
      }
    };

    const handleFocus = () => {
      if (user) {
        console.log('윈도우 포커스, 프로젝트 목록 새로고침');
        fetchProjects();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, fetchProjects]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCreateProject = () => {
    router.push('/projects/new');
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/editor/${projectId}`);
  };

  const handleRefresh = () => {
    console.log('수동 새로고침 버튼 클릭');
    fetchProjects();
  };

  if (!user) return null;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            BPMN Collaborative Editor
          </Typography>
          <IconButton
            size="large"
            aria-label="refresh projects"
            onClick={handleRefresh}
            color="inherit"
            sx={{ mr: 1 }}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            {user.avatar ? (
              <Avatar src={user.avatar} alt={user.displayName} />
            ) : (
              <AccountCircle />
            )}
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <SettingsIcon sx={{ mr: 1 }} />
              설정
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} />
              로그아웃
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            안녕하세요, {user.displayName}님!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            프로젝트를 관리하고 BPMN 다이어그램을 협업으로 편집하세요.
          </Typography>
        </Box>

        {isLoading ? (
          <Typography>프로젝트를 불러오는 중...</Typography>
        ) : !Array.isArray(projects) || projects.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                아직 프로젝트가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                첫 번째 BPMN 프로젝트를 만들어 시작하세요.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateProject}
              >
                새 프로젝트 만들기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {Array.isArray(projects) && projects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project._id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {project.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {project.description || '설명이 없습니다'}
                    </Typography>
                    <Typography variant="caption" display="block" gutterBottom>
                      생성일: {new Date(project.createdAt).toLocaleDateString('ko-KR')}
                    </Typography>
                    <Typography variant="caption" display="block">
                      마지막 접근: {new Date(project.lastAccessedAt).toLocaleDateString('ko-KR')}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleOpenProject(project._id)}
                    >
                      열기
                    </Button>
                    <Button size="small">공유</Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={handleCreateProject}
        >
          <AddIcon />
        </Fab>
      </Container>
    </Box>
  );
}