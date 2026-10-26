import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { User } from "../src/models/User";

describe("Authentication Module (/auth)", () => {
  describe("POST /auth/register", () => {
    it("should successfully register a new user with role 'user'", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Naruto Uzumaki",
          email: "naruto@konoha.org",
          password: "password123"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe("Naruto Uzumaki");
      expect(res.body.user.email).toBe("naruto@konoha.org");
      expect(res.body.user.role).toBe("user");
      expect(res.body.user.password).toBeUndefined();

      // Check DB directly
      const savedUser = await User.findOne({ email: "naruto@konoha.org" });
      expect(savedUser).toBeDefined();
      expect(savedUser?.role).toBe("user");
      expect(savedUser?.password).not.toBe("password123");
    });

    it("should strictly ignore role in body and force role to 'user' (FR-AUTH-2)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Madara Uchiha",
          email: "madara@akatsuki.org",
          password: "password123",
          role: "admin" // Attempting privilege escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("user");

      const saved = await User.findOne({ email: "madara@akatsuki.org" });
      expect(saved?.role).toBe("user");
    });

    it("should reject registration with 409 if email already exists", async () => {
      await request(app)
        .post("/auth/register")
        .send({
          name: "Sasuke Uchiha",
          email: "sasuke@konoha.org",
          password: "password123"
        });

      const duplicateRes = await request(app)
        .post("/auth/register")
        .send({
          name: "Sasuke Clone",
          email: "sasuke@konoha.org",
          password: "password456"
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
      expect(duplicateRes.body.message).toMatch(/already exists/i);
    });

    it("should reject invalid email with 400", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Sakura Haruno",
          email: "not-an-email",
          password: "password123"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject password shorter than 8 characters with 400", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          name: "Sakura Haruno",
          email: "sakura@konoha.org",
          password: "short"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/login", () => {
    it("should login successfully and return token with user details", async () => {
      await request(app)
        .post("/auth/register")
        .send({
          name: "Kakashi Hatake",
          email: "kakashi@konoha.org",
          password: "password123"
        });

      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "kakashi@konoha.org",
          password: "password123"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user).toEqual({
        id: expect.any(String),
        name: "Kakashi Hatake",
        email: "kakashi@konoha.org",
        role: "user"
      });
    });

    it("should reject incorrect password with 401", async () => {
      await request(app)
        .post("/auth/register")
        .send({
          name: "Kakashi Hatake",
          email: "kakashi2@konoha.org",
          password: "password123"
        });

      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "kakashi2@konoha.org",
          password: "wrongpassword"
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it("should reject non-existent user with 401", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "ghost@konoha.org",
          password: "password123"
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });
  });

  describe("GET /auth/me", () => {
    it("should return the profile of the authenticated user", async () => {
      const reg = await request(app)
        .post("/auth/register")
        .send({
          name: "Shikamaru Nara",
          email: "shikamaru@konoha.org",
          password: "password123"
        });

      const login = await request(app)
        .post("/auth/login")
        .send({
          email: "shikamaru@konoha.org",
          password: "password123"
        });

      const token = login.body.token;

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.name).toBe("Shikamaru Nara");
      expect(res.body.user.email).toBe("shikamaru@konoha.org");
      expect(res.body.user.role).toBe("user");
      expect(res.body.user.password).toBeUndefined();
    });

    it("should return 401 if token is missing", async () => {
      const res = await request(app).get("/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 if token is malformed/invalid", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-jwt-token-string");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
