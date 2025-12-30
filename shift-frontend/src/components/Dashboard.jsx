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
  
  // Состояние для сворачивания/разворачивания отсутствующих
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

  // --- КАРТОЧКА СОТРУДНИКА ---
  const EmployeeCard = ({ item }) => {
    const { status, shift, name, role } = item;
    
    let containerClass = "border-gray-700/50 bg-gray-700/20";
    let nameColor = "text-gray-200";
    let statusText = null;

    if (status === 'missing') {
        containerClass = "border-red-900/40 bg-red-900/10"; 
        nameColor = "text-red-400"; 
        statusText = t('status_missing');
    } else if (status === 'working_extra') {
        containerClass = "border-orange-900/40 bg-orange-900/10";
        nameColor = "text-orange-300";
        statusText = t('status_extra');
    }

    const duration = shift ? calculateDuration(shift.start_time) : null;

    return (
        <div className={`flex items-center justify-between px-3 py-2 rounded border ${containerClass} mb-1 last:mb-0 transition-colors h-12`}>
            {/* Имя, Роль, Статус */}
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <span className={`font-bold text-sm truncate shrink-0 ${nameColor}`}>
                    {name}
                </span>
                <span className="text-[9px] text-gray-500 border border-gray-700 px-1 rounded uppercase tracking-wider shrink-0">
                    {role}
                </span>
                {statusText && (
                    <span className="text-[10px] text-red-400/60 italic truncate">
                        {statusText}
                    </span>
                )}
            </div>
            
            {/* Время и Кнопка */}
            <div className="flex items-center gap-3 shrink-0 ml-2">
                {shift ? (
                    <>
                        <div className="flex flex-col items-end justify-center min-w-[50px]">
                            <div className="text-xs font-mono text-gray-300 leading-none mb-0.5">
                                {new Date(shift.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            <div className={`text-[10px] leading-none ${duration.isLong ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                                {duration.text}
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleFinishShift(shift.id, name)}
                            disabled={processing === shift.id}
                            className="text-[10px] uppercase font-bold text-gray-500 border border-gray-600 hover:border-red-500/50 hover:text-red-400 hover:bg-gray-800 px-2 py-1.5 rounded transition-all disabled:opacity-30"
                        >
                            {processing === shift.id ? '...' : t('btn_stop')}
                        </button>
                    </>
                ) : (
                    <span className="text-[10px] font-bold text-gray-600 border border-gray-800 px-2 py-0.5 rounded">
                        OFF
                    </span>
                )}
            </div>
        </div>
    );
  };

  // --- КОМПОНЕНТ СПИСКА ЛОКАЦИИ ---
  const LocationList = ({ locationName, titleKey, colorClass, headerClass }) => {
    const items = staffStatus[locationName] || [];
    const activeItems = items.filter(i => i.status !== 'missing');
    const missingItems = items.filter(i => i.status === 'missing');
    const isExpanded = expandedSection[locationName];

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg flex flex-col max-h-[600px]">
            {/* Header */}
            <div className={`${headerClass} p-3 border-b flex justify-between items-center shrink-0 border-opacity-30`}>
                <div className="flex items-center gap-3">
                    <h3 className={`font-bold tracking-wide ${colorClass}`}>{t(titleKey)}</h3>
                    {missingItems.length > 0 && (
                        <span className="text-xs font-bold bg-red-600/90 text-white px-2 py-0.5 rounded animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)] cursor-pointer" 
                              onClick={() => toggleExpand(locationName)}
                              title={t('show_missing').replace('{count}', missingItems.length)}>
                            -{missingItems.length}
                        </span>
                    )}
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded-full border border-opacity-40 bg-opacity-30 ${colorClass.replace('text-', 'bg-').replace('400', '900')} text-gray-200 border-gray-600`}>
                    {activeItems.length} {t('online_suffix')}
                </span>
            </div>

            {/* Active Items */}
            <div className="p-2 overflow-y-auto">
                {activeItems.length === 0 && missingItems.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">{t('dash_no_active')}</p>
                ) : (
                    activeItems.map(item => <EmployeeCard key={item.user_id} item={item} />)
                )}

                {/* Missing Items Section (Spoiler) */}
                {missingItems.length > 0 && (
                    <div className="mt-2 border-t border-gray-700 pt-2">
                        <button 
                            onClick={() => toggleExpand(locationName)}
                            className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1 mb-2 flex items-center justify-center gap-1 transition-colors"
                        >
                            {isExpanded ? (
                                <span>▲ {t('hide_missing')}</span>
                            ) : (
                                <span>▼ {t('show_missing').replace('{count}', missingItems.length)}</span>
                            )}
                        </button>
                        
                        {isExpanded && (
                            <div className="space-y-1 animate-fadeIn">
                                {missingItems.map(item => <EmployeeCard key={item.user_id} item={item} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
  };

  if (loading) return <div className="p-8 text-white">{t('loading')}</div>;

  return (
    <div className="p-3 md:p-6 text-white max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold px-1">{t('dash_title')}</h1>
      
      {/* 1. БЛОК: Статус сотрудников */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LocationList 
            locationName="Yenibosna" 
            titleKey="dash_loc_yenibosna" 
            colorClass="text-green-400" 
            headerClass="bg-green-900/20 border-green-800"
        />
        <LocationList 
            locationName="Göktürk" 
            titleKey="dash_loc_gokturk" 
            colorClass="text-blue-400" 
            headerClass="bg-blue-900/20 border-blue-800"
        />
      </div>

      {/* 2. БЛОК: KPI */}
      {salesStats.totals && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-xs font-bold uppercase">{t('dash_loc_yenibosna')}</div>
              <div className="text-2xl font-bold text-white mt-1">{salesStats.totals.current.Yenibosna} <span className="text-sm font-normal text-gray-500">шт</span></div>
            </div>
            <div className={`text-right ${salesStats.totals.current.Yenibosna >= salesStats.totals.prev.Yenibosna ? 'text-green-500' : 'text-red-500'}`}>
              <div className="text-lg font-bold">{getPercentageChange(salesStats.totals.current.Yenibosna, salesStats.totals.prev.Yenibosna)}</div>
              <div className="text-xs text-gray-500">{t('dash_vs_prev')}</div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-xs font-bold uppercase">{t('dash_loc_gokturk')}</div>
              <div className="text-2xl font-bold text-white mt-1">{salesStats.totals.current.Göktürk} <span className="text-sm font-normal text-gray-500">шт</span></div>
            </div>
            <div className={`text-right ${salesStats.totals.current.Göktürk >= salesStats.totals.prev.Göktürk ? 'text-green-500' : 'text-red-500'}`}>
              <div className="text-lg font-bold">{getPercentageChange(salesStats.totals.current.Göktürk, salesStats.totals.prev.Göktürk)}</div>
              <div className="text-xs text-gray-500">{t('dash_vs_prev')}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. БЛОК: График */}
      <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h2 className="text-lg font-bold text-gray-300">{t('dash_sales_chart_title')}</h2>
            
            <div className="flex gap-2 w-full sm:w-auto">
                <select 
                    value={chartDate.year} 
                    onChange={e => setChartDate({...chartDate, year: +e.target.value})} 
                    className="bg-gray-700 border border-gray-600 rounded text-xs p-2 text-white outline-none flex-1 sm:flex-none"
                >
                    {[2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select 
                    value={chartDate.month} 
                    onChange={e => setChartDate({...chartDate, month: +e.target.value})} 
                    className="bg-gray-700 border border-gray-600 rounded text-xs p-2 text-white outline-none flex-1 sm:flex-none"
                >
                    {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i+1}>{t(`month_${i+1}`)}</option>)}
                </select>
            </div>
        </div>
        
        <div className="h-64 md:h-80 w-full">
          <SalesLineChart data={salesStats.chart} />
        </div>
      </div>

      <ReportsCalendar />
      
    </div>
  );
};

export default Dashboard;