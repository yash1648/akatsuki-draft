import jwt from "jsonwebtoken";
import { User, IUser, UserRole } from "../models/User";
import { ApiError } from "../utils/apiError";

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export class AuthService {
  async register(data: RegisterDTO): Promise<IUser> {
    const existingUser = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (existingUser) {
      throw ApiError.conflict("Email already exists");
    }

    // FR-AUTH-2: Strictly force role: "user" for public registration
    const user = new User({
      name: data.name,
      email: data.email,
      password: data.password,
      role: "user"
    });

    await user.save();
    return user;
  }

  async login(data: LoginDTO): Promise<LoginResult> {
    const user = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (!user) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    const secret = process.env.JWT_SECRET || "default_dev_secret_key_32_characters_long";
    const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as jwt.SignOptions["expiresIn"];

    const payload = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, secret, {
      expiresIn,
      algorithm: "HS256"
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }

  async getCurrentUser(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }
    return user;
  }
}

export const authService = new AuthService();
