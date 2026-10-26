import mongoose from "mongoose";

export const connectDatabase = async (uri?: string): Promise<typeof mongoose> => {
  const mongoUri =
    uri ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/akatsuki_draft";

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error("[MongoDB] Connection failure:", error);
    process.exit(1);
  }
};
