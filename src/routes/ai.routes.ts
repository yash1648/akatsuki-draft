import { Router } from "express";
import { aiController } from "../controllers/ai.controller";
import { authenticate } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// POST /ai/improve/:postId (Authenticated, Owner only, Rate limited)
router.post(
  "/improve/:postId",
  authenticate,
  aiRateLimiter,
  aiController.improvePost.bind(aiController)
);

export const aiRoutes = router;
