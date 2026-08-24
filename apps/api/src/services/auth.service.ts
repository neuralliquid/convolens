import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../config/constants';
import { AppDataSource } from '../config/database';
import { User } from '../db/entities/User';
import { UserRole } from '../db/entities/User';
import { conversationIntakeService } from './conversation-intake.service';
import { logger } from '../utils/logger';

export function issueApiToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
  return jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h', subject: user.id }
  );
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  async register(email: string, password: string, name?: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email } });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = new User();
    user.email = email;
    user.password = password; // Will be hashed by the @BeforeInsert hook
    user.name = name;
    user.role = UserRole.USER;
    user.isActive = true;

    return this.userRepository.save(user);
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Update last login
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    // Generate JWT token
    const token = issueApiToken(user);

    return { user, token };
  }

  async getProfile(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Deletes a user's account and all of their data. `userId` here is the
   * subject identity attached to the request by authenticateToken — for a
   * Mystira-federated user (the live auth path) that's the Mystira `sub`,
   * for which no local User row exists at all, so the repository delete is
   * expected to affect 0 rows in the common case. The user's identity itself
   * (their Mystira login) is not managed by this app and is out of scope.
   *
   * Holds the account-deletion lock across both steps below, not just the
   * conversation sweep: deleteAllForUser's own confirming re-read (see its
   * docstring) only guarantees no conversation survives *while it runs* — if
   * it released the lock on return, a save() that started just after would
   * be free to commit a straggler conversation in the gap between that
   * return and this method's own user-row delete, for an account the API is
   * about to report as fully deleted. Claiming the lock here and passing it
   * into deleteAllForUser keeps that window closed until the user row is
   * actually gone too.
   */
  async deleteAccount(userId: string): Promise<{ deletedConversationCount: number }> {
    const lock = await conversationIntakeService.holdAccountDeletionLock(userId);
    try {
      let deletedCount: number;
      try {
        ({ deletedCount } = await conversationIntakeService.deleteAllForUser(userId, lock));
      } catch (error) {
        logger.error('Failed to delete conversations while deleting account:', error);
        throw error;
      }

      try {
        await this.userRepository.delete({ id: userId });
      } catch (error) {
        logger.error(
          `Conversations for user were deleted (${deletedCount}), but deleting the user row failed:`,
          error
        );
        throw error;
      }

      return { deletedConversationCount: deletedCount };
    } finally {
      await lock.release();
    }
  }
}

export const authService = new AuthService();
