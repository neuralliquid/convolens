import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  private authService = new AuthService();

  // Arrow properties keep `this` bound when the handler is passed to a router
  // by reference, which is how the route module wires these up.
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;
      const user = await this.authService.register(email, password, name);
      res.status(201).json({ message: 'User registered successfully', userId: user.id });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { user, token } = await this.authService.login(email, password);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  };

  getProfile = async (req: Request, res: Response): Promise<void> => {
    // `req.user` carries the token claims from authenticateToken, not a User row.
    const claims = req.user;
    if (!claims) {
      res.sendStatus(401);
      return;
    }

    try {
      const user = await this.authService.getProfile(claims.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };
}

export default new AuthController();
