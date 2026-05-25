import app from "../src/app";
import { connectToDatabase } from "../src/config/db";

// Database connection করবে একবার
let dbConnected = false;

export default async function handler(req: any, res: any) {
  // First request এ database connect করো
  if (!dbConnected) {
    try {
      await connectToDatabase();
      dbConnected = true;
    } catch (error) {
      console.error("Database connection failed:", error);
      return res.status(500).json({ error: "Database connection failed" });
    }
  }

  // Express app এর মাধ্যমে handle করো
  return app(req, res);
}