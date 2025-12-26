import asyncio
from telegram.ext import (
    ApplicationBuilder, CommandHandler, MessageHandler, 
    ConversationHandler, filters
)
from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

# ТЕПЕРЬ ЭТИ ИМПОРТЫ РАБОТАЮТ КОРРЕКТНО
from bot.handlers import (
    start, register_name, start_shift_handler, create_report_handler,
    end_shift_handler, receive_report, active_check_pending,
    notify_user_deactivated
)
from bot.database import init_db, get_user, get_all_users
from bot.config import BOT_TOKEN

# ... (остальной код main.py без изменений) ...

async def main():
    await init_db()
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    
    # ... (регистрация хендлеров) ...

    await app.initialize()
    await app.start()
    await app.updater.start_polling()
    print("[INFO] Bot is running with optimized structure...")
    await stop_event.wait()

if __name__ == "__main__":
    asyncio.run(main())