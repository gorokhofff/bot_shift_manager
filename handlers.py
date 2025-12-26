from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import ContextTypes, ConversationHandler
from datetime import datetime
import pytz
istanbul_tz = pytz.timezone("Europe/Istanbul")
from database import *
from config import ADMIN_IDS
from report_parser import parse_report

active_check_pending = {}

main_menu = ReplyKeyboardMarkup(
    [["Yenibosna'da Şift Başlat", "Göktürk'te Şift Başlat"]],
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
    if user[3] == "inactive":
        await update.message.reply_text("Hesabınız devre dışı bırakıldı. Lütfen yönetici ile iletişime geçin.",
                                        reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END
    if user[3] == "pending":
        if update.effective_user.id in ADMIN_IDS:
            await activate_user(update.effective_user.id)
            user = await get_user(update.effective_user.id)
            await update.message.reply_text("Hesabınız aktif hale getirildi.", reply_markup=ReplyKeyboardMarkup([["Start"]], resize_keyboard=True))
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

    if status == "active":
        await update.message.reply_text("Kayıt başarılı. Menüye yönlendiriliyorsunuz.", reply_markup=main_menu)
        return "main_menu"
    else:
        active_check_pending[telegram_id] = update.message.chat_id
        await update.message.reply_text("Kaydınız alındı. Yöneticinin onayını bekleyiniz. Onaylandığınızda bilgilendirileceksiniz.")
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
            await context.bot.send_message(admin_id, f"{user[2]} şift başladı: {now} ({location})")
        except Exception as e:
            print(f"[ERROR] Failed to notify admin {admin_id}: {e}")

    return "shift_menu"

async def create_report_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    if user[3] == "inactive":
        await update.message.reply_text("🚫 Hesabınız devre dışı bırakıldı.", reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END

    today = datetime.now(istanbul_tz).strftime("%d-%m-%Y")
    await update.message.reply_text(
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
        "• Sipsi - ",
        parse_mode="Markdown"
    )
    return "waiting_report"

async def receive_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_user(update.effective_user.id)
    if user[3] == "inactive":
        await update.message.reply_text("🚫 Hesabınız devre dışı bırakıldı.", reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END

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
            await context.bot.send_message(admin_id, f"{user[2]} yeni rapor gönderdi:\n{update.message.text}")
        except Exception as e:
            print(f"[ERROR] Failed to notify admin {admin_id}: {e}")

    return "shift_menu"

async def end_shift_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    telegram_id = user.id
    
    # 🔍 ДОБАВЛЯЕМ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ
    now = datetime.now(istanbul_tz)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    
    print(f"[DEBUG] end_shift_handler вызван")
    print(f"[DEBUG] telegram_id: {telegram_id}")
    print(f"[DEBUG] Istanbul time: {now}")
    print(f"[DEBUG] Formatted time string: {now_str}")
    print(f"[DEBUG] Server system time: {datetime.now()}")

    # Kullanıcıyı veritabanından al
    user_record = await get_user(telegram_id)
    if not user_record:
        await update.message.reply_text("⚠️ Kullanıcı kaydı bulunamadı.")
        print(f"[end_shift_handler] Kullanıcı yok: telegram_id={telegram_id}")
        return

    user_id = user_record[0]  # Users.id
    user_name = user_record[2]  # Users.name - ДОБАВЛЯЕМ получение имени
    print(f"[DEBUG] user_id: {user_id}")
    print(f"[DEBUG] user_name: {user_name}")

    # Aktif vardiyayı kontrol et
    active_shift = await get_active_shift(user_id)
    if not active_shift:
        await update.message.reply_text("❗ Aktif bir vardiyanız bulunmamaktadır.")
        print(f"[end_shift_handler] Aktif vardiya yok: user_id={user_id}")
        return

    # ДОБАВЛЯЕМ получение дополнительных данных о смене
    shift_id = active_shift[0]  # shift ID
    start_time_str = active_shift[2]  # 3. sütun: start_time
    location = active_shift[4]  # location
    
    print(f"[DEBUG] active_shift data: {active_shift}")
    print(f"[DEBUG] shift_id: {shift_id}")
    print(f"[DEBUG] start_time from DB: {start_time_str}")
    print(f"[DEBUG] location: {location}")

    if not start_time_str:
        await update.message.reply_text("⚠️ Vardiya başlangıç zamanı tespit edilemedi.")
        print(f"[end_shift_handler] start_time None: user_id={user_id}")
        return

    try:
        print(f"[DEBUG] Calling end_shift() with: user_id={user_id}, end_time={now_str}")
        
        # 🆕 НОВОЕ: Вычисляем продолжительность смены ДО завершения
        try:
            start_dt = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
            end_dt = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
            
            # Принудительно указываем timezone
            istanbul_tz_obj = pytz.timezone("Europe/Istanbul")
            start_dt = istanbul_tz_obj.localize(start_dt)
            end_dt = istanbul_tz_obj.localize(end_dt)
            
            # Вычисляем продолжительность
            duration_hours = max(0.1, round((end_dt - start_dt).total_seconds() / 3600, 1))
            
            print(f"[DEBUG] Calculated duration: {duration_hours} hours")
            
        except Exception as calc_error:
            print(f"[WARNING] Duration calculation failed: {calc_error}")
            duration_hours = 0
        
        # Завершаем смену
        await end_shift(user_id, now_str)
        
        # ✅ ИСПРАВЛЯЕМ ПОРЯДОК: print ПЕРЕД return
        print(f"[end_shift_handler] ✅ Vardiya sonlandırıldı: user_id={user_id}, now={now_str}")
        
        # 🆕 НОВОЕ: Отправляем уведомления администраторам
        try:
            # Форматируем время для красивого отображения
            start_time_formatted = start_dt.strftime("%H:%M") if 'start_dt' in locals() else "N/A"
            end_time_formatted = end_dt.strftime("%H:%M") if 'end_dt' in locals() else "N/A"
            date_formatted = start_dt.strftime("%d.%m.%Y") if 'start_dt' in locals() else "N/A"
            
            # Определяем emoji для локации
            location_emoji = "🏢" if location == "Göktürk" else "🏬" if location == "Yenibosna" else "📍"
            
            admin_message = (
                f"🏁 *Vardiya Tamamlandı*\n\n"
                f"👤 *Çalışan:* {user_name}\n"
                f"{location_emoji} *Lokasyon:* {location}\n"
                f"📅 *Tarih:* {date_formatted}\n"
                f"🕐 *Başlangıç:* {start_time_formatted}\n"
                f"🕕 *Bitiş:* {end_time_formatted}\n"
                f"⏱️ *Süre:* {duration_hours} saat\n"
                f"📊 *Vardiya ID:* `{shift_id}`"
            )
            
            print(f"[DEBUG] Sending admin notifications...")
            print(f"[DEBUG] Admin message: {admin_message}")
            
            # Отправляем уведомление каждому администратору
            notification_count = 0
            for admin_id in ADMIN_IDS:
                try:
                    await context.bot.send_message(
                        chat_id=admin_id, 
                        text=admin_message,
                        parse_mode="Markdown"
                    )
                    notification_count += 1
                    print(f"[DEBUG] ✅ Admin notification sent to: {admin_id}")
                except Exception as admin_error:
                    print(f"[ERROR] ❌ Admin {admin_id} notification failed: {admin_error}")
            
            print(f"[DEBUG] Total admin notifications sent: {notification_count}/{len(ADMIN_IDS)}")
            
        except Exception as notification_error:
            print(f"[ERROR] Admin notification system failed: {notification_error}")
            # Не прерываем выполнение, если уведомления не сработали
        
        # Отправляем подтверждение пользователю
        await update.message.reply_text("✅ Vardiyanız başarıyla sonlandırıldı.", reply_markup=main_menu)
        return "main_menu"
        
    except Exception as e:
        print(f"[end_shift_handler] ❌ HATA: user_id={user_id}, error={e}")
        print(f"[DEBUG] Exception details: {type(e).__name__}: {str(e)}")
        await update.message.reply_text("❌ Vardiya sonlandırılırken bir hata oluştu.")
        return "shift_menu"  # Возвращаем в меню смены при ошибке

# async def end_shift_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
#     user = update.effective_user
#     telegram_id = user.id
#     now = datetime.now(istanbul_tz)
#     now_str = now.strftime("%Y-%m-%d %H:%M:%S")

#     # Kullanıcıyı veritabanından al
#     user_record = await get_user(telegram_id)
#     if not user_record:
#         await update.message.reply_text("⚠️ Kullanıcı kaydı bulunamadı.")
#         print(f"[end_shift_handler] Kullanıcı yok: telegram_id={telegram_id}")
#         return

#     user_id = user_record[0]  # Users.id

#     # Aktif vardiyayı kontrol et
#     active_shift = await get_active_shift(user_id)
#     if not active_shift:
#         await update.message.reply_text("❗ Aktif bir vardiyanız bulunmamaktadır.")
#         print(f"[end_shift_handler] Aktif vardiya yok: user_id={user_id}")
#         return

#     start_time_str = active_shift[2]  # 3. sütun: start_time

#     if not start_time_str:
#         await update.message.reply_text("⚠️ Vardiya başlangıç zamanı tespit edilemedi.")
#         print(f"[end_shift_handler] start_time None: user_id={user_id}")
#         return

#     try:
#         await end_shift(user_id, now_str)
#         await update.message.reply_text("✅ Vardiyanız başarıyla sonlandırıldı.", reply_markup=main_menu)
#         return "main_menu"
#         print(f"[end_shift_handler] Vardiya sonlandırıldı: user_id={user_id}, now={now_str}")
#     except Exception as e:
#         await update.message.reply_text("❌ Vardiya sonlandırılırken bir hata oluştu.")
#         print(f"[end_shift_handler] HATA: user_id={user_id}, error={e}")

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
            print(f"[ERROR] Admin bildirimi başarısız: {e}")

    if status == "active":
        await update.message.reply_text("Kayıt başarılı. Menüye yönlendiriliyorsunuz.", reply_markup=main_menu)
        return "main_menu"
    else:
        active_check_pending[telegram_id] = update.message.chat_id
        await update.message.reply_text("Kaydınız alındı. Yöneticinin onayını bekleyiniz. Onaylandığınızda bilgilendirileceksiniz.")
        return None
