import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { User } from "../src/models/User";
import { Post } from "../src/models/Post";

describe("User Post Management Module (/posts)", () => {
  let userToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let adminToken: string;
  let adminId: string;

  beforeEach(async () => {
    // Create standard user 1
    const u1 = await User.create({
      name: "Author One",
      email: "author1@akatsuki.org",
      password: "password123",
      role: "user"
    });
    userId = u1._id.toString();
    const login1 = await request(app).post("/auth/login").send({
      email: "author1@akatsuki.org",
      password: "password123"
    });
    userToken = login1.body.token;

    // Create standard user 2
    const u2 = await User.create({
      name: "Author Two",
      email: "author2@akatsuki.org",
      password: "password123",
      role: "user"
    });
    otherUserId = u2._id.toString();
    const login2 = await request(app).post("/auth/login").send({
      email: "author2@akatsuki.org",
      password: "password123"
    });
    otherUserToken = login2.body.token;

    // Create admin user
    const admin = await User.create({
      name: "Admin User",
      email: "admin@akatsuki.org",
      password: "password123",
      role: "admin"
    });
    adminId = admin._id.toString();
    const loginAdmin = await request(app).post("/auth/login").send({
      email: "admin@akatsuki.org",
      password: "password123"
    });
    adminToken = loginAdmin.body.token;
  });

  describe("POST /posts", () => {
    it("should allow authenticated user to create a post with default status 'draft'", async () => {
      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "First Post Title",
          description: "A short excerpt",
          content: "Body content of the first post.",
          category: "Technology"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.post.title).toBe("First Post Title");
      expect(res.body.post.status).toBe("draft");
      expect(res.body.post.createdBy).toBe(userId);
    });

    it("should allow user to explicitly set status to 'pending'", async () => {
      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Submitting for Review",
          content: "Ready for admin moderation.",
          category: "News",
          status: "pending"
        });

      expect(res.status).toBe(201);
      expect(res.body.post.status).toBe("pending");
    });

    it("should reject standard user attempting status 'approved' with 403 (FR-POST-1)", async () => {
      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Unauthorized Direct Publish",
          content: "Trying to bypass admin moderation.",
          category: "Hacks",
          status: "approved"
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot set status to 'approved' or 'rejected'/i);
    });

    it("should reject standard user attempting status 'rejected' with 403 (FR-POST-1)", async () => {
      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Setting Rejected",
          content: "Why reject upfront?",
          category: "Hacks",
          status: "rejected"
        });

      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app)
        .post("/posts")
        .send({
          title: "No Auth",
          content: "Content",
          category: "General"
        });

      expect(res.status).toBe(401);
    });

    it("should reject missing required fields with 400", async () => {
      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Missing category and content"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /posts (Public Feed)", () => {
    beforeEach(async () => {
      // Create approved post 1
      await Post.create({
        title: "Approved Post 1",
        content: "Content 1",
        category: "Tech",
        createdBy: userId,
        status: "approved"
      });

      // Create approved post 2
      await Post.create({
        title: "Approved Post 2",
        content: "Content 2",
        category: "Design",
        createdBy: otherUserId,
        status: "approved"
      });

      // Create draft post (should not appear in public feed)
      await Post.create({
        title: "Draft Post",
        content: "Draft content",
        category: "Tech",
        createdBy: userId,
        status: "draft"
      });

      // Create pending post (should not appear in public feed)
      await Post.create({
        title: "Pending Post",
        content: "Pending review",
        category: "Tech",
        createdBy: userId,
        status: "pending"
      });

      // Create rejected post (should not appear in public feed)
      await Post.create({
        title: "Rejected Post",
        content: "Rejected review",
        category: "Design",
        createdBy: otherUserId,
        status: "rejected"
      });
    });

    it("should return only approved posts to public guests", async () => {
      const res = await request(app).get("/posts");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.posts.every((p: any) => p.status === "approved")).toBe(true);
    });

    it("should filter approved posts by category query parameter", async () => {
      const res = await request(app).get("/posts?category=Design");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].title).toBe("Approved Post 2");
    });

    it("should support pagination (?page=&limit=)", async () => {
      const res = await request(app).get("/posts?page=1&limit=1");

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.pages).toBe(2);
    });
  });

  describe("GET /posts/my-posts", () => {
    beforeEach(async () => {
      await Post.create({
        title: "Author 1 Draft",
        content: "Draft",
        category: "Tech",
        createdBy: userId,
        status: "draft"
      });
      await Post.create({
        title: "Author 1 Pending",
        content: "Pending",
        category: "Tech",
        createdBy: userId,
        status: "pending"
      });
      await Post.create({
        title: "Author 1 Approved",
        content: "Approved",
        category: "Tech",
        createdBy: userId,
        status: "approved"
      });
      await Post.create({
        title: "Author 2 Post",
        content: "Author 2",
        category: "Tech",
        createdBy: otherUserId,
        status: "draft"
      });
    });

    it("should return all posts created by the authenticated user across all statuses", async () => {
      const res = await request(app)
        .get("/posts/my-posts")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.posts).toHaveLength(3);
      expect(res.body.posts.every((p: any) => p.createdBy === userId)).toBe(true);
    });

    it("should filter my-posts by status query (?status=draft)", async () => {
      const res = await request(app)
        .get("/posts/my-posts?status=draft")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].title).toBe("Author 1 Draft");
    });

    it("should reject unauthenticated request to /my-posts with 401", async () => {
      const res = await request(app).get("/posts/my-posts");
      expect(res.status).toBe(401);
    });

    it("should correctly handle route order so /my-posts is not treated as :id (FR-POST-3)", async () => {
      const res = await request(app)
        .get("/posts/my-posts")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // If it hit /posts/:id, it would throw CastError or return 404 for id="my-posts"
    });
  });

  describe("GET /posts/:id", () => {
    it("should return approved post to guest", async () => {
      const post = await Post.create({
        title: "Public Approved Post",
        content: "Everyone can read this",
        category: "Public",
        createdBy: userId,
        status: "approved"
      });

      const res = await request(app).get(`/posts/${post._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.post.title).toBe("Public Approved Post");
    });

    it("should return 404 to guest when post is draft/pending/rejected", async () => {
      const draft = await Post.create({
        title: "Secret Draft",
        content: "Top secret",
        category: "Private",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app).get(`/posts/${draft._id}`);
      expect(res.status).toBe(404);
    });

    it("should allow author to view their own unapproved draft (Recommendation §6.1)", async () => {
      const draft = await Post.create({
        title: "Author's Own Draft",
        content: "Only I should see this before submitting",
        category: "Private",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .get(`/posts/${draft._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.post.title).toBe("Author's Own Draft");
    });

    it("should allow admin to view any unapproved post by ID", async () => {
      const draft = await Post.create({
        title: "User's Draft",
        content: "Admin inspects",
        category: "Private",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .get(`/posts/${draft._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.post.title).toBe("User's Draft");
    });

    it("should return 404 if post does not exist", async () => {
      const fakeId = "60c72b2f9b1d8b2bad6e89a1";
      const res = await request(app).get(`/posts/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /posts/:id", () => {
    it("should allow author to update post fields", async () => {
      const post = await Post.create({
        title: "Original Title",
        content: "Original Content",
        category: "Tech",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .patch(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Updated Title",
          content: "Updated Content"
        });

      expect(res.status).toBe(200);
      expect(res.body.post.title).toBe("Updated Title");
      expect(res.body.post.content).toBe("Updated Content");
    });

    it("should reject non-owner attempting to update post with 403", async () => {
      const post = await Post.create({
        title: "Author One's Post",
        content: "Original Content",
        category: "Tech",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .patch(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({
          title: "Hacked Title"
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized to update this post/i);
    });

    it("should revert status to 'draft' when an approved post is edited (FR-POST-2)", async () => {
      const post = await Post.create({
        title: "Approved Post",
        content: "Live content",
        category: "News",
        createdBy: userId,
        status: "approved"
      });

      const res = await request(app)
        .patch(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          content: "Sneaky modification to live post"
        });

      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe("draft"); // Reverted so unreviewed edits cannot go live!
    });

    it("should revert status to 'pending' if user explicitly requests pending on edit (FR-POST-2)", async () => {
      const post = await Post.create({
        title: "Approved Post",
        content: "Live content",
        category: "News",
        createdBy: userId,
        status: "approved"
      });

      const res = await request(app)
        .patch(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          content: "Modified and immediately resubmitted",
          status: "pending"
        });

      expect(res.status).toBe(200);
      expect(res.body.post.status).toBe("pending");
    });

    it("should reject standard user attempting status 'approved' on PATCH with 403 (FR-POST-1)", async () => {
      const post = await Post.create({
        title: "Draft Post",
        content: "Content",
        category: "News",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .patch(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          status: "approved"
        });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /posts/:id", () => {
    it("should allow author to delete their own post", async () => {
      const post = await Post.create({
        title: "To Be Deleted",
        content: "Bye",
        category: "Trash",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .delete(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const found = await Post.findById(post._id);
      expect(found).toBeNull();
    });

    it("should reject non-owner attempting to delete post with 403", async () => {
      const post = await Post.create({
        title: "Author One's Post",
        content: "Cannot touch",
        category: "Shield",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .delete(`/posts/${post._id}`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);

      const found = await Post.findById(post._id);
      expect(found).not.toBeNull();
    });

    it("should return 404 when deleting non-existent post", async () => {
      const fakeId = "60c72b2f9b1d8b2bad6e89a1";
      const res = await request(app)
        .delete(`/posts/${fakeId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });
  });
});
