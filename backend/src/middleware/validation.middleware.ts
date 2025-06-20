import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      logger.warn('Validation error:', errorMessage);
      res.status(400).json({
        error: 'Validation failed',
        details: errorMessage
      });
      return;
    }
    
    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_-]+$/).required(),
    displayName: Joi.string().min(1).max(100).required(),
    password: Joi.string().min(8).max(128).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    displayName: Joi.string().min(1).max(100),
    avatar: Joi.string().uri(),
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark'),
      language: Joi.string().min(2).max(5),
      notifications: Joi.boolean()
    })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
  }),

  createProject: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500),
    visibility: Joi.string().valid('private', 'public', 'team').default('private'),
    tags: Joi.array().items(Joi.string().max(30)).max(10)
  }),

  updateProject: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().max(500),
    visibility: Joi.string().valid('private', 'public', 'team'),
    tags: Joi.array().items(Joi.string().max(30)).max(10),
    settings: Joi.object({
      allowComments: Joi.boolean(),
      allowExport: Joi.boolean(),
      autoSave: Joi.boolean(),
      autoSaveInterval: Joi.number().min(10).max(300)
    })
  }),

  createDocument: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    bpmnXml: Joi.string()
  }),

  updateDocument: Joi.object({
    name: Joi.string().min(1).max(100),
    bpmnXml: Joi.string()
  }),

  createComment: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    elementId: Joi.string(),
    parentId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required()
    }),
    mentions: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
  }),

  createShare: Joi.object({
    accessLevel: Joi.string().valid('editor', 'viewer').default('viewer'),
    shareType: Joi.string().valid('link', 'email').default('link'),
    settings: Joi.object({
      requireAuth: Joi.boolean().default(false),
      allowDownload: Joi.boolean().default(true),
      allowComment: Joi.boolean().default(true),
      expiresAt: Joi.date().greater('now'),
      accessLimit: Joi.number().min(1),
      password: Joi.string().min(4).max(50)
    }).default({})
  }),

  inviteUsers: Joi.object({
    emails: Joi.array().items(Joi.string().email()).min(1).max(10).required(),
    accessLevel: Joi.string().valid('editor', 'viewer').default('viewer'),
    message: Joi.string().max(500)
  })
};