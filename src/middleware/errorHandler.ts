import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import mongoose from "mongoose";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // If it's our own ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {})
    });
    return;
  }

  // Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e: any) => e.message);
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors
    });
    return;
  }

  // Mongoose CastError (e.g. invalid ObjectId format)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`
    });
    return;
  }

  // MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    res.status(409).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    });
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      message: "Invalid token"
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Token has expired"
    });
    return;
  }

  // Unhandled / server errors
  const isDev = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
  if (isDev) {
    console.error("Unhandled Error:", err);
  }

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
};
