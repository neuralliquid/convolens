import 'reflect-metadata';
import http from 'http';

import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

import { createApp } from './app';
import { initializeDatabase } from './config/database';
import { initializeSocket } from './sockets/whatsapp.socket';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // Set up WebSocket
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    });

    // Initialize WebSocket handlers
    initializeSocket(io);

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

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
}

startServer();

export { startServer };
