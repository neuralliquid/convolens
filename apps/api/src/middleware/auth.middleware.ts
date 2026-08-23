import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../config/constants';
import { logger } from '../utils/logger';

declare global {
  // Express request augmentation follows the framework's namespace contract.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId?: string;
        email: string;
        name?: string;
        role?: string;
        authProvider?: string;
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('No authentication token provided');
    return res.sendStatus(401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (
      typeof decoded === 'string' ||
      typeof decoded.id !== 'string' ||
      typeof decoded.email !== 'string'
    ) {
      throw new Error('Token is missing the required user claims');
    }
    req.user = {
      id: decoded.id,
      userId: typeof decoded.userId === 'string' ? decoded.userId : undefined,
      email: decoded.email,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      role: typeof decoded.role === 'string' ? decoded.role : undefined,
      authProvider: typeof decoded.authProvider === 'string' ? decoded.authProvider : undefined,
    };
    return next();
  } catch (error) {
    logger.error('Invalid or expired token', { error });
    return res.sendStatus(403);
  }
};

export default {
  authenticateToken,
};
