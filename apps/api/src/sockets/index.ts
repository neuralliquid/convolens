import { Server as HttpServer } from 'http';

import { verify } from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';

import { JWT_SECRET } from '../config/constants';
import { AppDataSource } from '../config/database';
import { User } from '../db/entities/User';
import { logger } from '../utils/logger';

declare module 'socket.io' {
  interface Socket {
    user?: User;
  }
}

export const initWebSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verify(token, JWT_SECRET) as { userId: string };
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: decoded.userId } });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`User ${socket.user?.email} connected to WebSocket`);

    // Join room for user-specific messages
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
    }

    // Handle group subscriptions
    socket.on('subscribe', (groupId: string) => {
      if (socket.user) {
        socket.join(`group:${groupId}`);
        logger.info(`User ${socket.user.email} subscribed to group ${groupId}`);
      }
    });

    // Handle group unsubscriptions
    socket.on('unsubscribe', (groupId: string) => {
      socket.leave(`group:${groupId}`);
      logger.info(`User ${socket.user?.email} unsubscribed from group ${groupId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User ${socket.user?.email} disconnected from WebSocket`);
    });
  });

  return io;
};

export const emitToGroup = (io: Server, groupId: string, event: string, data: any) => {
  io.to(`group:${groupId}`).emit(event, data);
};

export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};
