import { Types } from "mongoose";
import { Post, IPost, PostStatus } from "../models/Post";
import { UserRole } from "../models/User";
import { ApiError } from "../utils/apiError";

export interface CreatePostDTO {
  title: string;
  description?: string;
  content: string;
  image?: string | null;
  category: string;
  status?: PostStatus;
}

export interface UpdatePostDTO {
  title?: string;
  description?: string;
  content?: string;
  image?: string | null;
  category?: string;
  status?: PostStatus;
}

export interface PostQueryOptions {
  category?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPostsResult {
  posts: IPost[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class PostService {
  async createPost(
    authorId: string,
    userRole: UserRole,
    data: CreatePostDTO
  ): Promise<IPost> {
    const requestedStatus = data.status || "draft";

    // FR-POST-1: Standard users may only set status to "draft" or "pending"
    if (userRole !== "admin" && (requestedStatus === "approved" || requestedStatus === "rejected")) {
      throw ApiError.forbidden(
        "Standard users cannot set status to 'approved' or 'rejected'"
      );
    }

    const post = new Post({
      title: data.title,
      description: data.description !== undefined ? data.description : "",
      content: data.content,
      image: data.image || null,
      category: data.category,
      createdBy: new Types.ObjectId(authorId),
      status: requestedStatus
    });

    await post.save();
    return post;
  }

  async getApprovedPosts(options: PostQueryOptions): Promise<PaginatedPostsResult> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { status: "approved" };
    if (options.category) {
      filter.category = options.category;
    }

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

  async getMyPosts(userId: string, status?: string): Promise<IPost[]> {
    const filter: Record<string, any> = {
      createdBy: new Types.ObjectId(userId)
    };

    if (status) {
      filter.status = status;
    }

    return Post.find(filter).sort({ createdAt: -1 });
  }

  async getPostById(
    postId: string,
    user?: { id: string; role: UserRole }
  ): Promise<IPost> {
    const post = await Post.findById(postId).populate("createdBy", "name email");
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // If post is approved, everyone can view
    if (post.status === "approved") {
      return post;
    }

    // If not approved, author or admin can view per Recommendation §6.1
    if (user) {
      const isOwner =
        (post.createdBy as any)._id?.toString() === user.id ||
        post.createdBy.toString() === user.id;
      const isAdmin = user.role === "admin";
      if (isOwner || isAdmin) {
        return post;
      }
    }

    // Otherwise, treat as not found to guests and unauthorized users
    throw ApiError.notFound("Post not found");
  }

  async updatePost(
    postId: string,
    userId: string,
    userRole: UserRole,
    data: UpdatePostDTO
  ): Promise<IPost> {
    const post = await Post.findById(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // Owner check: only owner (or admin) can update post
    const isOwner = post.createdBy.toString() === userId;
    if (!isOwner && userRole !== "admin") {
      throw ApiError.forbidden("Not authorized to update this post");
    }

    // FR-POST-1: Standard user cannot set status to approved or rejected
    if (
      userRole !== "admin" &&
      data.status &&
      (data.status === "approved" || data.status === "rejected")
    ) {
      throw ApiError.forbidden(
        "Standard users cannot set status to 'approved' or 'rejected'"
      );
    }

    // FR-POST-2: Edit Reset Rule:
    // If post is currently approved or rejected, edits must revert status
    if (post.status === "approved" || post.status === "rejected") {
      if (data.status === "pending") {
        post.status = "pending";
      } else {
        post.status = "draft";
      }
    } else if (data.status) {
      post.status = data.status;
    }

    if (data.title !== undefined) post.title = data.title;
    if (data.description !== undefined) post.description = data.description;
    if (data.content !== undefined) post.content = data.content;
    if (data.image !== undefined) post.image = data.image;
    if (data.category !== undefined) post.category = data.category;

    await post.save();
    return post;
  }

  async deletePost(
    postId: string,
    userId: string,
    userRole: UserRole
  ): Promise<void> {
    const post = await Post.findById(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    const isOwner = post.createdBy.toString() === userId;
    if (!isOwner && userRole !== "admin") {
      throw ApiError.forbidden("Not authorized to delete this post");
    }

    await Post.findByIdAndDelete(postId);
  }
}

export const postService = new PostService();
