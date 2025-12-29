import { useEffect, useState } from 'react';
import API from '../api';
import SalesLineChart from './Charts/SalesLineChart';
import ReportsCalendar from './ReportsCalendar';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard = () => {
  const [activeShifts, setActiveShifts] = useState({ Yenibosna: [], Göktürk: [], Unknown: [] });
  const [salesStats, setSalesStats] = useState({ totals: null, chart: [] });
  const [loading, setLoading] = useState(true);
  // Добавляем состояние для даты графика
  const [chartDate, setChartDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const { t } = useLanguage();

  useEffect(() => {
    fetchData();
    // Обновляем таймер смен каждую минуту
    const interval = setInterval(() => {
        // Force re-render for time calculation if needed
        setActiveShifts(prev => ({...prev})); 
    }, 60000);
    return () => clearInterval(interval);
  }, [chartDate]); // Зависимость от даты графика

  const fetchData = async () => {
    try {
      const [shiftsRes, salesRes] = await Promise.all([
        API.get('/shifts'),
        API.get(`/dashboard/sales-stats?year=${chartDate.year}&month=${chartDate.month}`)
      ]);
      
      // 1. Обработка активных смен
      const active = shiftsRes.data.filter(s => !s.end_time);
      const grouped = { Yenibosna: [], Göktürk: [], Unknown: [] };
      
      active.forEach(shift => {
        const loc = shift.location === 'Yenibosna' || shift.location === 'Göktürk' ? shift.location : 'Unknown';
        grouped[loc].push(shift);
      });
      
      setActiveShifts(grouped);
      setSalesStats(salesRes.data);
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { text: `${hours}ч ${minutes}м`, isLong: hours >= 14 };
  };

  const getPercentageChange = (current, prev) => {
    if (!prev || prev === 0) return current > 0 ? "+100%" : "0%";
    const diff = current - prev;
    const percent = (diff / prev) * 100;
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent.toFixed(1)}%`;
  };

  if (loading) return <div className="p-8 text-white">{t('loading')}</div>;

  return (
    <div className="p-4 md:p-6 text-white max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">{t('dash_title')}</h1>
      
      {/* 1. БЛОК: Кто сейчас работает (Active Shifts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* YENIBOSNA CARD */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
          <div className="bg-green-900/30 p-3 border-b border-green-800 flex justify-between items-center">
             <h3 className="font-bold text-green-400">{t('dash_loc_yenibosna')}</h3>
             <span className="text-xs bg-green-900 text-green-200 px-2 py-1 rounded-full animate-pulse">
               {activeShifts.Yenibosna.length} online
             </span>
          </div>
          <div className="p-4 space-y-3">
            {activeShifts.Yenibosna.length === 0 ? (
               <p className="text-gray-500 text-sm text-center py-4">{t('dash_no_active')}</p>
            ) : (
               activeShifts.Yenibosna.map(s => {
                 const duration = calculateDuration(s.start_time);
                 return (
                   <div key={s.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded border border-gray-600">
                     <div>
                       {/* ИЗМЕНЕНИЕ ЗДЕСЬ: Имя и роль в одной строке */}
                       <div className="font-bold text-sm">
                         {s.user_name} <span className="text-gray-400 font-normal ml-1 text-xs">({s.role})</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-sm font-mono">{new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                       <div className={`text-xs ${duration.isLong ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                         {duration.text}
                       </div>
                     </div>
                   </div>
                 );
               })
            )}
          </div>
        </div>

        {/* GÖKTÜRK CARD */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg">
          <div className="bg-blue-900/30 p-3 border-b border-blue-800 flex justify-between items-center">
             <h3 className="font-bold text-blue-400">{t('dash_loc_gokturk')}</h3>
             <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded-full animate-pulse">
               {activeShifts.Göktürk.length} online
             </span>
          </div>
          <div className="p-4 space-y-3">
             {activeShifts.Göktürk.length === 0 ? (
               <p className="text-gray-500 text-sm text-center py-4">{t('dash_no_active')}</p>
            ) : (
               activeShifts.Göktürk.map(s => {
                 const duration = calculateDuration(s.start_time);
                 return (
                   <div key={s.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded border border-gray-600">
                     <div>
                       {/* ИЗМЕНЕНИЕ ЗДЕСЬ: Имя и роль в одной строке */}
                       <div className="font-bold text-sm">
                         {s.user_name} <span className="text-gray-400 font-normal ml-1 text-xs">({s.role})</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-sm font-mono">{new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                       <div className={`text-xs ${duration.isLong ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                         {duration.text}
                       </div>
                     </div>
                   </div>
                 );
               })
            )}
          </div>
        </div>
      </div>

      {/* 2. БЛОК: Статистика продаж (KPI) */}
      {salesStats.totals && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-sm font-bold uppercase">{t('dash_loc_yenibosna')}</div>
              <div className="text-3xl font-bold text-white mt-1">{salesStats.totals.current.Yenibosna} <span className="text-sm font-normal text-gray-500">шт</span></div>
            </div>
            <div className={`text-right ${salesStats.totals.current.Yenibosna >= salesStats.totals.prev.Yenibosna ? 'text-green-400' : 'text-red-400'}`}>
              <div className="text-xl font-bold">{getPercentageChange(salesStats.totals.current.Yenibosna, salesStats.totals.prev.Yenibosna)}</div>
              <div className="text-xs text-gray-500">{t('dash_vs_prev')}</div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-gray-400 text-sm font-bold uppercase">{t('dash_loc_gokturk')}</div>
              <div className="text-3xl font-bold text-white mt-1">{salesStats.totals.current.Göktürk} <span className="text-sm font-normal text-gray-500">шт</span></div>
            </div>
            <div className={`text-right ${salesStats.totals.current.Göktürk >= salesStats.totals.prev.Göktürk ? 'text-green-400' : 'text-red-400'}`}>
              <div className="text-xl font-bold">{getPercentageChange(salesStats.totals.current.Göktürk, salesStats.totals.prev.Göktürk)}</div>
              <div className="text-xs text-gray-500">{t('dash_vs_prev')}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. БЛОК: График продаж */}
      <div className="bg-gray-800 p-4 md:p-6 rounded-lg border border-gray-700">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-bold">{t('dash_sales_chart_title')}</h2>
            
            {/* Селекторы для графика */}
            <div className="flex gap-2 w-full sm:w-auto">
                <select 
                    value={chartDate.year} 
                    onChange={e => setChartDate({...chartDate, year: +e.target.value})} 
                    className="bg-gray-700 border border-gray-600 rounded text-sm p-2 text-white outline-none flex-1 sm:flex-none"
                >
                    {[2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select 
                    value={chartDate.month} 
                    onChange={e => setChartDate({...chartDate, month: +e.target.value})} 
                    className="bg-gray-700 border border-gray-600 rounded text-sm p-2 text-white outline-none flex-1 sm:flex-none"
                >
                    {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i+1}>{t(`month_${i+1}`)}</option>)}
                </select>
            </div>
        </div>
        
        <div className="h-64 md:h-80 w-full">
          <SalesLineChart data={salesStats.chart} />
        </div>
      </div>

      {/* 4. БЛОК: Календарь */}
      <ReportsCalendar />
      
    </div>
  );
};

export default Dashboard;