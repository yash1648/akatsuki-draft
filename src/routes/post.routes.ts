import { Router } from "express";
import {
  postController,
  createPostSchema,
  updatePostSchema,
  postQuerySchema
} from "../controllers/post.controller";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Public: GET /posts (list approved posts)
router.get(
  "/",
  validate({ query: postQuerySchema }),
  postController.getPosts.bind(postController)
);

// Authenticated: POST /posts (create post)
router.post(
  "/",
  authenticate,
  validate({ body: createPostSchema }),
  postController.createPost.bind(postController)
);

// FR-POST-3: Strictly declare /my-posts BEFORE /:id
router.get(
  "/my-posts",
  authenticate,
  postController.getMyPosts.bind(postController)
);

// Public / Semi-public: GET /posts/:id (approved to public; own drafts to author/admin)
router.get(
  "/:id",
  optionalAuthenticate,
  postController.getPostById.bind(postController)
);

// Authenticated: PATCH /posts/:id (owner only)
router.patch(
  "/:id",
  authenticate,
  validate({ body: updatePostSchema }),
  postController.updatePost.bind(postController)
);

// Authenticated: DELETE /posts/:id (owner only)
router.delete(
  "/:id",
  authenticate,
  postController.deletePost.bind(postController)
);

export const postRoutes = router;
