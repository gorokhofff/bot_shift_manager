import React, { useState, useEffect } from 'react';
import API from '../api';

// Функция парсинга отчетов (упрощенная версия из ReportsPage)
function parseReportText(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { isValid: false };
  }

  try {
    let fieldsFound = 0;
    const mainFields = ['tarih', 'satış', 'Ücretsiz', 'Değiştirme', 'koz', 'Elek', 'nargile'];
    
    mainFields.forEach(field => {
      const regex = new RegExp(`${field}\\s*-\\s*([^\\n\\(]+)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        fieldsFound++;
      }
    });

    return { isValid: fieldsFound >= 3 }; // Минимум 3 поля для валидности
  } catch (error) {
    return { isValid: false };
  }
}

// Получение заведения из смены
function getLocationFromShift(shiftData, reportData) {
  if (!shiftData || !reportData) return 'Неизвестно';

  if (reportData.shift_id) {
    const directShift = shiftData.find(shift => shift.id === reportData.shift_id);
    if (directShift) return directShift.location || 'Неизвестно';
  }

  let reportDate = null;
  if (reportData.created_at) {
    reportDate = reportData.created_at.split('T')[0];
  }

  if (reportDate) {
    const shiftsOnDate = shiftData.filter(shift => shift.shift_date === reportDate);
    if (shiftsOnDate.length === 1) {
      return shiftsOnDate[0].location || 'Неизвестно';
    }
  }

  return 'Неизвестно';
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function ReportsCalendar() {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [reportsData, setReportsData] = useState({});

  useEffect(() => {
    loadReportsData();
  }, [selectedYear, selectedMonth]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      
      // Загружаем все необходимые данные
      const [reportsResponse, shiftsResponse] = await Promise.all([
        API.get('/reports'),
        API.get('/shifts')
      ]);

      const reports = reportsResponse.data || [];
      const shifts = shiftsResponse.data || [];

      // Обрабатываем отчеты
      const processedReports = {};

      reports.forEach(report => {
        if (!report.created_at) return;

        const reportDate = new Date(report.created_at);
        const reportYear = reportDate.getFullYear();
        const reportMonth = reportDate.getMonth();

        // Фильтруем по выбранному году и месяцу
        if (reportYear !== selectedYear || reportMonth !== selectedMonth) return;

        const day = reportDate.getDate();
        const location = getLocationFromShift(shifts, report);
        const parsedReport = parseReportText(report.report_text);

        // Инициализируем структуру если нет
        if (!processedReports[location]) {
          processedReports[location] = {};
        }

        if (!processedReports[location][day]) {
          processedReports[location][day] = {
            hasReport: false,
            isValid: false,
            reports: []
          };
        }

        // Добавляем отчет
        processedReports[location][day].hasReport = true;
        processedReports[location][day].reports.push({
          id: report.id,
          isValid: parsedReport.isValid,
          text: report.report_text
        });

        // Если хотя бы один отчет валидный, день считается валидным
        if (parsedReport.isValid) {
          processedReports[location][day].isValid = true;
        }
      });

      setReportsData(processedReports);
    } catch (error) {
      console.error('Ошибка загрузки данных отчетов:', error);
      setReportsData({});
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Конвертируем в понедельник = 0
  };

  const getDayStatus = (location, day) => {
    const dayData = reportsData[location]?.[day];
    
    if (!dayData || !dayData.hasReport) {
      return 'no-report'; // Красный - нет отчета
    }
    
    if (dayData.isValid) {
      return 'valid'; // Зеленый - валидный отчет
    }
    
    return 'invalid'; // Оранжевый - невалидный отчет
  };

  const getDayClass = (status) => {
    const baseClass = "relative w-8 h-8 flex items-center justify-center text-sm font-medium rounded cursor-pointer transition-all duration-200 hover:scale-110";
    
    switch (status) {
      case 'valid':
        return `${baseClass} text-white bg-green-500 bg-opacity-25 border-2 border-green-400`;
      case 'invalid':
        return `${baseClass} text-white bg-orange-500 border-2 border-orange-400`;
      case 'no-report':
        return `${baseClass} text-white bg-red-500 border-2 border-red-400`;
      default:
        return `${baseClass} text-gray-400 hover:text-white hover:bg-gray-700`;
    }
  };

  const getDayIcon = (status) => {
    switch (status) {
      case 'valid':
        return <span className="absolute top-0 right-0 text-green-400 text-xs">✓</span>;
      case 'invalid':
        return <span className="absolute top-0 right-0 text-orange-400 text-xs">⚠</span>;
      case 'no-report':
        return <span className="absolute top-0 right-0 text-red-400 text-xs">✗</span>;
      default:
        return null;
    }
  };

  const renderCalendar = (location) => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
    const days = [];

    // Пустые ячейки для начала месяца
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="w-8 h-8"></div>
      );
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const status = getDayStatus(location, day);
      const dayClass = getDayClass(status);
      
      days.push(
        <div
          key={day}
          className={dayClass}
          title={`${day} ${MONTHS[selectedMonth]} - ${
            status === 'valid' ? 'Валидный отчет' :
            status === 'invalid' ? 'Невалидный отчет' :
            status === 'no-report' ? 'Нет отчета' : ''
          }`}
        >
          <span className="z-10">{day}</span>
          {getDayIcon(status)}
        </div>
      );
    }

    return days;
  };

  const getLocationDisplayName = (location) => {
    const locationNames = {
      'Göktürk': '🏢 Göktürk',
      'Yenibosna': '🏬 Yenibosna',
      'Неизвестно': '❓ Неизвестно'
    };
    return locationNames[location] || `📍 ${location}`;
  };

  const getLocationStats = (location) => {
    const locationData = reportsData[location] || {};
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    
    let validDays = 0;
    let invalidDays = 0;
    let noreportDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const status = getDayStatus(location, day);
      switch (status) {
        case 'valid': validDays++; break;
        case 'invalid': invalidDays++; break;
        case 'no-report': noreportDays++; break;
      }
    }

    return { validDays, invalidDays, noreportDays, totalDays: daysInMonth };
  };

  const locations = Object.keys(reportsData).filter(loc => loc !== 'Неизвестно').sort();
  if (reportsData['Неизвестно']) {
    locations.push('Неизвестно');
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">📊 Календарь отчетов</h2>
        
        {/* Селекторы года и месяца */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-white text-sm font-medium">Год:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500"
            >
              {[2023, 2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-white text-sm font-medium">Месяц:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500"
            >
              {MONTHS.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full"></div>
          <p className="mt-2 text-white">Загрузка данных отчетов...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>📭 Нет отчетов за {MONTHS[selectedMonth]} {selectedYear}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {locations.map(location => {
            const stats = getLocationStats(location);
            
            return (
              <div key={location} className="bg-gray-700 rounded-lg p-4">
                {/* Заголовок заведения */}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {getLocationDisplayName(location)}
                  </h3>
                  
                  {/* Статистика */}
                  <div className="flex justify-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-green-400">{stats.validDays} валидных</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      <span className="text-orange-400">{stats.invalidDays} невалидных</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-red-400">{stats.noreportDays} без отчета</span>
                    </span>
                  </div>
                </div>

                {/* Заголовки дней недели */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-400 h-6 flex items-center justify-center">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Календарь */}
                <div className="grid grid-cols-7 gap-1">
                  {renderCalendar(location)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Легенда */}
      <div className="mt-6 bg-gray-700 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3 text-center">Легенда:</h4>
        <div className="flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 bg-opacity-25 border-2 border-green-400 rounded flex items-center justify-center">
              <span className="text-green-400 text-xs">✓</span>
            </div>
            <span className="text-green-400">Валидный отчет</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 border-2 border-orange-400 rounded flex items-center justify-center">
              <span className="text-orange-400 text-xs">⚠</span>
            </div>
            <span className="text-orange-400">Невалидный отчет</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 border-2 border-red-400 rounded flex items-center justify-center">
              <span className="text-red-400 text-xs">✗</span>
            </div>
            <span className="text-red-400">Нет отчета</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsCalendar;