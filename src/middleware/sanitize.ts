import { Request, Response, NextFunction } from "express";

function cleanObject(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    // Strip keys starting with $ or containing . (NoSQL operator injection)
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }
    cleaned[key] = cleanObject(obj[key]);
  }
  return cleaned;
}

export const sanitizeNoSql = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = cleanObject(req.body);
  }
  if (req.query) {
    req.query = cleanObject(req.query);
  }
  if (req.params) {
    req.params = cleanObject(req.params);
  }
  next();
};
