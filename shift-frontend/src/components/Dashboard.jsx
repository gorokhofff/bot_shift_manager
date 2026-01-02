import { useEffect, useState } from 'react';
import API from '../api';
import SalesLineChart from './Charts/SalesLineChart';
import ReportsCalendar from './ReportsCalendar';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard = () => {
  const [staffStatus, setStaffStatus] = useState({ Yenibosna: [], Göktürk: [], Unknown: [] });
  const [salesStats, setSalesStats] = useState({ totals: null, chart: [] });
  const [loading, setLoading] = useState(true);
  const [chartDate, setChartDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [processing, setProcessing] = useState(null);
  
  const [expandedSection, setExpandedSection] = useState({ Yenibosna: false, Göktürk: false });
  
  const { t } = useLanguage();

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
        setStaffStatus(prev => ({...prev})); 
    }, 60000);
    return () => clearInterval(interval);
  }, [chartDate]);

  const fetchData = async () => {
    try {
      const [statusRes, salesRes] = await Promise.all([
        API.get('/dashboard/daily-status'),
        API.get(`/dashboard/sales-stats?year=${chartDate.year}&month=${chartDate.month}`)
      ]);
      setStaffStatus(statusRes.data);
      setSalesStats(salesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishShift = async (shiftId, userName) => {
    const confirmMsg = t('confirm_finish').replace('{name}', userName);
    if (!window.confirm(confirmMsg)) return;
    
    setProcessing(shiftId);
    try {
        await API.post(`/shifts/${shiftId}/finish`);
        await fetchData();
    } catch (error) {
        alert("Error: " + (error.response?.data?.detail || error.message));
    } finally {
        setProcessing(null);
    }
  };

  const toggleExpand = (location) => {
    setExpandedSection(prev => ({ ...prev, [location]: !prev[location] }));
  };

  const calculateDuration = (startTime) => {
    if (!startTime) return { text: "", isLong: false };
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

  // --- UI COMPONENTS ---

  // Карточка сотрудника переработана для Touch Targets (мин 48px высота)
  const EmployeeCard = ({ item }) => {
    const { status, shift, name, role } = item;
    
    // Используем более мягкие цвета для поверхностей вместо ярких рамок
    let bgClass = "bg-gray-700/30 hover:bg-gray-700/50";
    let nameColor = "text-gray-100";
    let statusIndicator = null;

    if (status === 'missing') {
        bgClass = "bg-red-900/10 hover:bg-red-900/20 border-l-2 border-red-500"; 
        nameColor = "text-red-200"; 
        statusIndicator = <span className="text-xs text-red-400 font-medium ml-2">{t('status_missing')}</span>;
    } else if (status === 'working_extra') {
        bgClass = "bg-orange-900/10 hover:bg-orange-900/20 border-l-2 border-orange-500";
        nameColor = "text-orange-200";
        statusIndicator = <span className="text-xs text-orange-400 font-medium ml-2">{t('status_extra')}</span>;
    }

    const duration = shift ? calculateDuration(shift.start_time) : null;

    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-2 transition-all min-h-[56px] ${bgClass}`}>
            {/* Информация о сотруднике */}
            <div className="flex flex-col justify-center mr-3 min-w-0">
                <div className="flex items-center">
                    <span className={`text-base font-medium truncate ${nameColor}`}>
                        {name}
                    </span>
                    {statusIndicator}
                </div>
                <div className="flex items-center mt-0.5">
                     <span className="text-xs text-gray-400 uppercase tracking-wide">
                        {role}
                    </span>
                </div>
            </div>
            
            {/* Время и Действия */}
            <div className="flex items-center gap-4 shrink-0">
                {shift ? (
                    <>
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-sm font-mono text-gray-300">
                                {new Date(shift.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            <span className={`text-xs ${duration.isLong ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                                {duration.text}
                            </span>
                        </div>
                        
                        {/* Кнопка STOP - увеличена область нажатия */}
                        <button 
                            onClick={() => handleFinishShift(shift.id, name)}
                            disabled={processing === shift.id}
                            className="h-10 px-4 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 font-medium text-sm hover:bg-red-900/30 hover:text-red-200 hover:border-red-800 transition-all focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                            aria-label={t('btn_stop')}
                        >
                            {processing === shift.id ? '...' : t('btn_stop')}
                        </button>
                    </>
                ) : (
                    <span className="h-8 px-3 flex items-center justify-center rounded-md bg-gray-800 text-gray-500 text-xs font-bold border border-gray-700">
                        OFF
                    </span>
                )}
            </div>
        </div>
    );
  };

  const LocationList = ({ locationName, titleKey, headerColor, accentColor }) => {
    const items = staffStatus[locationName] || [];
    const activeItems = items.filter(i => i.status !== 'missing');
    const missingItems = items.filter(i => i.status === 'missing');
    const isExpanded = expandedSection[locationName];

    return (
        <div className="card-surface flex flex-col h-full overflow-hidden">
            {/* Заголовок карточки - Высота 64px для стандартов */}
            <div className={`h-16 px-6 flex justify-between items-center border-b border-gray-700/50 ${headerColor}`}>
                <div className="flex items-center gap-3">
                    <h3 className={`text-lg font-semibold tracking-tight ${accentColor}`}>{t(titleKey)}</h3>
                    {missingItems.length > 0 && (
                        <button 
                              className="h-8 px-3 rounded-full bg-red-500/20 text-red-200 text-sm font-bold flex items-center justify-center hover:bg-red-500/30 transition-colors" 
                              onClick={() => toggleExpand(locationName)}
                              title={t('show_missing')}>
                            {missingItems.length} Missing
                        </button>
                    )}
                </div>
                <span className="text-sm text-gray-400 font-medium">
                    {activeItems.length} {t('online_suffix')}
                </span>
            </div>

            <div className="p-4 overflow-y-auto max-h-[500px]">
                {activeItems.length === 0 && missingItems.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        {t('dash_no_active')}
                    </div>
                ) : (
                    activeItems.map(item => <EmployeeCard key={item.user_id} item={item} />)
                )}

                {/* Секция отсутствующих */}
                {missingItems.length > 0 && (
                    <div className="mt-4 pt-2 border-t border-gray-700/50">
                        <button 
                            onClick={() => toggleExpand(locationName)}
                            className="w-full h-12 flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:bg-gray-700/30 rounded-lg transition-colors text-sm font-medium"
                        >
                            {isExpanded ? '▲ ' + t('hide_missing') : '▼ ' + t('show_missing').replace('{count}', missingItems.length)}
                        </button>
                        
                        {isExpanded && (
                            <div className="mt-2 space-y-1 animate-fadeIn">
                                {missingItems.map(item => <EmployeeCard key={item.user_id} item={item} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const KPIWidget = ({ title, value, prevValue, trendUpGood = true }) => {
    const percentage = getPercentageChange(value, prevValue);
    const isPositive = parseFloat(percentage) >= 0;
    // Определяем цвет: если рост это хорошо (trendUpGood), то зеленый, иначе красный.
    const isGood = trendUpGood ? isPositive : !isPositive; 
    
    const trendColor = isGood ? 'text-green-400' : 'text-red-400';
    const bgTrend = isGood ? 'bg-green-400/10' : 'bg-red-400/10';

    return (
        <div className="card-surface p-6 flex flex-col justify-between h-full relative overflow-hidden">
            <div className="z-10">
                <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h4 className="text-4xl font-light text-white">{value}</h4>
                    <span className="text-lg text-gray-500">шт</span>
                </div>
            </div>
            
            <div className={`mt-4 self-start px-3 py-1.5 rounded-lg flex items-center gap-2 ${bgTrend} ${trendColor}`}>
                <span className="text-sm font-bold">{percentage}</span>
                <span className="text-xs opacity-80 uppercase">{t('dash_vs_prev')}</span>
            </div>
        </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-400 font-light animate-pulse">{t('loading')}...</div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Заголовок страницы */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('dash_title')}</h1>
          {/* Можно добавить глобальные действия здесь */}
      </div>
      
      {/* 1. БЛОК: Статус сотрудников (12-col Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
            <LocationList 
                locationName="Yenibosna" 
                titleKey="dash_loc_yenibosna" 
                accentColor="text-green-400"
                headerColor="bg-green-900/10"
            />
        </div>
        <div className="lg:col-span-6">
            <LocationList 
                locationName="Göktürk" 
                titleKey="dash_loc_gokturk" 
                accentColor="text-blue-400"
                headerColor="bg-blue-900/10"
            />
        </div>
      </div>

      {/* 2. БЛОК: KPI (12-col Grid) */}
      {salesStats.totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
             <KPIWidget 
                title={t('dash_loc_yenibosna')}
                value={salesStats.totals.current.Yenibosna}
                prevValue={salesStats.totals.prev.Yenibosna}
             />
          </div>
          <div className="lg:col-span-6">
             <KPIWidget 
                title={t('dash_loc_gokturk')}
                value={salesStats.totals.current.Göktürk}
                prevValue={salesStats.totals.prev.Göktürk}
             />
          </div>
        </div>
      )}

      {/* 3. БЛОК: График */}
      <div className="card-surface p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h2 className="text-xl font-semibold text-white">{t('dash_sales_chart_title')}</h2>
            
            {/* Контролы графика - Touch Targets 48px */}
            <div className="flex gap-4 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                    <select 
                        value={chartDate.year} 
                        onChange={e => setChartDate({...chartDate, year: +e.target.value})} 
                        className="appearance-none w-full h-12 pl-4 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {/* Кастомная стрелка для селекта */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                        <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>

                <div className="relative flex-1 sm:flex-none">
                    <select 
                        value={chartDate.month} 
                        onChange={e => setChartDate({...chartDate, month: +e.target.value})} 
                        className="appearance-none w-full h-12 pl-4 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                    >
                        {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i+1}>{t(`month_${i+1}`)}</option>)}
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                        <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Контейнер графика с фиксированной минимальной высотой 300px */}
        <div className="h-[350px] w-full">
          <SalesLineChart data={salesStats.chart} />
        </div>
      </div>

      <div className="pt-4">
        <ReportsCalendar />
      </div>
      
    </div>
  );
};

export default Dashboard;