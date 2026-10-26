import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { User } from "../src/models/User";

describe("Security & Non-Functional Requirements Verification", () => {
  it("should include security headers (Helmet)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    // Helmet headers
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("should sanitize NoSQL injection operators ($gt, $ne, $where) in request body (NFR-SEC-2)", async () => {
    // Attempt NoSQL injection login: { email: { "$gt": "" }, password: { "$gt": "" } }
    const maliciousBody = {
      email: { $gt: "" },
      password: { $gt: "" }
    };

    const res = await request(app).post("/auth/login").send(maliciousBody);
    // Because $gt is stripped, email and password become empty/invalid objects, failing validation with 400
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should sanitize NoSQL operators in query parameters and reject invalid query objects", async () => {
    const res = await request(app).get("/posts?category[$gt]=");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should enforce JWT HS256 algorithm and reject 'none' algorithm token", async () => {
    // Attack: forged JWT with alg "none"
    const forgedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        id: "60c72b2f9b1d8b2bad6e89a1",
        email: "hacker@akatsuki.org",
        role: "admin",
        name: "Hacker"
      })
    ).toString("base64url");
    const noneToken = `${forgedHeader}.${forgedPayload}.`;

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${noneToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid token/i);
  });
});
