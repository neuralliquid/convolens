import { Request, Response } from 'express';
import { GroupService } from '../services/group.service';

export class GroupController {
  private groupService = new GroupService();

  // Arrow properties keep `this` bound when the handler is passed to a router
  // by reference, which is how the route module wires these up.
  createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, metadata } = req.body;
      const group = await this.groupService.createGroup(name, description, metadata);
      res.status(201).json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const group = await this.groupService.getGroupById(id);
      if (!group) {
        res.status(404).json({ message: 'Group not found' });
        return;
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  getAllGroups = async (_req: Request, res: Response): Promise<void> => {
    try {
      const groups = await this.groupService.getAllGroups();
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  updateGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const group = await this.groupService.updateGroup(id, updates);
      if (!group) {
        res.status(404).json({ message: 'Group not found' });
        return;
      }
      res.json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  deleteGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.groupService.deleteGroup(id);
      if (!success) {
        res.status(404).json({ message: 'Group not found' });
        return;
      }
      res.json({ message: 'Group deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  getGroupMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const { messages, total } = await this.groupService.getGroupMessages(id, page, limit);

      res.json({
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

export default new GroupController();
