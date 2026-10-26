import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required")
});

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({
        success: true,
        user
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        token: result.token,
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser(req.user!.id);
      res.status(200).json({
        success: true,
        user
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
