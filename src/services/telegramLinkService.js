import crypto from "crypto";
import User from "../modules/user/model/User.js";

const { TELEGRAM_BOT_USERNAME } = process.env;

const TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * In-memory хранилище одноразовых токенов привязки.
 * Формат: token → { userId, expiresAt }
 */
const pendingTokens = new Map();

const generateToken = () => crypto.randomBytes(24).toString("hex");

const isTokenExpired = (entry) => Date.now() > entry.expiresAt;

const cleanExpiredTokens = () => {
  const isExpired = ([, entry]) => isTokenExpired(entry);
  const expiredKeys = [...pendingTokens.entries()]
    .filter(isExpired)
    .map(([key]) => key);
  expiredKeys.forEach((key) => pendingTokens.delete(key));
};

const generateTelegramLink = (userId) => {
  cleanExpiredTokens();

  const token = generateToken();
  pendingTokens.set(token, {
    userId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  const botUsername = TELEGRAM_BOT_USERNAME || "your_bot";
  const url = `https://t.me/${botUsername}?start=${token}`;
  return { url, token };
};

const handleBotStart = async (chatId, token) => {
  const entry = pendingTokens.get(token);
  if (!entry || isTokenExpired(entry)) {
    pendingTokens.delete(token);
    return { success: false };
  }

  pendingTokens.delete(token);

  await User.findByIdAndUpdate(entry.userId, { telegramChatId: chatId });
  return { success: true, userId: entry.userId };
};

const disconnectTelegram = async (userId) => {
  await User.findByIdAndUpdate(userId, { telegramChatId: null });
};

export { generateTelegramLink, handleBotStart, disconnectTelegram };
