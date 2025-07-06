import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const supabaseUrl = process.env.SUPABASE_URL || 'https://yigkpwxaemgcasxtopup.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2twd3hhZW1nY2FzeHRvcHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MDY1MzcsImV4cCI6MjA2NzI4MjUzN30.uMWtejlU7yqPwmthdgp4FhNGtpsW_JzmZR5RDMEv4JY';

// Supabase 클라이언트 생성 (개발 환경에서는 실제 연결 안 함)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    channels: {
      self: true,
      presence: {
        key: 'user_id'
      }
    }
  }
});

// 인증 상태 변경 감지
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};

// 현재 사용자 가져오기
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // Auth session missing은 정상적인 상황이므로 경고만 표시
      if (error.message.includes('Auth session missing')) {
        console.log('ℹ️ No user session found (not logged in)');
      } else {
        console.error('Error getting current user:', error);
      }
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
};

// 현재 사용자 (동기식 - 세션에서)
export const getCurrentUserSync = () => {
  const { data: { user } } = supabase.auth.getUser();
  return user;
};

// 로그인
export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  } catch (error) {
    console.error('Error in signIn:', error);
    return { data: null, error };
  }
};

// 회원가입
export const signUp = async (email, password, metadata = {}) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  } catch (error) {
    console.error('Error in signUp:', error);
    return { data: null, error };
  }
};

// 로그아웃
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Google OAuth 로그인
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  });
  return { data, error };
};

// 매직 링크 로그인 (이메일로만)
export const signInWithMagicLink = async (email) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin
    }
  });
  return { data, error };
};