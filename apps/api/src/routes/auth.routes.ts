import { Router } from 'express';

import { authenticateToken } from '../middleware/auth.middleware.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import { authService } from '../services/auth.service.js';
import { ConversationIntakeError } from '../services/conversation-intake.service.js';
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

// Deletes the caller's account and every conversation they've imported
// (messages, transcripts, ticket candidates, and stored artifacts cascade
// with it — see ConversationIntakeService.deleteForUser). Irreversible, so
// it requires an explicit confirmation in the body rather than just a token.
router.delete('/account', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.body?.confirm !== 'DELETE') {
    return res.status(400).json({
      error:
        'Confirmation required: send { "confirm": "DELETE" } to permanently delete this account',
    });
  }

  try {
    const result = await authService.deleteAccount(userId);
    return res.json({
      message: 'Account and all associated conversations have been deleted',
      deletedConversationCount: result.deletedConversationCount,
    });
  } catch (error) {
    if (error instanceof ConversationIntakeError && error.code === 'ACCOUNT_DELETION_IN_PROGRESS') {
      return res.status(409).json({ error: error.message, code: error.code });
    }
    logger.error('Error deleting account:', error);
    return res.status(500).json({
      error: 'Failed to delete the account. Please try again shortly.',
    });
  }
});

export { router as default };
