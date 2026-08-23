import { Router } from 'express';

import { requireAdmin } from '../middleware/admin.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  TicketCandidateConflict,
  TicketCandidateService,
  TicketCandidateValidation,
} from '../services/ticket-candidate.service.js';

const router: Router = Router();
const service = new TicketCandidateService();

function batonToken(req: Parameters<typeof authenticateToken>[0]): string {
  const value = req.headers['x-baton-access-token'];
  return typeof value === 'string' ? value : '';
}

function sendError(res: any, error: unknown) {
  if (error instanceof TicketCandidateConflict)
    return res.status(409).json({ error: error.message });
  if (error instanceof TicketCandidateValidation)
    return res.status(400).json({ error: error.message });
  return res.status(502).json({ error: 'Baton publication is temporarily unavailable' });
}

router.post('/conversations/:intakeId/generate', authenticateToken, async (req, res) => {
  try {
    return res.json({
      data: { candidates: await service.generate(req.user!.id, req.params.intakeId) },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    return res.json({ data: { candidates: await service.listPersonalTodos(req.user!.id) } });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/conversations/:intakeId', authenticateToken, async (req, res) => {
  try {
    return res.json({
      data: { candidates: await service.list(req.user!.id, req.params.intakeId) },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const expectedRevision = Number(req.body?.expectedRevision);
    if (!Number.isInteger(expectedRevision))
      throw new TicketCandidateValidation('expectedRevision is required');
    const candidate = await service.update(req.user!.id, req.params.id, expectedRevision, {
      title: req.body?.title,
      description: req.body?.description,
      projectId: req.body?.projectId,
    });
    return res.json({ data: { candidate } });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/decision', authenticateToken, async (req, res) => {
  try {
    if (req.body?.decision !== 'accepted' && req.body?.decision !== 'rejected') {
      throw new TicketCandidateValidation('decision must be accepted or rejected');
    }
    const expectedRevision = Number(req.body?.expectedRevision);
    if (!Number.isInteger(expectedRevision))
      throw new TicketCandidateValidation('expectedRevision is required');
    const candidate = await service.decide(
      req.user!.id,
      req.params.id,
      expectedRevision,
      req.body.decision,
      req.body?.projectId
    );
    return res.json({ data: { candidate } });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/publish', authenticateToken, async (req, res) => {
  try {
    const result = await service.publish(req.user!.id, req.params.id, batonToken(req));
    return res.json({ data: result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/revoke', authenticateToken, async (req, res) => {
  try {
    const expectedRevision = Number(req.body?.expectedRevision);
    if (!Number.isInteger(expectedRevision))
      throw new TicketCandidateValidation('expectedRevision is required');
    const candidate = await service.revoke(req.user!.id, req.params.id, expectedRevision);
    return res.json({ data: { candidate } });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await service.remove(req.user!.id, req.params.id);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/admin-retry', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await service.publishAsAdmin(req.params.id, batonToken(req));
    return res.json({ data: result });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
