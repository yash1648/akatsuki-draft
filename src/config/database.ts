import mongoose from "mongoose";

let isConnecting = false;

export const connectDatabase = async (uri?: string): Promise<typeof mongoose> => {
  // If already connected, reuse the active connection (critical for serverless / Vercel)
  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  if (isConnecting) {
    // Wait until connection state is established
    while (mongoose.connection.readyState === 2) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (mongoose.connection.readyState === 1) {
      return mongoose;
    }
  }

  const mongoUri =
    uri ||
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/akatsuki_draft";

  isConnecting = true;
  try {
    const conn = await mongoose.connect(mongoUri, {
      bufferCommands: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[MongoDB] Connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error("[MongoDB] Connection failure:", error);
    throw error;
  } finally {
    isConnecting = false;
  }
};
