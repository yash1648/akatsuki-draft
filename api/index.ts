import { Request, Response } from "express";
import { app } from "../src/app";
import { connectDatabase } from "../src/config/database";

export default async function handler(req: Request, res: Response) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error: any) {
    console.error("[Vercel Serverless] Database connection error:", error);
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}
