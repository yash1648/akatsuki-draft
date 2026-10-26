import { Router } from "express";
import {
  authController,
  registerSchema,
  loginSchema
} from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Apply auth rate limiter to all auth routes
router.use(authRateLimiter);

router.post(
  "/register",
  validate({ body: registerSchema }),
  authController.register.bind(authController)
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login.bind(authController)
);

router.get("/me", authenticate, authController.getMe.bind(authController));

export const authRoutes = router;
