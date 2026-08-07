import { Router } from 'express';
import { authRateLimit } from '../middleware/rate-limit.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { exchangeMystiraIdToken } from '../services/mystira-auth.service.js';
import { logger } from '../utils/logger.js';
import authController from '../api/auth.controller.js';

const router: Router = Router();

// Local email/password credentials. Rate limited on the same policy as the
// Mystira exchange below, since both mint API tokens.
router.post('/login', authRateLimit, authController.login);

router.post('/register', authRateLimit, authController.register);

router.get('/profile', authenticateToken, authController.getProfile);

router.post('/mystira/exchange', authRateLimit, async (req, res) => {
  const idToken = req.body?.idToken;
  if (typeof idToken !== 'string' || !idToken) {
    return res.status(400).json({ error: 'Mystira Identity ID token is required' });
  }

  try {
    const result = await exchangeMystiraIdToken(idToken);
    return res.json(result);
  } catch (error) {
    logger.warn('Mystira extension token exchange failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(401).json({ error: 'Unable to authenticate the Mystira Identity session' });
  }
});

export { router as default };
