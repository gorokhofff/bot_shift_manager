import asyncio
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ConversationHandler, filters
from handlers import *
from database import init_db
from config import BOT_TOKEN

# Создаем событие завершения
stop_event = asyncio.Event()

async def main():
    await init_db()

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            "register_name": [MessageHandler(filters.TEXT & ~filters.COMMAND, register_name)],
            "main_menu": [
                MessageHandler(filters.Regex("^(Yenibosna'da Şift Başlat|Göktürk'te Şift Başlat)$"), start_shift_handler),
                MessageHandler(filters.Regex("^Çıkış$"), start)
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

    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    await stop_event.wait()
    await app.stop()
    await app.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
