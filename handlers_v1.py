from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ContextTypes
from datetime import datetime
from database import *
from config import ADMIN_IDS
from report_parser import parse_report

main_menu = ReplyKeyboardMarkup(
    [["Yenibosna'da Şift Başlat", "Göktürk'te Şift Başlat"], ["Çıkış"]],
    resize_keyboard=True
)
shift_menu = ReplyKeyboardMarkup(
    [["Rapor Oluştur", "Şift Bitir"]],
    resize_keyboard=True
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)

    if not user:
        await update.message.reply_text("Merhaba! Lütfen isminizi giriniz:")
        return "register_name"

    if user[3] != "active":
        await update.message.reply_text("Hesabınız moderasyonda. Lütfen yöneticinin onayını bekleyin.")
        return None

    active_shift = await get_active_shift(user[0])
    if active_shift:
        await update.message.reply_text("Aktif şiftiniz var.", reply_markup=shift_menu)
        return "shift_menu"
    else:
        await update.message.reply_text("Menü:", reply_markup=main_menu)
        return "main_menu"

async def register_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    name = update.message.text.strip()
    telegram_id = update.effective_user.id
    status = "active" if telegram_id in ADMIN_IDS else "pending"
    await add_user(telegram_id, name, status)

    if status == "active":
        await update.message.reply_text("Kayıt başarılı. Menüye yönlendiriliyorsunuz.", reply_markup=main_menu)
        return "main_menu"
    else:
        await update.message.reply_text("Kaydınız alındı. Lütfen yöneticinin onayını bekleyiniz.")
        return None

async def start_shift_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    active_shift = await get_active_shift(user[0])
    if active_shift:
        await update.message.reply_text("Zaten aktif bir şiftiniz var!", reply_markup=shift_menu)
        return "shift_menu"

    location = "Yenibosna" if "Yenibosna" in update.message.text else "Göktürk"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await start_shift(user[0], location, now)

    await update.message.reply_text(f"{location} şift başladı.", reply_markup=shift_menu)

    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(admin_id, f"{user[2]} şift başladı: {now} ({location})")
        except Exception as e:
            print(f"[ERROR] Failed to notify admin {admin_id}: {e}")

    return "shift_menu"

async def create_report_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today = datetime.now().strftime("%d-%m-%Y")
    await update.message.reply_text(
        f"*tarih* - `{today}`\n\n"
        "*satış* - \\_\\_\\_ \n"
        "(• dubai chocolate - \\_\\_\\_\n"
        "• Bonche - \\_\\_\\_)\n\n"
        "*Ücretsiz* - \\_\\_\\_ \n"
        "(• G - \\_\\_\\_\n"
        "• K - \\_\\_\\_\n"
        "• M - \\_\\_\\_)\n\n"
        "*Değiştirme* - \\_\\_\\_\n"
        "———————————————\n"
        "• koz - \\_\\_\\_\n"
        "• Elek - \\_\\_\\_\n"
        "• nargile - \\_\\_\\_\n"
        "• lule - \\_\\_\\_\n"
        "• kalaud - \\_\\_\\_\n"
        "• baca - \\_\\_\\_\n"
        "• Maşa - \\_\\_\\_\n"
        "• Sipsi - \\_\\_\\_",
        parse_mode="Markdown"
    )
    return "waiting_report"

async def receive_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    shift = await get_active_shift(user[0])

    if not shift:
        await update.message.reply_text("Şu anda aktif şift yok!")
        return "main_menu"

    today_str = datetime.now().date().isoformat()
    existing_report = await get_today_report(user[0], today_str)
    if existing_report:
        await update.message.reply_text("Bugün için zaten bir rapor kaydedildi!")
        return "shift_menu"

    parsed_data = parse_report(update.message.text)
    now = datetime.now().isoformat()
    await add_report(shift[0], update.message.text, now)

    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(admin_id, f"{user[2]} yeni rapor gönderdi:\n{update.message.text}")
        except Exception as e:
            print(f"[ERROR] Failed to notify admin {admin_id}: {e}")

    await update.message.reply_text("Rapor kaydedildi.", reply_markup=shift_menu)
    return "shift_menu"

async def end_shift_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    active_shift = await get_active_shift(user[0])
    if not active_shift:
        await update.message.reply_text("Aktif bir şiftiniz yok!", reply_markup=main_menu)
        return "main_menu"

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    await end_shift(user[0], now)

    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(admin_id, f"{user[2]} şift bitirdi: {now}")
        except Exception as e:
            print(f"[ERROR] Failed to notify admin {admin_id}: {e}")

    await update.message.reply_text("Şift bitirildi.", reply_markup=main_menu)
    return "main_menu"
