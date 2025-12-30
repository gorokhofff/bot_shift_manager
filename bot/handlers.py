import pytz
from datetime import datetime
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import ContextTypes, ConversationHandler

# ОБНОВЛЕННЫЕ ИМПОРТЫ
from bot.database import (
    get_user, activate_user, get_active_shift, add_user, 
    start_shift, get_today_report, update_report, add_report, 
    end_shift, get_all_users
)
from bot.config import ADMIN_IDS
from bot.report_parser import parse_report

istanbul_tz = pytz.timezone("Europe/Istanbul")

active_check_pending = {}

# Клавиатуры
# New (Fixed):
main_menu = ReplyKeyboardMarkup(
    [
        ["Yenibosna'da Şift Başlat", "Göktürk'te Şift Başlat"],
        ["İstatistiklerim"]  # Добавили кнопку статистики
    ],
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
    
    # Статус пользователя (индекс 3 в БД)
    status = user[3]
    
    if status == "inactive":
        await update.message.reply_text(
            "Hesabınız devre dışı bırakıldı. Lütfen yönetici ile iletiшime geçin.",
            reply_markup=ReplyKeyboardRemove()
        )
        return ConversationHandler.END
        
    if status == "pending":
        if update.effective_user.id in ADMIN_IDS:
            await activate_user(update.effective_user.id)
            await update.message.reply_text(
                "Hesabınız aktif hale getirildi.", 
                reply_markup=ReplyKeyboardMarkup([["Start"]], resize_keyboard=True)
            )
            return "main_menu"
        else:
            active_check_pending[update.effective_user.id] = update.message.chat_id
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

    # Уведомление админам
    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(
                chat_id=admin_id,
                text=(
                    f"🆕 Yeni kullanıcı kaydoldu:\n"
                    f"👤 *{name}*\n"
                    f"🆔 `{telegram_id}`\n"
                    f"⏳ Durum: *{status}*"
                ),
                parse_mode="Markdown"
            )
        except Exception as e:
            print(f"[ERROR] Admin notification failed: {e}")

    if status == "active":
        await update.message.reply_text("Kayıt başarılı. Menüye yönlendiriliyorsunuz.", reply_markup=main_menu)
        return "main_menu"
    else:
        active_check_pending[telegram_id] = update.message.chat_id
        await update.message.reply_text("Kaydınız alındı. Yöneticinin onayını bekleyiniz.")
        return None

async def start_shift_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    if user[3] == "inactive":
        await update.message.reply_text("🚫 Hesabınız devre dışı bırakıldı.", reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END

    active_shift = await get_active_shift(user[0])
    if active_shift:
        await update.message.reply_text("Zaten aktif bir şiftiniz var!", reply_markup=shift_menu)
        return "shift_menu"

    location = "Yenibosna" if "Yenibosna" in update.message.text else "Göktürk"
    now = datetime.now(istanbul_tz).strftime("%Y-%m-%d %H:%M:%S")
    await start_shift(user[0], location, now)

    await update.message.reply_text(f"{location} şift başladı.", reply_markup=shift_menu)

    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(admin_id, f"🚀 {user[2]} şift başladı: {now} ({location})")
        except Exception as e:
            print(f"[ERROR] Admin notify error: {e}")

    return "shift_menu"

async def create_report_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today = datetime.now(istanbul_tz).strftime("%d-%m-%Y")
    template = (
        f"*tarih* - `{today}`\n\n"
        "*satış* -  \n"
        "(• dubai chocolate - \n"
        "• Bonche - )\n\n"
        "*Ücretsiz* -  \n"
        "(• G - \n"
        "• K - \n"
        "• M - )\n\n"
        "*Değiştirme* - \n"
        "———————————————\n"
        "• koz - \n"
        "• Elek - \n"
        "• nargile - \n"
        "• lule - \n"
        "• kalaud - \n"
        "• baca - \n"
        "• Maşa - \n"
        "• Sipsi - "
    )
    await update.message.reply_text(template, parse_mode="Markdown")
    return "waiting_report"

async def receive_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    shift = await get_active_shift(user[0])
    
    if not shift:
        await update.message.reply_text("Şu anda aktif şift yok!")
        return "main_menu"

    now = datetime.now(istanbul_tz).isoformat()
    today_str = datetime.now(istanbul_tz).date().isoformat()
    existing_report = await get_today_report(user[0], today_str)

    if existing_report:
        await update_report(existing_report[0], update.message.text, now)
        await update.message.reply_text("Mevcut rapor güncellendi.", reply_markup=shift_menu)
    else:
        await add_report(shift[0], update.message.text, now)
        await update.message.reply_text("Rapor kaydedildi.", reply_markup=shift_menu)

    for admin_id in ADMIN_IDS:
        try:
            await context.bot.send_message(admin_id, f"📝 {user[2]} yeni rapor gönderdi:\n{update.message.text}")
        except: pass

    return "shift_menu"

async def end_shift_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    now = datetime.now(istanbul_tz)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    user_record = await get_user(telegram_id)
    if not user_record: return

    user_id, _, user_name, status, _ = user_record
    active_shift = await get_active_shift(user_id)
    
    if not active_shift:
        await update.message.reply_text("❗ Aktif bir vardiyanız bulunmamaktadır.")
        return

    # ИСПРАВЛЕНИЕ: Берем значения по индексам, так надежнее
    shift_id = active_shift[0]       # id
    start_time_str = active_shift[2] # start_time
    location = active_shift[4]       # location

    try:
        # Расчет длительности
        start_dt = istanbul_tz.localize(datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S"))
        duration = max(0.1, round((now - start_dt).total_seconds() / 3600, 1))
        
        await end_shift(user_id, now_str)

        # Уведомление админам
        admin_msg = (
            f"🏁 *Vardiya Tamamlandı*\n\n"
            f"👤 *Çalışan:* {user_name}\n"
            f"📍 *Lokasyon:* {location}\n"
            f"⏱️ *Süre:* {duration} saat"
        )
        for admin_id in ADMIN_IDS:
            try:
                await context.bot.send_message(admin_id, admin_msg, parse_mode="Markdown")
            except: pass

        await update.message.reply_text("✅ Vardiyanız başarıyla sonlandırıldı.", reply_markup=main_menu)
        return "main_menu"
    except Exception as e:
        print(f"Error ending shift: {e}")
        await update.message.reply_text("❌ Ошибка при завершении смены.")

# НОВАЯ ФУНКЦИЯ ДЛЯ ИСПРАВЛЕНИЯ ОШИБКИ ИМПОРТА
async def notify_user_deactivated(bot, telegram_id):
    """Отправляет уведомление пользователю, если его деактивировали"""
    try:
        await bot.send_message(
            chat_id=telegram_id,
            text="🚫 Hesabınız devre dışı bırakıldı. Lütfen yönetici ile iletişime geçin.",
            reply_markup=ReplyKeyboardRemove()
        )
    except Exception as e:
        print(f"[ERROR] Failed to notify deactivated user {telegram_id}: {e}")

# --- НОВЫЙ ХЕНДЛЕР: СТАТИСТИКА ---
async def my_stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показывает краткую статистику пользователя за текущий месяц"""
    user = await get_user(update.effective_user.id)
    if not user: return
    
    user_id = user[0]
    now = datetime.now(istanbul_tz)
    month_start = now.replace(day=1, hour=0, minute=0, second=0).strftime("%Y-%m-%d")
    
    # Считаем часы и смены за этот месяц (можно вынести в database.py)
    # Здесь пример прямого подсчета для скорости:
    import aiosqlite
    from bot.database import DB_NAME
    
    total_hours = 0
    shift_count = 0
    
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute('''
            SELECT duration_hours 
            FROM Shifts 
            WHERE user_id = ? 
            AND shift_date >= ? 
            AND end_time IS NOT NULL
        ''', (user_id, month_start)) as cursor:
            async for row in cursor:
                shift_count += 1
                total_hours += (row[0] or 0)

    msg = (
        f"📊 <b>İstatistiklerim ({now.strftime('%B')})</b>\n\n"
        f"✅ Tamamlanan Şift: <b>{shift_count}</b>\n"
        f"⏱ Toplam Saat: <b>{round(total_hours, 1)}</b>\n\n"
        f"<i>Detaylı bilgi için yöneticiye başvurunuz.</i>"
    )
    
    await update.message.reply_text(msg, parse_mode="HTML", reply_markup=main_menu)
    return "main_menu"