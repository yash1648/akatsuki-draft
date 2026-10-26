"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const app_1 = require("../src/app");
const database_1 = require("../src/config/database");
async function handler(req, res) {
    try {
        await (0, database_1.connectDatabase)();
        return (0, app_1.app)(req, res);
    }
    catch (error) {
        console.error("[Vercel Serverless] Database connection error:", error);
        return res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
}
