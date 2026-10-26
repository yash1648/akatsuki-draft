export class ApiError extends Error {
  public statusCode: number;
  public errors?: any;

  constructor(statusCode: number, message: string, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: any): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message: string = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message: string = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message: string = "Resource not found"): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string = "Conflict: Resource already exists"): ApiError {
    return new ApiError(409, message);
  }

  static badGateway(message: string = "Bad Gateway: Upstream service failure"): ApiError {
    return new ApiError(502, message);
  }

  static gatewayTimeout(message: string = "Gateway Timeout: Upstream service timed out"): ApiError {
    return new ApiError(504, message);
  }

  static internal(message: string = "Internal Server Error"): ApiError {
    return new ApiError(500, message);
  }
}
