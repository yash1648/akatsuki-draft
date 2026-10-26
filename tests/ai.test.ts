import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { User } from "../src/models/User";
import { Post } from "../src/models/Post";
import { aiService } from "../src/services/ai.service";

describe("AI Content Improvement Module (/ai/improve/:postId)", () => {
  let userToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let post: any;

  beforeEach(async () => {
    // User 1
    const u1 = await User.create({
      name: "Nagato",
      email: "nagato@akatsuki.org",
      password: "password123",
      role: "user"
    });
    userId = u1._id.toString();
    const login1 = await request(app).post("/auth/login").send({
      email: "nagato@akatsuki.org",
      password: "password123"
    });
    userToken = login1.body.token;

    // User 2
    const u2 = await User.create({
      name: "Konan",
      email: "konan@akatsuki.org",
      password: "password123",
      role: "user"
    });
    otherUserId = u2._id.toString();
    const login2 = await request(app).post("/auth/login").send({
      email: "konan@akatsuki.org",
      password: "password123"
    });
    otherUserToken = login2.body.token;

    // Create a base post owned by User 1
    post = await Post.create({
      title: "original raw draft title",
      description: "original short description",
      content: "this is some raw content with bad grammer and ideas.",
      image: "https://example.com/cover.png",
      category: "Philosophy",
      createdBy: userId,
      status: "draft"
    });
  });

  it("should successfully generate a new improved draft and leave the original unchanged (FR-AI-1 & FR-AI-2)", async () => {
    // Mock the external LLM generation method
    vi.spyOn(aiService, "callLlm").mockResolvedValueOnce({
      title: "Enhanced Philosophy of Peace",
      description: "A refined and compelling overview.",
      content: "This is well-structured, eloquently phrased prose about peace."
    });

    const res = await request(app)
      .post(`/ai/improve/${post._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const newDraft = res.body.post;
    expect(newDraft).toBeDefined();
    expect(newDraft._id).not.toBe(post._id.toString()); // New document ID
    expect(newDraft.title).toBe("Enhanced Philosophy of Peace");
    expect(newDraft.description).toBe("A refined and compelling overview.");
    expect(newDraft.content).toBe(
      "This is well-structured, eloquently phrased prose about peace."
    );
    expect(newDraft.category).toBe("Philosophy"); // Preserved from original
    expect(newDraft.image).toBe("https://example.com/cover.png"); // Preserved
    expect(newDraft.createdBy).toBe(userId);
    expect(newDraft.status).toBe("draft"); // Strictly draft
    expect(newDraft.parentPostId).toBe(post._id.toString()); // Linked to original

    // Verify original post is 100% UNCHANGED (FR-AI-1)
    const freshOriginal = await Post.findById(post._id);
    expect(freshOriginal?.title).toBe("original raw draft title");
    expect(freshOriginal?.description).toBe("original short description");
    expect(freshOriginal?.content).toBe(
      "this is some raw content with bad grammer and ideas."
    );
    expect(freshOriginal?.status).toBe("draft");
  });

  it("should reject non-owner attempting to improve another user's post with 403", async () => {
    const res = await request(app)
      .post(`/ai/improve/${post._id}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized to improve this post/i);
  });

  it("should return 404 if target post does not exist", async () => {
    const fakeId = "60c72b2f9b1d8b2bad6e89a1";
    const res = await request(app)
      .post(`/ai/improve/${fakeId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

  it("should return 401 if unauthenticated", async () => {
    const res = await request(app).post(`/ai/improve/${post._id}`);
    expect(res.status).toBe(401);
  });

  it("should handle AI provider failure and return 502 Bad Gateway (NFR-PERF-2)", async () => {
    vi.spyOn(aiService, "callLlm").mockRejectedValueOnce(
      new Error("LLM provider 500 internal error")
    );

    const res = await request(app)
      .post(`/ai/improve/${post._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/AI provider failure|upstream service/i);

    // Ensure no partial or corrupted draft was created
    const allPosts = await Post.find({ createdBy: userId });
    expect(allPosts).toHaveLength(1); // Only original remains
  });

  it("should handle AI timeout and return 504 Gateway Timeout (NFR-PERF-2)", async () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "AbortError";
    vi.spyOn(aiService, "callLlm").mockRejectedValueOnce(timeoutErr);

    const res = await request(app)
      .post(`/ai/improve/${post._id}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
  });
});
