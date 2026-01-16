import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { json, urlencoded } from 'body-parser';
import { initializeDatabase } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import groupRoutes from './routes/group.routes.js';
import chatExportRoutes from './routes/chat-export.routes.js';
import extensionRoutes from './routes/extension.routes.js';
import { logger } from './utils/logger.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { metricsMiddleware, metrics } from './services/metrics.service.js';
import { idempotencyMiddleware, deduplicationService } from './services/deduplication.service.js';
import { getAllCircuitBreakerStats } from './services/circuit-breaker.service.js';

export const createApp = (): Application => {
  const app = express();

  // Correlation ID middleware (must be first to capture all requests)
  app.use(correlationMiddleware);

  // Metrics middleware (after correlation for proper context)
  app.use(metricsMiddleware);

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    exposedHeaders: ['x-correlation-id', 'x-request-id'],
  }));
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Logging (skip in production as we have structured logging)
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Metrics endpoint (for monitoring)
  app.get('/metrics', (_req: Request, res: Response) => {
    res.status(200).json(metrics.getSummary());
  });

  // Circuit breaker status endpoint
  app.get('/circuit-breakers', (_req: Request, res: Response) => {
    res.status(200).json({
      circuitBreakers: getAllCircuitBreakerStats(),
      deduplication: deduplicationService.getStats(),
    });
  });

  // Idempotency middleware for POST/PUT/PATCH requests
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return idempotencyMiddleware(req, res, next);
    }
    next();
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/chat-export', chatExportRoutes);
  app.use('/api/extension', extensionRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Not Found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error:', err);
    res.status(500).json({
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
  });

  return app;
};

// Initialize database and start server if this file is run directly
if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      const app = createApp();
      const PORT = process.env.PORT || 3001;
      
      const server = app.listen(PORT, () => {
        logger.info(`Server is running on port ${PORT}`);
      });

      // Set up WebSocket
      const io = require('socket.io')(server, {
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3000',
          methods: ['GET', 'POST']
        }
      });
      
      require('./sockets/whatsapp.socket').initializeSocket(io);
      
      // Handle graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received. Shutting down gracefully');
        server.close(() => {
          logger.info('Process terminated');
          process.exit(0);
        });
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}

export default createApp;
