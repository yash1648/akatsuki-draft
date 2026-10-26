import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "user" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "Please provide a valid email address"]
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"]
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "Role must be either 'user' or 'admin'"
      },
      default: "user",
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Hash password before saving if modified
UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
