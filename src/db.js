import mongoose from "mongoose";
import Invitee from "./models/Invitee.js";

const { DB_URL } = process.env;

export const connectDB = async () => {
  try {
    await mongoose.connect(DB_URL);
    console.log("Connected to DB");
  } catch (err) {
    console.error("Failed to connect to DB", err);
    process.exit(1);
  }
};
