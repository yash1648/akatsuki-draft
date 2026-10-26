import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { User } from "../src/models/User";
import { Post } from "../src/models/Post";

describe("User Model Constraints & Behaviors", () => {
  it("should create a valid user with default role 'user'", async () => {
    const user = await User.create({
      name: "  Kakashi Hatake  ",
      email: "Kakashi@Konoha.org",
      password: "password123"
    });

    expect(user._id).toBeDefined();
    expect(user.name).toBe("Kakashi Hatake"); // Trimmed
    expect(user.email).toBe("kakashi@konoha.org"); // Lowercased
    expect(user.role).toBe("user"); // Default role
    expect(user.password).not.toBe("password123"); // Hashed with bcrypt
    expect(await user.comparePassword("password123")).toBe(true);
    expect(await user.comparePassword("wrongpassword")).toBe(false);

    // Password must be excluded from toJSON()
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
  });

  it("should reject user with name shorter than 2 characters", async () => {
    await expect(
      User.create({
        name: "A",
        email: "a@konoha.org",
        password: "password123"
      })
    ).rejects.toThrow();
  });

  it("should reject invalid email formats", async () => {
    await expect(
      User.create({
        name: "Naruto Uzumaki",
        email: "invalid-email-address",
        password: "password123"
      })
    ).rejects.toThrow();
  });

  it("should enforce unique email constraint", async () => {
    await User.create({
      name: "Itachi Uchiha",
      email: "itachi@akatsuki.org",
      password: "password123"
    });

    await expect(
      User.create({
        name: "Itachi Clone",
        email: "itachi@akatsuki.org",
        password: "password456"
      })
    ).rejects.toThrow();
  });

  it("should reject invalid role enum values", async () => {
    await expect(
      User.create({
        name: "Kisame Hoshigaki",
        email: "kisame@akatsuki.org",
        password: "password123",
        role: "superadmin" as any
      })
    ).rejects.toThrow();
  });
});

describe("Post Model Constraints & Indexes", () => {
  it("should create a valid post with defaults", async () => {
    const user = await User.create({
      name: "Sasori",
      email: "sasori@akatsuki.org",
      password: "password123"
    });

    const post = await Post.create({
      title: "  Puppet Mastery  ",
      content: "Art is eternal.",
      category: "Ninjutsu",
      createdBy: user._id
    });

    expect(post.title).toBe("Puppet Mastery"); // Trimmed
    expect(post.description).toBe(""); // Default empty string
    expect(post.image).toBeNull(); // Default null
    expect(post.status).toBe("draft"); // Default draft
    expect(post.parentPostId).toBeNull();
    expect(post.rejectionReason).toBeNull();
    expect(post.createdAt).toBeInstanceOf(Date);
    expect(post.updatedAt).toBeInstanceOf(Date);
  });

  it("should reject title exceeding 150 characters", async () => {
    const user = await User.create({
      name: "Deidara",
      email: "deidara@akatsuki.org",
      password: "password123"
    });

    await expect(
      Post.create({
        title: "x".repeat(151),
        content: "Art is an explosion!",
        category: "Explosives",
        createdBy: user._id
      })
    ).rejects.toThrow();
  });

  it("should reject description exceeding 300 characters", async () => {
    const user = await User.create({
      name: "Deidara",
      email: "deidara2@akatsuki.org",
      password: "password123"
    });

    await expect(
      Post.create({
        title: "Valid Title",
        description: "d".repeat(301),
        content: "Art is an explosion!",
        category: "Explosives",
        createdBy: user._id
      })
    ).rejects.toThrow();
  });

  it("should reject invalid status enum", async () => {
    const user = await User.create({
      name: "Pain",
      email: "pain@akatsuki.org",
      password: "password123"
    });

    await expect(
      Post.create({
        title: "Peace Through Pain",
        content: "The world shall know pain.",
        category: "Philosophy",
        createdBy: user._id,
        status: "published" as any
      })
    ).rejects.toThrow();
  });

  it("should have compound indexes defined", async () => {
    await Post.init(); // Wait for indexes to build
    const indexes = await Post.collection.getIndexes();
    expect(indexes["status_1_createdAt_-1"]).toBeDefined();
    expect(indexes["createdBy_1_createdAt_-1"]).toBeDefined();
  });
});
