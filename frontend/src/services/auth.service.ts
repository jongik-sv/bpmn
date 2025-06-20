import { apiClient, handleApiError } from './api';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types';

export class AuthService {
  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      
      if (response.token) {
        apiClient.setAuthToken(response.token);
      }
      
      return response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', userData);
      
      if (response.token) {
        apiClient.setAuthToken(response.token);
      }
      
      return response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Even if logout fails, clear local token
      console.error('Logout error:', error);
    } finally {
      apiClient.clearAuthToken();
    }
  }

  // Profile management
  async getProfile(): Promise<User> {
    try {
      const response = await apiClient.get<{ user: User }>('/auth/profile');
      return response.user;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.put<{ user: User }>('/auth/profile', updates);
      return response.user;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Token management
  async refreshToken(): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/refresh');
      
      if (response.token) {
        apiClient.setAuthToken(response.token);
      }
      
      return response;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // User search
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    try {
      const response = await apiClient.get<{ users: User[] }>('/auth/search', {
        params: { q: query, limit },
      });
      return response.users;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!apiClient['getAuthToken']();
  }

  // Get current auth token
  getAuthToken(): string | null {
    return apiClient['getAuthToken']();
  }
}

// Export singleton instance
export const authService = new AuthService();