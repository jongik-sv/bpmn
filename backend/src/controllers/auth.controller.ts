import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, username, displayName, password } = req.body;

      const result = await this.authService.register({
        email,
        username,
        displayName,
        password
      });

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Email already registered') || 
            error.message.includes('Username already taken')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      
      res.status(500).json({ error: 'Registration failed' });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const result = await this.authService.login(email, password);

      logger.info(`User logged in: ${email}`);

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token
      });
    } catch (error) {
      logger.error('Login error:', error);
      
      if (error instanceof Error && error.message === 'Invalid email or password') {
        res.status(401).json({ error: error.message });
        return;
      }
      
      res.status(500).json({ error: 'Login failed' });
    }
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      res.json({ user });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const updateData = req.body;

      const updatedUser = await this.authService.updateProfile(userId, updateData);

      logger.info(`User profile updated: ${updatedUser.email}`);

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      
      res.status(500).json({ error: 'Failed to update profile' });
    }
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!._id;
      const { currentPassword, newPassword } = req.body;

      await this.authService.changePassword(userId, currentPassword, newPassword);

      logger.info(`Password changed for user: ${req.user!.email}`);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Change password error:', error);
      
      if (error instanceof Error && error.message === 'Current password is incorrect') {
        res.status(400).json({ error: error.message });
        return;
      }
      
      res.status(500).json({ error: 'Failed to change password' });
    }
  };

  searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q, limit } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      const users = await this.authService.searchUsers(
        q,
        limit ? parseInt(limit as string) : 10
      );

      res.json({ users });
    } catch (error) {
      logger.error('Search users error:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const newToken = this.authService.generateToken(user._id);

      res.json({
        message: 'Token refreshed successfully',
        token: newToken,
        user
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // For JWT, logout is handled client-side by removing the token
      // Here we could add token to a blacklist if needed
      
      logger.info(`User logged out: ${req.user!.email}`);
      
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  };
}