import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError";
import { UserRole } from "../models/User";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Authentication token required"));
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "default_dev_secret_key_32_characters_long";

  try {
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return next(ApiError.unauthorized("Token has expired"));
    }
    return next(ApiError.unauthorized("Invalid token"));
  }
};

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "default_dev_secret_key_32_characters_long";

  try {
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };
  } catch {
    // If token is invalid or expired in optional auth, proceed as unauthenticated guest
  }
  next();
};
