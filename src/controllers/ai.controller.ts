import { Request, Response, NextFunction } from "express";
import { aiService } from "../services/ai.service";

export class AiController {
  async improvePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await aiService.improvePost(req.params.postId, req.user!.id);
      res.status(201).json({
        success: true,
        post
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AiController();
