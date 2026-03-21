import TelegramBot from "node-telegram-bot-api";
import { registerStartHandler } from "./handlers/start";
import { registerCalculatorHandler } from "./handlers/calculator";
import { registerCatalogHandler } from "./handlers/catalog";
import { registerContactHandler } from "./handlers/contact";
import { registerRequestHandler } from "./handlers/request";
import { registerAdminHandler } from "./handlers/admin";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;

if (!BOT_TOKEN) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

if (!GROUP_CHAT_ID) {
  console.error("ERROR: TELEGRAM_GROUP_CHAT_ID is not set");
  process.exit(1);
}

const botOptions: TelegramBot.ConstructorOptions = { polling: true };
const customApiUrl = process.env.TELEGRAM_API_BASE_URL;
if (customApiUrl) {
  botOptions.baseApiUrl = customApiUrl;
}

const bot = new TelegramBot(BOT_TOKEN, botOptions);

registerStartHandler(bot);
registerCalculatorHandler(bot);
registerCatalogHandler(bot, GROUP_CHAT_ID);
registerContactHandler(bot);
registerRequestHandler(bot, GROUP_CHAT_ID);
registerAdminHandler(bot);

if (customApiUrl) {
  console.log(`Using custom Telegram API: ${customApiUrl}`);
}
console.log("JCK AUTO Bot started");
