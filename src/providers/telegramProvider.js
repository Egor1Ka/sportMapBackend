import { Bot } from "grammy";
import { handleBotStart } from "../services/telegramLinkService.js";

const { TELEGRAM_BOT_TOKEN } = process.env;

let bot = null;

const getBot = () => {
  if (!TELEGRAM_BOT_TOKEN) return null;
  if (!bot) {
    bot = new Bot(TELEGRAM_BOT_TOKEN);
  }
  return bot;
};

const sendMessage = async (chatId, text) => {
  const instance = getBot();
  if (!instance) return null;
  const result = await instance.api.sendMessage(chatId, text, {
    parse_mode: "HTML",
  });
  return String(result.message_id);
};

const initBot = () => {
  const instance = getBot();
  if (!instance) {
    console.log("TELEGRAM_BOT_TOKEN not set, skipping bot init");
    return;
  }

  instance.command("start", async (ctx) => {
    const token = ctx.match;
    if (!token) {
      await ctx.reply("Надішліть посилання з особистого кабінету для підключення сповіщень.");
      return;
    }
    const chatId = String(ctx.chat.id);
    const result = await handleBotStart(chatId, token);
    const message = result.success
      ? "Telegram підключено! Тепер ви отримуватимете сповіщення про нові записи."
      : "Посилання недійсне або застаріло. Спробуйте ще раз через особистий кабінет.";
    await ctx.reply(message);
  });

  instance.start();
  console.log("Telegram bot started (polling)");
};

export { sendMessage, initBot, getBot };
