import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { postService } from "../services/post.service";

export const createPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150, "Title cannot exceed 150 characters"),
  description: z.string().trim().max(300, "Description cannot exceed 300 characters").optional(),
  content: z.string().min(1, "Content is required"),
  image: z.string().url("Image must be a valid URL").nullable().optional(),
  category: z.string().trim().min(1, "Category is required"),
  status: z.enum(["draft", "pending", "approved", "rejected"]).optional()
});

export const updatePostSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(300).optional(),
  content: z.string().min(1).optional(),
  image: z.string().url().nullable().optional(),
  category: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "pending", "approved", "rejected"]).optional()
});

export const postQuerySchema = z.object({
  category: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional()
});

export class PostController {
  async createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await postService.createPost(
        req.user!.id,
        req.user!.role,
        req.body
      );
      res.status(201).json({
        success: true,
        post
      });
    } catch (error) {
      next(error);
    }
  }

  async getPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await postService.getApprovedPosts(req.query as any);
      res.status(200).json({
        success: true,
        posts: result.posts,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const posts = await postService.getMyPosts(req.user!.id, status);
      res.status(200).json({
        success: true,
        posts
      });
    } catch (error) {
      next(error);
    }
  }

  async getPostById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await postService.getPostById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        post
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await postService.updatePost(
        req.params.id,
        req.user!.id,
        req.user!.role,
        req.body
      );
      res.status(200).json({
        success: true,
        post
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await postService.deletePost(req.params.id, req.user!.id, req.user!.role);
      res.status(200).json({
        success: true,
        message: "Post deleted successfully"
      });
    } catch (error) {
      next(error);
    }
  }
}

export const postController = new PostController();
