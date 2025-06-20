'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  AppBar,
  Toolbar,
} from '@mui/material';
import { ArrowBack, Add as AddIcon } from '@mui/icons-material';
import { CreateProjectForm } from '@/types';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/stores/auth.store';

export default function NewProjectPage() {
  const router = useRouter();
  const { createProject } = useProjectStore();
  const { user } = useAuthStore();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectForm>();

  const handleBack = () => {
    router.push('/dashboard');
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const onSubmit = async (data: CreateProjectForm) => {
    const projectData = {
      ...data,
      tags,
    };
    
    const project = await createProject(projectData);
    if (project) {
      router.push(`/editor/${project._id}`);
    }
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default">
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6">
            새 프로젝트 만들기
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            프로젝트 정보
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            새로운 BPMN 프로젝트를 만들어보세요.
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              {...register('name', {
                required: '프로젝트 이름을 입력해주세요',
                minLength: {
                  value: 2,
                  message: '프로젝트 이름은 최소 2자 이상이어야 합니다',
                },
              })}
              fullWidth
              label="프로젝트 이름"
              margin="normal"
              error={!!errors.name}
              helperText={errors.name?.message}
              autoFocus
            />

            <TextField
              {...register('description')}
              fullWidth
              label="설명 (선택사항)"
              margin="normal"
              multiline
              rows={3}
              placeholder="프로젝트에 대한 간단한 설명을 입력하세요"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>공개 설정</InputLabel>
              <Select
                {...register('visibility')}
                defaultValue="private"
                label="공개 설정"
              >
                <MenuItem value="private">비공개 - 나만 볼 수 있음</MenuItem>
                <MenuItem value="team">팀 - 초대받은 사람만 볼 수 있음</MenuItem>
                <MenuItem value="public">공개 - 모든 사람이 볼 수 있음</MenuItem>
              </Select>
            </FormControl>

            {/* Tags input */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                태그 (선택사항)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="태그 입력"
                  size="small"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <IconButton onClick={handleAddTag} disabled={!tagInput.trim()}>
                  <AddIcon />
                </IconButton>
              </Box>
              
              {tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveTag(tag)}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={handleBack}>
                취소
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
              >
                {isSubmitting ? '만드는 중...' : '프로젝트 만들기'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}