import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { sanitizeNoSql } from "./middleware/sanitize";
import { errorHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/auth.routes";
import { postRoutes } from "./routes/post.routes";
import { adminRoutes } from "./routes/admin.routes";
import { aiRoutes } from "./routes/ai.routes";

export const app: Application = express();

// Security middlewares
app.use(helmet());
app.use(cors());

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NoSQL injection prevention
app.use(sanitizeNoSql);

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.use("/auth", authRoutes);
app.use("/posts", postRoutes);
app.use("/admin/posts", adminRoutes);
app.use("/ai", aiRoutes);

// Centralized Error Handler
app.use(errorHandler);
