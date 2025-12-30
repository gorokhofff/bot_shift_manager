import asyncio
import os
import sys
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    filters,
)
from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

# МЫ ИЗМЕНИЛИ ИМПОРТЫ ЗДЕСЬ: Добавили префикс 'bot.'
from bot.handlers import (
    start, register_name, start_shift_handler, create_report_handler,
    end_shift_handler, receive_report, my_stats_handler, # <--- ДОБАВИТЬ ЭТОТ ИМПОРТ
    active_check_pending, notify_user_deactivated
)
from bot.database import init_db, get_user, get_all_users
from bot.config import BOT_TOKEN

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
        # Копируем словарь для итерации, чтобы избежать ошибок при удалении
        pending_items = list(active_check_pending.items())
        for telegram_id, chat_id in pending_items:
            user = await get_user(telegram_id)
            # В базе данных статус обычно в 4-й колонке (индекс 3)
            if user and user[3] == "active":
                try:
                    await bot.send_message(
                        chat_id=chat_id,
                        text="✅ Hesabınız onaylandı. Başlamak için '/start' tuşuna basınız.",
                        reply_markup=start_keyboard
                    )
                    to_remove.append(telegram_id)
                except Exception as e:
                    print(f"[ERROR] Failed to notify user {telegram_id}: {e}")
        
        for tid in to_remove:
            if tid in active_check_pending:
                del active_check_pending[tid]
        await asyncio.sleep(5)

# Фоновая проверка на деактивацию
async def notify_if_inactive(bot):
    # Этот процесс можно запускать периодически или по событию
    users = await get_all_users()
    for user_row in users:
        # Предполагаем структуру: (id, name, telegram_id, status, role)
        telegram_id = user_row[2]
        status = user_row[3]
        if status == "inactive":
            try:
                await notify_user_deactivated(bot, telegram_id)
            except:
                pass

# Уведомление всех активных пользователей при старте бота
async def notify_all_active_users(bot):
    try:
        users = await get_all_users()
        print(f"[INFO] Notifying users after restart...")
        for user_row in users:
            # ИСПРАВЛЕНИЕ 1: telegram_id находится под индексом 1 (ранее было 2)
            # Порядок полей в БД: (id, telegram_id, name, status, role)
            telegram_id = user_row[1] 
            status = user_row[3]

            # ИСПРАВЛЕНИЕ 2: Временный фильтр для тестирования
            # Срабатывает только если ID пользователя 1285647
            # if str(telegram_id) != "1285647":
            #     continue
            
            if status == "active":
                try:
                    await bot.send_message(
                        chat_id=telegram_id,
                        text="🔄 Bot yeniden başlatıldı. Başlamak için '/start' tuşuna basınız.",
                        reply_markup=start_keyboard
                    )
                    print(f"[INFO] Notification sent to {telegram_id}")
                except Exception as e:
                    print(f"[ERROR] Restart mesajı gönderilemedi {telegram_id}: {e}")
    except Exception as e:
        print(f"[CRITICAL] Error in notify_all_active_users: {e}")

# Основной запуск
async def main():
    # Инициализация БД
    await init_db()

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            "register_name": [MessageHandler(filters.TEXT & ~filters.COMMAND, register_name)],
            "main_menu": [
                MessageHandler(filters.Regex("^Start$"), start),
                # Кнопки смен
                MessageHandler(filters.Regex("^(Yenibosna'da Şift Başlat|Göktürk'te Şift Başlat)$"), start_shift_handler),
                # Кнопка статистики
                MessageHandler(filters.Regex("^İstatistiklerim$"), my_stats_handler), 
            ],
            "shift_menu": [
                MessageHandler(filters.Regex("^Rapor Oluştur$"), create_report_handler),
                MessageHandler(filters.Regex("^Şift Bitir$"), end_shift_handler),
                # Можно разрешить смотреть статистику и во время смены, если хотите:
                MessageHandler(filters.Regex("^İstatistiklerim$"), my_stats_handler), 
            ],
            "waiting_report": [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_report)],
        },
        fallbacks=[CommandHandler("start", start)],
    )

    app.add_handler(conv_handler)
    app.add_handler(MessageHandler(filters.UpdateType.EDITED_MESSAGE & filters.TEXT, edited_message_handler))

    # Запуск фоновых задач
    asyncio.create_task(notify_if_active(app.bot))
    
    await app.initialize()
    await app.start()
    
    # Уведомляем пользователей ОПСЛЕ запуска
    await notify_all_active_users(app.bot)
    
    await app.updater.start_polling()

    print("[INFO] Bot is running...")
    await stop_event.wait()
    
    await app.stop()
    await app.shutdown()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        print("[INFO] Bot stopped.")