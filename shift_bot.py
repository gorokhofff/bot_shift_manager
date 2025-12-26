import asyncio
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    filters,
)
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import ContextTypes
from handlers import (
    start, register_name, start_shift_handler, create_report_handler,
    end_shift_handler, receive_report, active_check_pending
)
from database import init_db, get_user, get_all_users
from config import BOT_TOKEN

stop_event = asyncio.Event()

start_keyboard = ReplyKeyboardMarkup([ ["/start"] ], resize_keyboard=True)

# Обработка редактированных сообщений
async def edited_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.edited_message:
        edited_message = update.edited_message

        class FakeUpdate:
            def __init__(self, message):
                self.message = message
                self.effective_user = message.from_user

        await receive_report(FakeUpdate(edited_message), context)

# Фоновая проверка на активацию
async def notify_if_active(bot):
    while True:
        to_remove = []
        for telegram_id, chat_id in active_check_pending.items():
            user = await get_user(telegram_id)
            if user and user[3] == "active":
                try:
                    await bot.send_message(
                        chat_id=chat_id,
                        text="✅ Hesabınız onaylandı. Başlamak için 'Start' tuşuna basınız.",
                        reply_markup=start_keyboard
                    )
                    to_remove.append(telegram_id)
                except Exception as e:
                    print(f"[ERROR] Failed to notify user {telegram_id}: {e}")
        for tid in to_remove:
            del active_check_pending[tid]
        await asyncio.sleep(5)

# Фоновая проверка на деактивацию
async def notify_if_inactive(bot):
    users = await get_all_users()
    for telegram_id, status in users:
        if status == "inactive":
            await notify_user_deactivated(bot, telegram_id)

# Уведомление всех активных пользователей при старте бота
async def notify_all_active_users(bot):
    users = await get_all_users()
    print(f"[INFO] Notifying {len(users)} users after restart...")
    for telegram_id, status in users:
        if status == "active":
            try:
                await bot.send_message(
                    chat_id=telegram_id,
                    text="🔄 Bot yeniden başlatıldı. Başlamak için 'Start' tuşuna basınız.",
                    reply_markup=start_keyboard
                )
            except Exception as e:
                print(f"[ERROR] Restart mesajı gönderilemedi {telegram_id}: {e}")

# Основной запуск
async def main():
    await init_db()

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            "register_name": [MessageHandler(filters.TEXT & ~filters.COMMAND, register_name)],
            "main_menu": [
                MessageHandler(filters.Regex("^Start$"), start),
                MessageHandler(filters.Regex("^(Yenibosna'da Şift Başlat|Göktürk'te Şift Başlat)$"), start_shift_handler),
            ],
            "shift_menu": [
                MessageHandler(filters.Regex("^Rapor Oluştur$"), create_report_handler),
                MessageHandler(filters.Regex("^Şift Bitir$"), end_shift_handler),
            ],
            "waiting_report": [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_report)],
        },
        fallbacks=[CommandHandler("start", start)],
    )

    app.add_handler(conv_handler)
    app.add_handler(MessageHandler(filters.UpdateType.EDITED_MESSAGE & filters.TEXT, edited_message_handler))

    asyncio.create_task(notify_if_active(app.bot))
    asyncio.create_task(notify_if_inactive(app.bot))

    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    await notify_all_active_users(app.bot)

    await stop_event.wait()
    await app.stop()
    await app.shutdown()

if __name__ == "__main__":
    asyncio.run(main())