import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/environment';
import { Database } from './config/database';
import { logger } from './utils/logger';
import { YjsWebSocketServer } from './websocket/yjs-server';

// Routes
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import documentRoutes from './routes/document.routes';
import documentShareRoutes from './routes/document-share.routes';
import collaborationRoutes from './routes/collaboration.routes';

class App {
  public app: express.Application;
  private database: Database;
  private wsServer: YjsWebSocketServer;

  constructor() {
    this.app = express();
    this.database = Database.getInstance();
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors(config.cors));
    
    // Compression
    this.app.use(compression());
    
    // Logging
    if (config.nodeEnv !== 'test') {
      this.app.use(morgan('combined'));
    }
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: {
        error: 'Too many requests from this IP, please try again later'
      }
    });
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/projects', projectRoutes);
    this.app.use('/api/documents', documentRoutes);
    this.app.use('/api', documentShareRoutes);
    this.app.use('/api/collaboration', collaborationRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      
      res.status(500).json({
        error: config.nodeEnv === 'production' 
          ? 'Internal server error' 
          : error.message,
        ...(config.nodeEnv !== 'production' && { stack: error.stack })
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.database.connect();
      logger.info('Database connected successfully');

      // Start WebSocket server
      this.wsServer = new YjsWebSocketServer(config.wsPort);
      logger.info(`WebSocket server started on port ${config.wsPort}`);

      // Start HTTP server
      const port = config.port;
      this.app.listen(port, () => {
        logger.info(`HTTP server is running on port ${port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the application
if (require.main === module) {
  const app = new App();
  app.start();
}

export default App;