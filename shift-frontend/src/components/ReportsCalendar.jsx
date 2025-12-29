import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { useLanguage } from '../contexts/LanguageContext';

// Парсер для извлечения числовых данных
function parseReportData(text) {
  if (!text || typeof text !== 'string') return { isValid: false };
  
  const extract = (key) => {
    // ИСПРАВЛЕНИЕ: 
    // 1. [-—–:] - поддерживает дефис, длинное тире и двоеточие
    // 2. [_\\s]* - двойной слэш обязателен для JS строки, чтобы искать пробелы и _
    const regex = new RegExp(`${key}\\s*[-—–:]\\s*[_\\s]*(\\d+)`, 'i');
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  };

  let fieldsFound = 0;
  const mainFields = ['tarih', 'satış', 'Ücretsiz', 'Değiştirme', 'koz', 'Elek', 'nargile'];
  mainFields.forEach(field => {
    // Тут тоже разрешаем разные виды тире
    if (text.match(new RegExp(`${field}\\s*[-—–:]\\s*([^\\n\\(]+)`, 'i'))) fieldsFound++;
  });

  return {
    isValid: fieldsFound >= 3,
    sales: extract('satış'),
    dubai: extract('dubai chocolate'), 
    bonche: extract('Bonche'),
    free: extract('Ücretsiz'),
    change: extract('Değiştirme')
  };
}

function getLocationFromShift(shiftData, reportData) {
  if (!shiftData || !reportData) return 'Unknown';
  if (reportData.shift_id) {
    const directShift = shiftData.find(shift => shift.id === reportData.shift_id);
    if (directShift) return directShift.location || 'Unknown';
  }
  // Попытка определить по дате, если нет shift_id
  let reportDate = reportData.created_at ? reportData.created_at.split('T')[0] : null;
  if (reportDate) {
    const shiftsOnDate = shiftData.filter(shift => shift.shift_date === reportDate);
    if (shiftsOnDate.length === 1) return shiftsOnDate[0].location || 'Unknown';
  }
  return 'Unknown';
}

