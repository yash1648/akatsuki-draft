import { Post, IPost } from "../models/Post";
import { ApiError } from "../utils/apiError";

export interface PendingPostsOptions {
  page?: number;
  limit?: number;
}

export class AdminService {
  async getPendingPosts(options: PendingPostsOptions): Promise<{
    posts: IPost[];
    pagination: { total: number; page: number; limit: number; pages: number };
  }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = { status: "pending" };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email"),
      Post.countDocuments(filter)
    ]);

    return {
      posts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      }
    };
  }

  async approvePost(postId: string): Promise<IPost> {
    const post = await Post.findById(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // FR-ADMIN-1: Only posts with status === "pending" can be approved
    if (post.status !== "pending") {
      throw ApiError.badRequest("Post is not in pending state");
    }

    post.status = "approved";
    await post.save();
    return post;
  }

  async rejectPost(postId: string, rejectionReason?: string): Promise<IPost> {
    const post = await Post.findById(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // FR-ADMIN-1: Only posts with status === "pending" can be rejected
    if (post.status !== "pending") {
      throw ApiError.badRequest("Post is not in pending state");
    }

    post.status = "rejected";
    if (rejectionReason !== undefined) {
      post.rejectionReason = rejectionReason;
    }
    await post.save();
    return post;
  }
}

export const adminService = new AdminService();
