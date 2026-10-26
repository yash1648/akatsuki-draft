import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type PostStatus = "draft" | "pending" | "approved" | "rejected";

export interface IPost extends Document {
  title: string;
  description: string;
  content: string;
  image: string | null;
  category: string;
  createdBy: Types.ObjectId;
  status: PostStatus;
  parentPostId: Types.ObjectId | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const URL_REGEX = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg)|https?:\/\/.*)$/i;

const PostSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description cannot exceed 300 characters"],
      default: ""
    },
    content: {
      type: String,
      required: [true, "Content is required"]
    },
    image: {
      type: String,
      default: null,
      validate: {
        validator: function (v: string | null) {
          if (v === null || v === "" || v === undefined) return true;
          return URL_REGEX.test(v);
        },
        message: "Image must be a valid URL string"
      }
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post author (createdBy) is required"],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "pending", "approved", "rejected"],
        message: "Status must be 'draft', 'pending', 'approved', or 'rejected'"
      },
      default: "draft",
      required: true
    },
    parentPostId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// NFR-PERF-1: Compound indexes for query optimization
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ createdBy: 1, createdAt: -1 });

export const Post: Model<IPost> = mongoose.model<IPost>("Post", PostSchema);
