import TelegramBot from "node-telegram-bot-api";
import { registerStartHandler } from "./handlers/start";
import { registerCalculatorHandler } from "./handlers/calculator";
import { registerCustomsHandler } from "./handlers/customs";
import { registerAuctionSheetHandler } from "./handlers/auctionSheet";
import { registerEncarHandler } from "./handlers/encar";
import { registerNoscutHandler } from "./handlers/noscut";
import { registerCatalogHandler } from "./handlers/catalog";
import { registerContactHandler } from "./handlers/contact";
import { registerRequestHandler } from "./handlers/request";
import { registerAdminHandler } from "./handlers/admin";
import { loadCache } from "./fileIdCache";

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

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '8443', 10);

const botOptions: TelegramBot.ConstructorOptions = {
  webHook: {
    port: WEBHOOK_PORT,
  },
};
const customApiUrl = process.env.TELEGRAM_API_BASE_URL;
if (customApiUrl) {
  botOptions.baseApiUrl = customApiUrl;
}

const bot = new TelegramBot(BOT_TOKEN, botOptions);

// Load file_id cache before registering handlers
const cacheEntries = loadCache();
console.log(`[bot] file_id cache loaded: ${cacheEntries} entries`);

bot.on('message', (msg) => {
  console.log(`[bot] message: ${msg.text?.slice(0, 30) || 'no text'} from ${msg.chat.id}`);
});
bot.on('callback_query', (query) => {
  console.log(`[bot] callback: ${query.data} from ${query.message?.chat.id}`);
});

registerStartHandler(bot);
registerCalculatorHandler(bot);
registerCustomsHandler(bot);
registerAuctionSheetHandler(bot);
registerEncarHandler(bot);
registerNoscutHandler(bot);
registerCatalogHandler(bot, GROUP_CHAT_ID);
registerContactHandler(bot);
registerRequestHandler(bot, GROUP_CHAT_ID);
registerAdminHandler(bot);

bot.on('webhook_error', (error: any) => {
  console.error(`Webhook error: ${error?.message || error}`);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection:', reason?.message || reason);
});

console.log(`JCK AUTO Bot started (webhook mode, port ${WEBHOOK_PORT})`);
if (customApiUrl) {
  console.log(`Outgoing API via: ${customApiUrl}`);
}
