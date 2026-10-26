import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { UserRole } from "../models/User";

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`Access denied: Requires role ${allowedRoles.join(" or ")}`)
      );
    }

    next();
  };
};
