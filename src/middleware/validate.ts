import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../utils/apiError";

interface ValidationSchema {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export const validate = (schema: ValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(
          (err) => `${err.path.join(".") || "field"}: ${err.message}`
        );
        next(ApiError.badRequest("Validation failed", errorMessages));
      } else {
        next(error);
      }
    }
  };
};
