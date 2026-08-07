import { Router } from 'express';
import { authRateLimit } from '../middleware/rate-limit.js';
import { exchangeMystiraIdToken } from '../services/mystira-auth.service.js';
import { logger } from '../utils/logger.js';

const router: Router = Router();

// Placeholder routes - implement authentication logic here
router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint' });
});

router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint' });
});

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