function ReportsCalendar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedMetric, setSelectedMetric] = useState('status'); 
  const [reportsData, setReportsData] = useState({});
  const { t, getMonthName } = useLanguage();

  const weekdays = [t('wd_1'), t('wd_2'), t('wd_3'), t('wd_4'), t('wd_5'), t('wd_6'), t('wd_0')];

  const metrics = [
    { id: 'status', label: t('cal_metric_status') },
    { id: 'sales', label: t('cal_metric_sales') },
    { id: 'dubai', label: t('cal_metric_dubai') },
    { id: 'bonche', label: t('cal_metric_bonche') },
    { id: 'free', label: t('cal_metric_free') }
  ];

  useEffect(() => {
    loadReportsData();
  }, [selectedYear, selectedMonth]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      const [reportsResponse, shiftsResponse] = await Promise.all([
        API.get('/reports'),
        API.get('/shifts')
      ]);

      const processedReports = {}; 
      const reports = reportsResponse.data || [];
      const shifts = shiftsResponse.data || [];

      reports.forEach(report => {
        if (!report.created_at) return;
        
        // 1. Извлекаем день из ТЕКСТА (tarih - DD)
        const tarihMatch = report.report_text?.match(/tarih\s*-\s*(\d{1,2})/i);
        let targetDay;
        const createdDate = new Date(report.created_at);

        if (tarihMatch) {
            targetDay = parseInt(tarihMatch[1], 10);
            
            // Проверка на отчет за прошлый месяц (например, 1-го числа отчет за 30-е)
            let rMonth = createdDate.getMonth();
            let rYear = createdDate.getFullYear();
            
            if (createdDate.getDate() < 5 && targetDay > 20) {
               if (rMonth === 0) { rMonth = 11; rYear -= 1; }
               else { rMonth -= 1; }
            }

            if (rMonth !== selectedMonth || rYear !== selectedYear) return;
        } else {
            // Если в тексте нет даты, используем created_at
            if (createdDate.getFullYear() !== selectedYear || createdDate.getMonth() !== selectedMonth) return;
            targetDay = createdDate.getDate();
        }

        const location = getLocationFromShift(shifts, report);
        if (location === 'Unknown' || location === 'Неизвестно') return;

        const parsed = parseReportData(report.report_text);
        
        if (!processedReports[location]) processedReports[location] = {};
        if (!processedReports[location][targetDay]) {
            processedReports[location][targetDay] = { 
                count: 0, 
                latestReportTime: 0,
                data: null
            };
        }

        const cell = processedReports[location][targetDay];
        cell.count += 1;

        // Берем данные из самого СВЕЖЕГО отчета за этот день
        const reportTime = new Date(report.created_at).getTime();
        if (reportTime > cell.latestReportTime) {
            cell.latestReportTime = reportTime;
            cell.data = { ...parsed, reportId: report.id };
        }
      });

      setReportsData(processedReports);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (dayData) => {
    if (!dayData || !dayData.data || !dayData.data.reportId) return;
    navigate(`/reports-parse?highlight=${dayData.data.reportId}`);
  };

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const renderCellContent = (dayData) => {
    if (!dayData || !dayData.data) return null;
    const { data, count } = dayData;
    
    let mainContent = null;
    if (selectedMetric !== 'status') {
       const val = data[selectedMetric];
       mainContent = <span className="text-sm font-bold drop-shadow-md">{val}</span>;
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {mainContent}
        {count > 1 && (
            <div className="absolute -top-1 -right-1 bg-white text-gray-900 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-gray-600 shadow-sm" title={`${count} ${t('cal_reports_count')}`}>
                {count}
            </div>
        )}
      </div>
    );
  };

  const renderCalendar = (location) => {
    const daysCount = getDaysInMonth(selectedYear, selectedMonth);
    const offset = getFirstDayOfMonth(selectedYear, selectedMonth);
    const days = [];

    for (let i = 0; i < offset; i++) days.push(<div key={`empty-${i}`} className="h-10"></div>);

    for (let day = 1; day <= daysCount; day++) {
      const dayData = reportsData[location]?.[day];
      
      let bgClass = "bg-gray-700/30 border-gray-700 text-gray-600"; // Пусто
      
      if (dayData && dayData.data) {
          const isValid = dayData.data.isValid;
          
          if (selectedMetric === 'status') {
              bgClass = isValid 
                ? "bg-green-900/40 border-green-800 text-green-200" 
                : "bg-orange-900/40 border-orange-800 text-orange-200";
          } else {
              const val = dayData.data[selectedMetric];
              if (val > 0) {
                   bgClass = "bg-blue-900/40 border-blue-700 text-white";
              } else {
                   bgClass = "bg-gray-700/50 border-gray-600 text-gray-400";
              }
              if (!isValid) bgClass += " ring-1 ring-orange-500 ring-inset";
          }
      } else {
           bgClass = "bg-red-900/10 border-red-900/30 text-red-900/30"; // Пропущено
      }

      const cursorClass = (dayData && dayData.data) ? "cursor-pointer hover:ring-2 hover:ring-white/50" : "cursor-default";

      days.push(
        <div 
            key={day} 
            onClick={() => handleDayClick(dayData)}
            className={`h-10 flex flex-col items-center justify-center rounded border ${bgClass} ${cursorClass} text-xs relative transition-all`}
            title={dayData?.data ? "Редактировать отчет" : `День ${day}`}
        >
          <span className={`absolute ${selectedMetric !== 'status' && dayData ? 'top-0.5 left-1 text-[8px] opacity-70' : 'text-xs'}`}>
             {day}
          </span>
          {renderCellContent(dayData)}
        </div>
      );
    }
    return days;
  };

  const locations = Object.keys(reportsData).sort();

return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6 mt-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
            {t('cal_title')}
            {selectedMetric !== 'status' && <span className="text-sm font-normal text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded">({metrics.find(m => m.id === selectedMetric)?.label})</span>}
        </h2>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center w-full xl:w-auto">
          {/* Метрики */}
          <div className="flex bg-gray-700 rounded p-1 overflow-x-auto max-w-full no-scrollbar">
            {metrics.map(m => (
                <button
                    key={m.id}
                    onClick={() => setSelectedMetric(m.id)}
                    className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap ${selectedMetric === m.id ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    {m.label}
                </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} className="bg-gray-700 text-white p-2 rounded text-sm border border-gray-600 outline-none flex-1 sm:flex-none">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} className="bg-gray-700 text-white p-2 rounded text-sm border border-gray-600 outline-none flex-1 sm:flex-none">
                {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i}>{getMonthName(i)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-400">{t('loading')}</div>
      ) : locations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('cal_empty')}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {locations.map(loc => (
            <div key={loc} className="bg-gray-900/50 rounded p-4 border border-gray-700 overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white">{loc}</h3>
              </div>
              
              {/* АДАПТИВНАЯ ОБЕРТКА КАЛЕНДАРЯ */}
              <div className="overflow-x-auto pb-2">
                  <div className="min-w-[500px]"> {/* Фиксируем минимальную ширину */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekdays.map(d => <div key={d} className="text-center text-[10px] text-gray-500 uppercase font-bold">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendar(loc)}
                    </div>
                  </div>
              </div>

            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-gray-400 border-t border-gray-700 pt-4">
        {selectedMetric === 'status' ? (
            <>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-900/40 border border-green-800 rounded"></div> {t('cal_valid')}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-900/40 border border-orange-800 rounded"></div> {t('cal_invalid')}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-900/10 border border-red-900/30 rounded"></div> {t('cal_missing')}</div>
            </>
        ) : (
            <>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-900/40 border border-blue-700 rounded"></div> {t('cal_metric_sales')} &gt; 0</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-700/50 border border-gray-600 rounded"></div> 0</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 border border-orange-500 rounded"></div> {t('cal_invalid')}</div>
            </>
        )}
      </div>
    </div>
  );
}

export default ReportsCalendar;