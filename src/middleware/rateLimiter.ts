import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

// Rate limiting for auth endpoints (brute-force defense)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 100, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again after 15 minutes"
  }
});

// Rate limiting for AI endpoints (10 requests per user/IP per hour)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 10, // max 10 per hour as specified in NFR-SEC-3
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // If authenticated, rate limit by user ID; otherwise by IP
    return req.user?.id || req.ip || "unknown";
  },
  message: {
    success: false,
    message: "AI improvement rate limit exceeded. Maximum 10 requests per hour allowed."
  }
});
