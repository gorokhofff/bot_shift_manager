export const translations = {
  ru: {
    // Навигация
    nav_brand: "ShiftManager",
    nav_dashboard: "Дашборд",
    nav_employees: "Сотрудники",
    nav_shifts: "Смены",
    nav_reports: "Отчеты",
    nav_reports_edit: "Отчеты (ред)",
    nav_payroll: "ФОТ",
    nav_schedule: "График",
    nav_rates: "Тарифы",
    nav_plans: "Планы",
    nav_admin_db: "Админ БД",
    nav_logout: "Выход",
    
    // Общие
    btn_save: "Сохранить",
    btn_cancel: "Отмена",
    btn_edit: "Редактировать",
    btn_delete: "Удалить",
    btn_copy_prev: "Копировать прошлый",
    status_active: "Активен",
    status_inactive: "Неактивен",
    loading: "Загрузка...",
    
    // Дашборд
    dash_title: "Панель управления",
    dash_active_shifts: "Активные смены",
    dash_no_active: "Нет активных смен",
    dash_monthly_stats: "Статистика за месяц",
    dash_revenue: "Выручка",
    dash_shifts_count: "Смен",
    dash_total_hours: "Часов",
    dash_top_employees: "Топ сотрудников (часы)",
    
    // График (EmployeeSchedules)
    sched_title: "Расписания сотрудников",
    sched_year: "Год",
    sched_month: "Месяц",
    sched_location: "Заведение",
    sched_all_locations: "Все заведения",
    sched_create_basic: "Создать базовые",
    sched_save_all: "Сохранить все",
    sched_unsaved: "Есть несохраненные изменения!",
    sched_legend: "Легенда",
    sched_working: "Рабочий",
    sched_day_off: "Выходной",
    
    // Новые кнопки и настройки
    sched_btn_show_all: "Показать всех",
    sched_btn_show_active_loc: "Только работавшие здесь",
    sched_btn_settings: "Настройки времени",
    sched_settings_title: "Стандартное время работы для",
    sched_save_settings: "Сохранить настройки",
    sched_msg_settings_saved: "Настройки времени сохранены",
    sched_msg_save_error: "Ошибка сохранения",
    
    // Shift Summary
    summ_title: "Сводка по сменам",
    summ_name: "Имя",
    summ_total: "Итог",
    summ_legend_red: "Не отметился (смена по графику)",
    summ_legend_blue: "Отметился (выходной по графику)",
    summ_legend_norm: "По графику",
    
    // Reports Page
    rep_title: "Отчеты",
    rep_valid: "Валидные",
    rep_errors: "Ошибки",
    rep_unknown: "Неизвестно",
    rep_history: "История",
    
    // Логин
    login_title: "Вход в систему",
    login_user: "Логин",
    login_pass: "Пароль",
    login_btn: "Войти",
    login_error: "Неверный логин или пароль",
    
    // Месяцы
    month_1: "Январь", month_2: "Февраль", month_3: "Март", month_4: "Апрель",
    month_5: "Май", month_6: "Июнь", month_7: "Июль", month_8: "Август",
    month_9: "Сентябрь", month_10: "Октябрь", month_11: "Ноябрь", month_12: "Декабрь",
    
    // Shift Summary
    summ_title: "Сводка по сменам",
    summ_name: "Сотрудник",
    summ_period_1: "1–15 число",
    summ_period_2: "16–31 число",
    summ_total: "Итог",
    summ_legend_title: "Обозначения",
    summ_legend_red: "Прогул (была смена, нет часов)",
    summ_legend_blue: "Выход в выходной",
    summ_legend_norm: "По графику",
    summ_legend_future: "Будущие дни без подсветки",

    // Reports Page
    rep_title: "Управление отчетами",
    rep_unsaved: "Есть несохраненные изменения",
    rep_test_btn: "Тест сохранения",
    rep_edit_mode: "Режим правки",
    rep_view_mode: "Просмотр",
    rep_save_btn: "Сохранить изменения",
    rep_cancel_btn: "Отмена",
    rep_saving: "Сохранение...",
    
    // Stats & Filters
    stats_total: "Всего",
    stats_valid: "Корректные",
    stats_invalid: "Ошибки",
    stats_unknown: "Неизвестно",
    
    // Table Headers
    col_id: "ID",
    col_valid: "Статус",
    col_author: "Автор",
    col_date_created: "Создан",
    col_location: "Заведение",
    col_date_report: "Дата отчета",
    col_sales: "Продажи",
    col_dubai: "Dubai Choc",
    col_bonche: "Bonche",
    col_free: "Бесплатно",
    col_replace: "Замена",
    col_history: "История",
    
    // Audit
    audit_title: "История изменений отчета",
    audit_version: "Версия",
    audit_action: "Действие",
    audit_user: "Пользователь",
    audit_changes: "Изменения",
    audit_reason: "Причина",
    audit_details: "Детали",
    audit_empty: "История пуста",

    // Calendar (Новое)
    cal_title: "Календарь отчетов",
    cal_valid: "Принят",
    cal_invalid: "Ошибка",
    cal_missing: "Нет отчета",
    cal_empty: "Нет данных за выбранный период",
    cal_legend: "Легенда",
    cal_stat_valid: "валидных",
    cal_stat_invalid: "ошибок",
    cal_stat_missing: "пропущено",
    wd_1: "Пн", wd_2: "Вт", wd_3: "Ср", wd_4: "Чт", wd_5: "Пт", wd_6: "Сб", wd_0: "Вс",

    // Calendar Metrics
    cal_metric_status: "Статус сдачи",
    cal_metric_sales: "Продажи (Всего)",
    cal_metric_dubai: "Dubai Chocolate",
    cal_metric_bonche: "Bonche",
    cal_metric_free: "Бесплатно",
    cal_reports_count: "отчетов",

    // Dashboard New
    dash_sales_title: "Продажи (шт)",
    dash_sales_chart_title: "Динамика продаж",
    dash_vs_prev: "к пред. месяцу",
    dash_active_now: "Сейчас работают",
    dash_started_at: "Начал в",
    dash_duration: "В смене",
    dash_stuck_warning: "Внимание: смена > 14 часов",
    dash_loc_yenibosna: "Yenibosna",
    dash_loc_gokturk: "Göktürk",

    rep_filter_all: "Все отчеты",
    rep_filter_doubles: "Повторы (Дубликаты)",
    rep_filter_no_sales: "Нет продаж (0)",
    rep_doubles_found: "Найдено дубликатов",

    // Dashboard Statuses & Actions (NEW)
    status_working: "Работает",
    status_missing: "По плану, но не здесь",
    status_extra: "Работает в выходной",
    status_offline: "OFFLINE",
    btn_stop: "Стоп",
    confirm_finish: "Завершить смену сотрудника {name} сейчас?",
    online_suffix: "online",

    dash_title: "Дашборд",
    dash_loc_yenibosna: "Yenibosna",
    dash_loc_gokturk: "Göktürk",
    dash_no_active: "Нет активных смен",
    
    // Новые статусы
    status_missing: "По плану, но не здесь",
    status_extra: "Работает в выходной",
    status_offline: "OFFLINE",
    
    // Действия
    btn_stop: "Завершить",
    confirm_finish: "Завершить смену сотрудника {name} сейчас?",
    online_suffix: "online",
    show_missing: "Показать отсутствующих ({count})",
    hide_missing: "Скрыть отсутствующих",

    // Pagination & Table actions
    rows_per_page: "Строк на странице:",
    page_of: "из",
    btn_edit_row: "Правка",
    btn_save_row: "ОК",
    btn_cancel_row: "Отм.",
    filter_reset: "Сбросить фильтры"
  },

  tr: {
    // Nav
    nav_brand: "ShiftManager",
    nav_dashboard: "Panel",
    nav_employees: "Personel",
    nav_shifts: "Vardiyalar",
    nav_reports: "Raporlar",
    nav_reports_edit: "Raporlar (Düz)",
    nav_payroll: "Maaşlar",
    nav_schedule: "Program",
    nav_rates: "Tarifeler",
    nav_plans: "Planlar",
    nav_admin_db: "Yönetici DB",
    nav_logout: "Çıkış",
    
    // Common
    btn_save: "Kaydet",
    btn_cancel: "İptal",
    btn_edit: "Düzenle",
    btn_delete: "Sil",
    btn_copy_prev: "Öncekini Kopyala",
    status_active: "Aktif",
    status_inactive: "Pasif",
    loading: "Yükleniyor...",
    
    // Dashboard
    dash_title: "Yönetim Paneli",
    dash_active_shifts: "Aktif Vardiyalar",
    dash_no_active: "Aktif vardiya yok",
    dash_monthly_stats: "Aylık İstatistikler",
    dash_revenue: "Ciro",
    dash_shifts_count: "Vardiya",
    dash_total_hours: "Saat",
    dash_top_employees: "En İyi Personel (Saat)",
    
    // Schedules
    sched_title: "Personel Programı",
    sched_year: "Yıl",
    sched_month: "Ay",
    sched_location: "Şube",
    sched_all_locations: "Tüm Şubeler",
    sched_create_basic: "Temel Oluştur",
    sched_save_all: "Tümünü Kaydet",
    sched_unsaved: "Kaydedilmemiş değişiklikler var!",
    sched_legend: "Lejant",
    sched_working: "Çalışıyor",
    sched_day_off: "İzinli",

    // Новые кнопки и настройки
    sched_btn_show_all: "Tümünü Göster",
    sched_btn_show_active_loc: "Burada Çalışanlar",
    sched_btn_settings: "Saat Ayarları",
    sched_settings_title: "Standart Çalışma Saatleri:",
    sched_save_settings: "Ayarları Kaydet",
    sched_msg_settings_saved: "Saat ayarları kaydedildi",
    sched_msg_save_error: "Kayıt hatası",
    
    // Shift Summary
    summ_title: "Vardiya Özeti",
    summ_name: "İsim",
    summ_total: "Toplam",
    summ_legend_red: "Giriş yok (Programda var)",
    summ_legend_blue: "Giriş var (Programda yok)",
    summ_legend_norm: "Normal",
    
    // Reports
    rep_title: "Raporlar",
    rep_valid: "Geçerli",
    rep_errors: "Hatalar",
    rep_unknown: "Bilinmeyen",
    rep_history: "Geçmiş",
    
    // Login
    login_title: "Giriş Yap",
    login_user: "Kullanıcı Adı",
    login_pass: "Şifre",
    login_btn: "Giriş",
    login_error: "Hatalı kullanıcı adı veya şifre",
    
    // Months
    month_1: "Ocak", month_2: "Şubat", month_3: "Mart", month_4: "Nisan",
    month_5: "Mayıs", month_6: "Haziran", month_7: "Temmuz", month_8: "Ağustos",
    month_9: "Eylül", month_10: "Ekim", month_11: "Kasım", month_12: "Aralık",
    
    // Shift Summary
    summ_title: "Vardiya Özeti",
    summ_name: "Personel",
    summ_period_1: "1–15 Günler",
    summ_period_2: "16–31 Günler",
    summ_total: "Toplam",
    summ_legend_title: "Lejant",
    summ_legend_red: "Gelmedi (Vardiyası vardı)",
    summ_legend_blue: "Ekstra (İzin günü geldi)",
    summ_legend_norm: "Normal",
    summ_legend_future: "Gelecek günler",

    // Reports Page
    rep_title: "Rapor Yönetimi",
    rep_unsaved: "Kaydedilmemiş değişiklikler var",
    rep_test_btn: "Test Kayıt",
    rep_edit_mode: "Düzenleme Modu",
    rep_view_mode: "İzleme Modu",
    rep_save_btn: "Değişiklikleri Kaydet",
    rep_cancel_btn: "İptal",
    rep_saving: "Kaydediliyor...",
    
    // Stats & Filters
    stats_total: "Toplam",
    stats_valid: "Geçerli",
    stats_invalid: "Hatalı",
    stats_unknown: "Bilinmeyen",
    
    // Table Headers
    col_id: "ID",
    col_valid: "Durum",
    col_author: "Yazar",
    col_date_created: "Oluşturuldu",
    col_location: "Şube",
    col_date_report: "Rapor Tarihi",
    col_sales: "Satış",
    col_dubai: "Dubai Çik.",
    col_bonche: "Bonche",
    col_free: "Ücretsiz",
    col_replace: "Değişim",
    col_history: "Geçmiş",
    
    // Audit
    audit_title: "Rapor Değişiklik Geçmişi",
    audit_version: "Sürüm",
    audit_action: "İşlem",
    audit_user: "Kullanıcı",
    audit_changes: "Değişiklikler",
    audit_reason: "Sebep",
    audit_details: "Detaylar",
    audit_empty: "Geçmiş bulunamadı",
    // Calendar (New)
    cal_title: "Rapor Takvimi",
    cal_valid: "Kabul Edildi",
    cal_invalid: "Hatalı",
    cal_missing: "Eksik",
    cal_empty: "Seçilen dönem için veri yok",
    cal_legend: "Lejant",
    cal_stat_valid: "geçerli",
    cal_stat_invalid: "hatalı",
    cal_stat_missing: "eksik",
    wd_1: "Pzt", wd_2: "Sal", wd_3: "Çar", wd_4: "Per", wd_5: "Cum", wd_6: "Cmt", wd_0: "Paz",
    cal_metric_status: "Rapor Durumu",
    cal_metric_sales: "Satış (Toplam)",
    cal_metric_dubai: "Dubai Çikolatası",
    cal_metric_bonche: "Bonche",
    cal_metric_free: "İkram",
    cal_reports_count: "rapor",

    // Dashboard New
    dash_sales_title: "Satış (Adet)",
    dash_sales_chart_title: "Satış Grafiği",
    dash_vs_prev: "geçen aya göre",
    dash_active_now: "Şu an Çalışanlar",
    dash_started_at: "Başlangıç",
    dash_duration: "Süre",
    dash_stuck_warning: "Dikkat: > 14 saat",
    dash_loc_yenibosna: "Yenibosna",
    dash_loc_gokturk: "Göktürk",

    // Dashboard Statuses & Actions (NEW)
    status_working: "Çalışıyor",
    status_missing: "Gelmedi", // Или "Gelmedi" (Не пришел)
    status_extra: "İzin gününde çalışıyor",
    status_offline: "ÇEVRİMDIŞI",
    btn_stop: "Bitir", // "Stop" или "Durdur"
    confirm_finish: "{name} adlı personelin vardiyasını şimdi bitirmek istiyor musunuz?",
    online_suffix: "çevrimiçi",
    dash_title: "Panel",
    dash_loc_yenibosna: "Yenibosna",
    dash_loc_gokturk: "Göktürk",
    dash_no_active: "Aktif vardiya yok",
    
    // Новые статусы
    status_missing: "Planlı fakat yok",
    status_extra: "İzin gününde çalışıyor",
    status_offline: "ÇEVRİMDIŞI",
    
    // Действия
    btn_stop: "Bitir",
    confirm_finish: "{name} adlı personelin vardiyasını şimdi bitirmek istiyor musunuz?",
    online_suffix: "çevrimiçi",
    show_missing: "Gelmayanları göster ({count})",
    hide_missing: "Gizle",

    // Reports Page Filters
    rep_filter_all: "Tüm Raporlar",
    rep_filter_doubles: "Çift Raporlar",
    rep_filter_no_sales: "Satış Yok (0)",
    rep_doubles_found: "Çift kayıt bulundu",

    // Pagination & Table actions
    rows_per_page: "Sayfa başına satır:",
    page_of: "/",
    btn_edit_row: "Düzenle",
    btn_save_row: "Tamam",
    btn_cancel_row: "İptal",
    filter_reset: "Filtreleri Temizle"
  }
};