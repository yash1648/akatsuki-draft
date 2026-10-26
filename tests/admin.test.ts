import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { User } from "../src/models/User";
import { Post } from "../src/models/Post";

describe("Admin Moderation Module (/admin/posts)", () => {
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;

  beforeEach(async () => {
    // Create standard user
    const u = await User.create({
      name: "Author User",
      email: "author@akatsuki.org",
      password: "password123",
      role: "user"
    });
    userId = u._id.toString();
    const loginUser = await request(app).post("/auth/login").send({
      email: "author@akatsuki.org",
      password: "password123"
    });
    userToken = loginUser.body.token;

    // Create admin user
    const admin = await User.create({
      name: "Tsunade Admin",
      email: "tsunade@konoha.org",
      password: "password123",
      role: "admin"
    });
    adminId = admin._id.toString();
    const loginAdmin = await request(app).post("/auth/login").send({
      email: "tsunade@konoha.org",
      password: "password123"
    });
    adminToken = loginAdmin.body.token;
  });

  describe("RBAC Access Gates", () => {
    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/admin/posts/pending");
      expect(res.status).toBe(401);
    });

    it("should reject standard user with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/admin/posts/pending")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/access denied/i);
    });
  });

  describe("GET /admin/posts/pending", () => {
    beforeEach(async () => {
      // Create posts in different states
      await Post.create({
        title: "Draft Post",
        content: "Draft",
        category: "Tech",
        createdBy: userId,
        status: "draft"
      });
      await Post.create({
        title: "Pending Post 1",
        content: "Pending 1",
        category: "Tech",
        createdBy: userId,
        status: "pending"
      });
      await Post.create({
        title: "Pending Post 2",
        content: "Pending 2",
        category: "Design",
        createdBy: userId,
        status: "pending"
      });
      await Post.create({
        title: "Approved Post",
        content: "Approved",
        category: "News",
        createdBy: userId,
        status: "approved"
      });
    });

    it("should return only pending posts to admin", async () => {
      const res = await request(app)
        .get("/admin/posts/pending")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.posts).toHaveLength(2);
      expect(res.body.posts.every((p: any) => p.status === "pending")).toBe(true);
    });

    it("should support pagination for pending posts", async () => {
      const res = await request(app)
        .get("/admin/posts/pending?page=1&limit=1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.pages).toBe(2);
    });
  });

  describe("PATCH /admin/posts/approve/:id", () => {
    it("should approve a pending post (FR-ADMIN-1)", async () => {
      const post = await Post.create({
        title: "Waiting for Approval",
        content: "Please approve me",
        category: "News",
        createdBy: userId,
        status: "pending"
      });

      const res = await request(app)
        .patch(`/admin/posts/approve/${post._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.post.status).toBe("approved");

      // Verify in DB
      const updated = await Post.findById(post._id);
      expect(updated?.status).toBe("approved");
    });

    it("should reject approving a draft post with 400 (FR-ADMIN-1)", async () => {
      const post = await Post.create({
        title: "Private Draft",
        content: "User did not submit this yet",
        category: "News",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .patch(`/admin/posts/approve/${post._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in pending state/i);
    });

    it("should reject approving an already approved post with 400", async () => {
      const post = await Post.create({
        title: "Already Approved",
        content: "Content",
        category: "News",
        createdBy: userId,
        status: "approved"
      });

      const res = await request(app)
        .patch(`/admin/posts/approve/${post._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in pending state/i);
    });

    it("should return 404 if post does not exist", async () => {
      const fakeId = "60c72b2f9b1d8b2bad6e89a1";
      const res = await request(app)
        .patch(`/admin/posts/approve/${fakeId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("should reject standard user attempting to approve with 403", async () => {
      const post = await Post.create({
        title: "Pending Post",
        content: "Content",
        category: "News",
        createdBy: userId,
        status: "pending"
      });

      const res = await request(app)
        .patch(`/admin/posts/approve/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /admin/posts/reject/:id", () => {
    it("should reject a pending post and save optional rejection reason (FR-ADMIN-1 & §6.3)", async () => {
      const post = await Post.create({
        title: "Spammy Post",
        content: "Spam content",
        category: "Ads",
        createdBy: userId,
        status: "pending"
      });

      const res = await request(app)
        .patch(`/admin/posts/reject/${post._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          rejectionReason: "Content does not adhere to platform publishing guidelines."
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.post.status).toBe("rejected");
      expect(res.body.post.rejectionReason).toBe(
        "Content does not adhere to platform publishing guidelines."
      );

      // Verify in DB
      const updated = await Post.findById(post._id);
      expect(updated?.status).toBe("rejected");
      expect(updated?.rejectionReason).toBe(
        "Content does not adhere to platform publishing guidelines."
      );
    });

    it("should reject rejecting a draft post with 400 (FR-ADMIN-1)", async () => {
      const post = await Post.create({
        title: "Private Draft",
        content: "Unsubmitted",
        category: "News",
        createdBy: userId,
        status: "draft"
      });

      const res = await request(app)
        .patch(`/admin/posts/reject/${post._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not in pending state/i);
    });

    it("should return 404 if post does not exist", async () => {
      const fakeId = "60c72b2f9b1d8b2bad6e89a1";
      const res = await request(app)
        .patch(`/admin/posts/reject/${fakeId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("should reject standard user attempting to reject with 403", async () => {
      const post = await Post.create({
        title: "Pending Post",
        content: "Content",
        category: "News",
        createdBy: userId,
        status: "pending"
      });

      const res = await request(app)
        .patch(`/admin/posts/reject/${post._id}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});
