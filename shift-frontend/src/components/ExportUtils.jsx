// Утилиты для экспорта отчетов ФОТ
import React, { useState } from 'react';
/**
 * Экспортирует отчет ФОТ в CSV формат
 */
export const exportPayrollToCSV = (report, entries) => {
  const establishmentNames = { 1: "Yenibosna", 2: "Göktürk" };
  const establishmentName = establishmentNames[report.establishment_id] || 'Неизвестно';
  
  // Заголовки CSV
  const headers = [
    'Сотрудник',
    'Роль', 
    'Отработанные часы',
    'Количество кальянов',
    'Базовая зарплата',
    'Мотивация %',
    'Мотивация сумма',
    'Аванс',
    'Перевод на карту', 
    'Квартира',
    'К выплате'
  ];

  // Данные строк
  const rows = entries.map(entry => [
    entry.user_name || 'Неизвестен',
    entry.user_role || '',
    entry.hours_worked || 0,
    entry.hookahs_sold || 0,
    entry.base_salary || 0,
    entry.motivation_percent || 0,
    entry.motivation_amount || 0,
    entry.prepaid_expense || 0,
    entry.card_payment || 0,
    entry.housing_deduction || 0,
    entry.final_payment || 0
  ]);

  // Строка итогов
  const totals = [
    'ИТОГО:',
    '',
    entries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0),
    entries.reduce((sum, entry) => sum + (entry.hookahs_sold || 0), 0),
    entries.reduce((sum, entry) => sum + (entry.base_salary || 0), 0),
    '',
    entries.reduce((sum, entry) => sum + (entry.motivation_amount || 0), 0),
    entries.reduce((sum, entry) => sum + (entry.prepaid_expense || 0), 0),
    entries.reduce((sum, entry) => sum + (entry.card_payment || 0), 0),
    entries.reduce((sum, entry) => sum + (entry.housing_deduction || 0), 0),
    entries.reduce((sum, entry) => sum + (entry.final_payment || 0), 0)
  ];

  // Формируем CSV контент
  let csvContent = '\uFEFF'; // BOM для правильного отображения UTF-8
  
  // Информация об отчете
  csvContent += `Отчет ФОТ #${report.id}\n`;
  csvContent += `Заведение: ${establishmentName}\n`;
  csvContent += `Период: ${formatDate(report.period_start)} - ${formatDate(report.period_end)}\n`;
  csvContent += `Выручка: ${report.revenue || 'Не указана'}\n`;
  csvContent += `Общее количество кальянов: ${report.total_hookahs}\n`;
  csvContent += `Статус: ${report.status === 'finalized' ? 'Финализирован' : 'Черновик'}\n`;
  csvContent += `Создан: ${formatDate(report.created_at)}\n\n`;

  // Заголовки таблицы
  csvContent += headers.join(',') + '\n';
  
  // Данные
  rows.forEach(row => {
    csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
  });
  
  // Итоги
  csvContent += totals.map(cell => `"${cell}"`).join(',') + '\n';

  // Создаем и скачиваем файл
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `FOT_Report_${report.id}_${establishmentName}_${formatDateForFilename(report.period_start)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Экспортирует отчет ФОТ в Excel формат (требует библиотеки xlsx)
 */
export const exportPayrollToExcel = async (report, entries) => {
  try {
    // Динамический импорт библиотеки xlsx
    const XLSX = await import('xlsx');
    
    const establishmentNames = { 1: "Yenibosna", 2: "Göktürk" };
    const establishmentName = establishmentNames[report.establishment_id] || 'Неизвестно';

    // Создаем новую книгу
    const workbook = XLSX.utils.book_new();

    // Подготавливаем данные для таблицы
    const tableData = [
      // Заголовки
      [
        'Сотрудник',
        'Роль',
        'Отработанные часы',
        'Количество кальянов', 
        'Базовая зарплата',
        'Мотивация %',
        'Мотивация сумма',
        'Аванс',
        'Перевод на карту',
        'Квартира',
        'К выплате'
      ],
      // Данные сотрудников
      ...entries.map(entry => [
        entry.user_name || 'Неизвестен',
        entry.user_role || '',
        entry.hours_worked || 0,
        entry.hookahs_sold || 0,
        entry.base_salary || 0,
        entry.motivation_percent || 0,
        entry.motivation_amount || 0,
        entry.prepaid_expense || 0,
        entry.card_payment || 0,
        entry.housing_deduction || 0,
        entry.final_payment || 0
      ]),
      // Строка итогов
      [
        'ИТОГО:',
        '',
        entries.reduce((sum, entry) => sum + (entry.hours_worked || 0), 0),
        entries.reduce((sum, entry) => sum + (entry.hookahs_sold || 0), 0),
        entries.reduce((sum, entry) => sum + (entry.base_salary || 0), 0),
        '',
        entries.reduce((sum, entry) => sum + (entry.motivation_amount || 0), 0),
        entries.reduce((sum, entry) => sum + (entry.prepaid_expense || 0), 0),
        entries.reduce((sum, entry) => sum + (entry.card_payment || 0), 0),
        entries.reduce((sum, entry) => sum + (entry.housing_deduction || 0), 0),
        entries.reduce((sum, entry) => sum + (entry.final_payment || 0), 0)
      ]
    ];

    // Создаем лист с основной таблицей
    const worksheet = XLSX.utils.aoa_to_sheet(tableData);

    // Добавляем информацию об отчете в начало листа
    const reportInfo = [
      [`Отчет ФОТ #${report.id}`],
      [`Заведение: ${establishmentName}`],
      [`Период: ${formatDate(report.period_start)} - ${formatDate(report.period_end)}`],
      [`Выручка: ${report.revenue || 'Не указана'}`],
      [`Общее количество кальянов: ${report.total_hookahs}`],
      [`Статус: ${report.status === 'finalized' ? 'Финализирован' : 'Черновик'}`],
      [`Создан: ${formatDate(report.created_at)}`],
      [''], // Пустая строка
    ];

    // Вставляем информацию об отчете в начало
    XLSX.utils.sheet_add_aoa(worksheet, reportInfo, { origin: 'A1' });
    
    // Сдвигаем таблицу вниз
    XLSX.utils.sheet_add_aoa(worksheet, tableData, { origin: `A${reportInfo.length + 1}` });

    // Настраиваем ширину колонок
    const colWidths = [
      { wpx: 150 }, // Сотрудник
      { wpx: 120 }, // Роль
      { wpx: 100 }, // Часы
      { wpx: 100 }, // Кальяны
      { wpx: 120 }, // Базовая ЗП
      { wpx: 100 }, // Мотивация %
      { wpx: 120 }, // Мотивация сумма
      { wpx: 100 }, // Аванс
      { wpx: 120 }, // Карта
      { wpx: 100 }, // Квартира
      { wpx: 120 }  // К выплате
    ];
    worksheet['!cols'] = colWidths;

    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчет ФОТ');

    // Создаем второй лист с детализацией
    const detailData = [
      ['Детализация отчета'],
      [''],
      ['Параметры расчета:'],
      [`Выручка (Revenue): ${report.revenue || 'Не указана'}`],
      [`Revenue без сервиса: ${report.revenue ? (report.revenue / 1.1).toFixed(2) : 'Не рассчитана'}`],
      [`Общее количество кальянов: ${report.total_hookahs}`],
      [''],
      ['Формулы расчета:'],
      ['Базовая зарплата (кальянщик) = Количество кальянов × Тариф за кальян'],
      ['Базовая зарплата (другие роли) = Фиксированный тариф за период'],
      ['Мотивация = (Мотивация % / 100) × (Revenue / 1.1)'],
      ['К выплате = Базовая зарплата + Мотивация - Аванс - Карта - Квартира'],
      [''],
      ['Настройки тарифов на дату создания отчета:'],
      // TODO: Здесь можно добавить актуальные тарифы
    ];

    const detailWorksheet = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Детализация');

    // Сохраняем файл
    const fileName = `FOT_Report_${report.id}_${establishmentName}_${formatDateForFilename(report.period_start)}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    return true;
  } catch (error) {
    console.error('Ошибка экспорта в Excel:', error);
    alert('❌ Ошибка экспорта в Excel. Попробуйте экспорт в CSV.');
    return false;
  }
};

/**
 * Экспортирует список всех отчетов ФОТ
 */
export const exportPayrollListToCSV = (reports) => {
  const establishmentNames = { 1: "Yenibosna", 2: "Göktürk" };
  
  const headers = [
    'ID отчета',
    'Заведение',
    'Период начало',
    'Период конец',
    'Выручка',
    'Количество кальянов',
    'Статус',
    'Создан',
    'Обновлен'
  ];

  const rows = reports.map(report => [
    report.id,
    establishmentNames[report.establishment_id] || 'Неизвестно',
    formatDate(report.period_start),
    formatDate(report.period_end),
    report.revenue || 'Не указана',
    report.total_hookahs || 0,
    report.status === 'finalized' ? 'Финализирован' : 'Черновик',
    formatDate(report.created_at),
    formatDate(report.updated_at)
  ]);

  let csvContent = '\uFEFF'; // BOM для UTF-8
  csvContent += 'Список всех отчетов ФОТ\n';
  csvContent += `Экспортировано: ${formatDate(new Date().toISOString())}\n\n`;
  csvContent += headers.join(',') + '\n';
  
  rows.forEach(row => {
    csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `FOT_Reports_List_${formatDateForFilename(new Date().toISOString())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Вспомогательные функции
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
};

const formatDateForFilename = (dateStr) => {
  if (!dateStr) return 'unknown';
  return new Date(dateStr).toISOString().split('T')[0];
};

/**
 * Компонент кнопки экспорта
 */
export const ExportButton = ({ report, entries, variant = 'primary' }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      if (format === 'csv') {
        exportPayrollToCSV(report, entries);
      } else if (format === 'excel') {
        await exportPayrollToExcel(report, entries);
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('❌ Ошибка экспорта файла');
    } finally {
      setExporting(false);
    }
  };

  if (variant === 'dropdown') {
    return (
      <div className="relative group">
        <button
          disabled={exporting}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
        >
          {exporting ? '📤 Экспорт...' : '📤 Экспорт'}
        </button>
        
        <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="block w-full text-left px-4 py-2 text-white hover:bg-gray-600 rounded-t-lg"
          >
            📄 Скачать CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="block w-full text-left px-4 py-2 text-white hover:bg-gray-600 rounded-b-lg"
          >
            📊 Скачать Excel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => handleExport('csv')}
      disabled={exporting}
      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
    >
      {exporting ? '📤 Экспорт...' : '📤 Экспорт CSV'}
    </button>
  );
};