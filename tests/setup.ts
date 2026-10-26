import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach } from "vitest";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test_super_secret_jwt_key_at_least_32_characters_for_vitest";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.AI_TIMEOUT_MS = "5000";

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

beforeEach(async () => {
  if (mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
