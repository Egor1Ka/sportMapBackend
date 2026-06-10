import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./db.js";
import routes from "./routes/routes.js";
import { initBot } from "./providers/telegramProvider.js";

const { PORT, FRONTEND_URL } = process.env;

const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));

const apiPrefix = process.env.API_PREFIX ? `/${process.env.API_PREFIX}` : "";

app.use(`${apiPrefix}/billing/webhook`, express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

connectDB();

app.use(apiPrefix || "/", routes);

app.set("trust proxy", true);

initBot();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
