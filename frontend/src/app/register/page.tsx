'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Divider,
  Alert,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { RegisterRequest } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuthStore();
  const [error, setError] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest & { confirmPassword: string }>();

  const watchPassword = watch('password');

  const onSubmit = async (data: RegisterRequest & { confirmPassword: string }) => {
    setError('');
    const { confirmPassword, ...registerData } = data;
    const success = await registerUser(registerData);
    if (success) {
      router.push('/dashboard');
    }
  };

  const handleGoogleSignup = () => {
    // TODO: Implement Google OAuth
    console.log('Google signup not implemented yet');
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            회원가입
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            새 계정을 만들어 시작하세요
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1 }}>
            <TextField
              {...register('email', {
                required: '이메일을 입력해주세요',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: '올바른 이메일 형식을 입력해주세요',
                },
              })}
              margin="normal"
              fullWidth
              id="email"
              label="이메일"
              type="email"
              autoComplete="email"
              autoFocus
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            
            <TextField
              {...register('username', {
                required: '사용자명을 입력해주세요',
                minLength: {
                  value: 3,
                  message: '사용자명은 최소 3자 이상이어야 합니다',
                },
                pattern: {
                  value: /^[a-zA-Z0-9_]+$/,
                  message: '사용자명은 영문, 숫자, 언더스코어만 사용 가능합니다',
                },
              })}
              margin="normal"
              fullWidth
              id="username"
              label="사용자명"
              autoComplete="username"
              error={!!errors.username}
              helperText={errors.username?.message}
            />

            <TextField
              {...register('displayName', {
                required: '표시 이름을 입력해주세요',
                minLength: {
                  value: 2,
                  message: '표시 이름은 최소 2자 이상이어야 합니다',
                },
              })}
              margin="normal"
              fullWidth
              id="displayName"
              label="표시 이름"
              autoComplete="name"
              error={!!errors.displayName}
              helperText={errors.displayName?.message}
            />

            <TextField
              {...register('password', {
                required: '비밀번호를 입력해주세요',
                minLength: {
                  value: 6,
                  message: '비밀번호는 최소 6자 이상이어야 합니다',
                },
              })}
              margin="normal"
              fullWidth
              id="password"
              label="비밀번호"
              type="password"
              autoComplete="new-password"
              error={!!errors.password}
              helperText={errors.password?.message}
            />

            <TextField
              {...register('confirmPassword', {
                required: '비밀번호 확인을 입력해주세요',
                validate: (value) =>
                  value === watchPassword || '비밀번호가 일치하지 않습니다',
              })}
              margin="normal"
              fullWidth
              id="confirmPassword"
              label="비밀번호 확인"
              type="password"
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isSubmitting}
              sx={{ mt: 3, mb: 2 }}
            >
              {isSubmitting ? '가입 중...' : '회원가입'}
            </Button>

            <Divider sx={{ my: 2 }}>또는</Divider>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleSignup}
              sx={{ mb: 2 }}
            >
              Google로 가입
            </Button>

            <Box textAlign="center">
              <Typography variant="body2">
                이미 계정이 있으신가요?{' '}
                <Link href="/login" style={{ color: '#1976d2', textDecoration: 'none' }}>
                  로그인
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}