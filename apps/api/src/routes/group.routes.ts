import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.js';
import groupController from '../api/group.controller.js';

const router: Router = Router();

// Every group route requires an authenticated caller.
router.use(authenticateToken);

router.get('/', groupController.getAllGroups);
router.post('/', groupController.createGroup);
router.get('/:id', groupController.getGroup);
router.put('/:id', groupController.updateGroup);
router.delete('/:id', requireAdmin, groupController.deleteGroup);
router.get('/:id/messages', groupController.getGroupMessages);

export { router as default };
