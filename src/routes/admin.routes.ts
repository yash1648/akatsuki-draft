import { Router } from "express";
import {
  adminController,
  rejectPostSchema,
  pendingQuerySchema
} from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { validate } from "../middleware/validate";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireRole("admin"));

// GET /admin/posts/pending
router.get(
  "/pending",
  validate({ query: pendingQuerySchema }),
  adminController.getPendingPosts.bind(adminController)
);

// PATCH /admin/posts/approve/:id
router.patch(
  "/approve/:id",
  adminController.approvePost.bind(adminController)
);

// PATCH /admin/posts/reject/:id
router.patch(
  "/reject/:id",
  validate({ body: rejectPostSchema }),
  adminController.rejectPost.bind(adminController)
);

export const adminRoutes = router;
