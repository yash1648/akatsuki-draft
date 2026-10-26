import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { connectDatabase } from "./config/database";

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`[Akatsuki Draft] Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
    console.log(`[Akatsuki Draft] Health endpoint available at http://localhost:${PORT}/health`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[Akatsuki Draft] Received ${signal}. Gracefully shutting down...`);
    server.close(() => {
      console.log("[Akatsuki Draft] HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("[Akatsuki Draft] Failed to bootstrap server:", err);
  process.exit(1);
});
