import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../../config/constants';
import { UserRole } from '../../db/entities/User';
import { issueApiToken } from '../auth.service';

describe('local API authentication', () => {
  it('issues middleware-compatible claims while preserving the stored admin role', () => {
    const token = issueApiToken({
      id: 'local-admin-123',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });

    expect(jwt.verify(token, JWT_SECRET)).toMatchObject({
      id: 'local-admin-123',
      userId: 'local-admin-123',
      email: 'admin@example.com',
      role: 'admin',
      sub: 'local-admin-123',
    });
  });
});
