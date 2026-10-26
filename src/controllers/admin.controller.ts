import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { adminService } from "../services/admin.service";

export const rejectPostSchema = z.object({
  rejectionReason: z.string().trim().max(500, "Rejection reason cannot exceed 500 characters").optional()
});

export const pendingQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional()
});

export class AdminController {
  async getPendingPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.getPendingPosts(req.query as any);
      res.status(200).json({
        success: true,
        posts: result.posts,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  async approvePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await adminService.approvePost(req.params.id);
      res.status(200).json({
        success: true,
        post
      });
    } catch (error) {
      next(error);
    }
  }

  async rejectPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await adminService.rejectPost(
        req.params.id,
        req.body?.rejectionReason
      );
      res.status(200).json({
        success: true,
        post
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
