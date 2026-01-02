import React, { useState, useEffect } from 'react';
import API from '../api';
import { useLanguage } from '../contexts/LanguageContext';

function PayrollManagerV2() {
  const { t, getMonthName } = useLanguage();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isCreating, setIsCreating] = useState(false);

  // Динамические заведения вместо хардкода
  const [establishments, setEstablishments] = useState([]);

  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [reportEntries, setReportEntries] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [revenue, setRevenue] = useState('');

  useEffect(() => { 
      loadReports(); 
      loadEstablishments();
  }, []);

  const loadEstablishments = async () => {
      try {
          // Загружаем названия из API, но мапим их на ID, которые ожидает бэкенд
          const res = await API.get('/locations');
          // Бэкенд жестко привязан: 1=Yenibosna, 2=Göktürk. 
          // Создаем маппинг для корректной отправки ID
          const mapped = (res.data || []).map(name => ({
              id: name.toLowerCase().includes('yeni') ? 1 : 2,
              name: name
          }));
          
          // Если API вернул пустоту, используем дефолт, чтобы список не был пустым
          if (mapped.length === 0) {
              setEstablishments([
                  { id: 1, name: "Yenibosna" },
                  { id: 2, name: "Göktürk" }
              ]);
          } else {
              setEstablishments(mapped);
          }
      } catch (e) {
          console.error(e);
          // Fallback
          setEstablishments([
              { id: 1, name: "Yenibosna" },
              { id: 2, name: "Göktürk" }
          ]);
      }
  };

  // Безопасное получение названия месяца (защита от month_13)
  const getSafeMonthName = (monthIndex) => {
      if (!monthIndex || monthIndex < 1 || monthIndex > 12) {
          return t('month_1'); // Если пришел мусор (13), показываем Январь
      }
      return getMonthName(monthIndex);
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await API.get('/payroll/reports-v2');
      setReports(response.data || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const createPayrollReport = async () => {
    if (!selectedEstablishment) return alert(t('sched_msg_save_error'));
    setIsCreating(true);
    try {
      const response = await API.post('/payroll/generate-monthly', {
        establishment_id: parseInt(selectedEstablishment),
        year: selectedYear,
        month: selectedMonth
      });
      await loadReportDetails(response.data.report_id);
      setShowCreateForm(false);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const loadReportDetails = async (reportId) => {
    try {
      setLoading(true);
      const response = await API.get(`/payroll/reports-v2/${reportId}`);
      setCurrentReport(response.data.report);
      setReportEntries(response.data.entries || []);
      setRevenue(response.data.report.revenue || '');
      setEditMode(false);
      setHasChanges(false);
      await loadReports();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const updateEntry = (entryIndex, field, value) => {
    if (!editMode) return;
    const newEntries = [...reportEntries];
    
    // Типизация
    if (['monthly_tariff', 'motivation_percent', 'motivation_tl', 'hourly_rate_tl', 'advance_expenses', 'salary_expenses', 'sales_1_15', 'sales_16_31', 'actual_hours'].includes(field)) {
      value = value === '' ? 0 : parseFloat(value) || 0;
    } else if (['advance_paid', 'salary_paid'].includes(field)) {
      value = Boolean(value);
    }
    
    newEntries[entryIndex][field] = value;
    
    // Авторасчет продаж для кальянщиков
    if (field === 'sales_1_15' || field === 'sales_16_31') {
      const s1 = field === 'sales_1_15' ? value : (newEntries[entryIndex].sales_1_15 || 0);
      const s2 = field === 'sales_16_31' ? value : (newEntries[entryIndex].sales_16_31 || 0);
      newEntries[entryIndex].total_sales = s1 + s2;
    }
    setReportEntries(newEntries);
    setHasChanges(true);
  };

  const updateRevenue = (value) => {
    setRevenue(value);
    if (editMode) setHasChanges(true);
  };

  const handleDeleteEntry = async (entryId) => {
      if (!window.confirm(t('confirm_finish') + "?")) return;
      try {
          await API.delete(`/payroll/entries-v2/${entryId}`);
          setReportEntries(prev => prev.filter(e => e.id !== entryId));
      } catch (error) {
          alert("Error deleting: " + error.message);
      }
  };

  const saveChanges = async () => {
    if (!hasChanges || !currentReport) return;
    setSaving(true);
    try {
      if (revenue !== (currentReport.revenue || '')) {
        await API.put(`/payroll/reports/${currentReport.id}`, { revenue: parseFloat(revenue) || null });
      }
      for (const entry of reportEntries) {
        await API.put(`/payroll/entries-v2/${entry.id}`, {
          monthly_tariff: entry.monthly_tariff,
          motivation_percent: entry.motivation_percent,
          motivation_tl: entry.motivation_tl,
          hourly_rate_tl: entry.hourly_rate_tl,
          actual_hours: entry.actual_hours,
          sales_1_15: entry.sales_1_15,
          sales_16_31: entry.sales_16_31,
          advance_expenses: entry.advance_expenses,
          advance_paid: entry.advance_paid,
          salary_expenses: entry.salary_expenses,
          salary_paid: entry.salary_paid,
          salary_comment: entry.salary_comment
        });
      }
      setHasChanges(false);
      await loadReportDetails(currentReport.id);
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const finalizeReport = async () => {
    if (!window.confirm(t('btn_finalize') + '?')) return;
    try {
      await API.post(`/payroll/reports/${currentReport.id}/finalize`);
      await loadReportDetails(currentReport.id);
    } catch (error) {
      alert(error.message);
    }
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(val);
  };

  const groupedEntries = reportEntries.reduce((groups, entry) => {
    const isMaster = ['кальянщик', 'старший кальянщик'].includes(entry.user_role);
    const key = isMaster ? 'hookah_masters' : 'others';
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
    return groups;
  }, {});

  const renderEmployeeGroup = (entries, title) => (
    <div key={title} className="mb-8">
      <h4 className="text-lg font-semibold mb-4 text-blue-400">{title}</h4>
      <div className="card-surface overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 border-b border-gray-700">
              <tr>
                <th className="p-3 text-left">{t('pay_employee')}</th>
                <th className="p-3 text-center">{t('pay_tariff')}</th>
                <th className="p-3 text-center">{t('pay_motivation')} %</th>
                <th className="p-3 text-center">{t('pay_motivation')} TL</th>
                <th className="p-3 text-center">{t('pay_income')}</th>
                <th className="p-3 text-center">{t('pay_plan_hours')}</th>
                <th className="p-3 text-center">{t('pay_rate_hour')}</th>
                <th className="p-3 text-center">{t('pay_fact_hours')}</th>
                <th className="p-3 text-center text-orange-400">{t('pay_overtime_days')}</th>
                {title === t('pay_group_hookah') && (
                  <>
                    <th className="p-3 text-center">{t('pay_sales_1_15')}</th>
                    <th className="p-3 text-center">{t('pay_sales_16_31')}</th>
                    <th className="p-3 text-center">{t('pay_sales_total')}</th>
                  </>
                )}
                <th className="p-3 text-center font-bold text-white">{t('pay_total_pay')}</th>
                {editMode && <th className="p-3 text-center text-red-500">Action</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const planned = entry.planned_hours || 0;
                const actual = entry.actual_hours || 0;
                const missedDays = entry.missed_days_off || 0;
                let rowClass = "border-t border-gray-700 hover:bg-gray-700/50 transition-colors";
                
                if (planned > 0) {
                   const diff = Math.abs(actual - planned);
                   if ((diff / planned) > 0.05) {
                       rowClass += " bg-red-900/10 border-l-2 border-red-500";
                   }
                }

                return (
                <tr key={entry.id} className={rowClass}>
                  <td className="p-3">
                    <div className="font-medium text-white">{entry.user_name}</div>
                    <div className="text-xs text-gray-500">{entry.user_role}</div>
                  </td>
                  <td className="p-3 text-center">
                    {editMode && !['кальянщик', 'старший кальянщик'].includes(entry.user_role) ? (
                      <input type="number" value={entry.monthly_tariff} onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'monthly_tariff', e.target.value)} className="table-input h-8 text-center w-20 p-1" />
                    ) : formatCurrency(entry.monthly_tariff)}
                  </td>
                  <td className="p-3 text-center">
                    {editMode ? (
                      <input type="number" step="0.1" value={entry.motivation_percent} onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'motivation_percent', e.target.value)} className="table-input h-8 text-center w-16 p-1" />
                    ) : `${entry.motivation_percent}%`}
                  </td>
                  <td className="p-3 text-center text-gray-300">{formatCurrency(entry.motivation_tl)}</td>
                  <td className="p-3 text-center text-green-400 font-medium">{formatCurrency(entry.monthly_income)}</td>
                  <td className="p-3 text-center text-gray-400">{entry.planned_hours || 0}</td>
                  <td className="p-3 text-center">{entry.hourly_rate_tl}</td>
                  <td className="p-3 text-center font-mono">
                    {editMode ? (
                      <input type="number" step="0.1" value={entry.actual_hours} onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'actual_hours', e.target.value)} className="table-input h-8 text-center w-16 p-1" />
                    ) : (entry.actual_hours || 0).toFixed(1)}
                  </td>
                  <td className="p-3 text-center">
                      {missedDays > 0 ? (
                          <span className="bg-orange-900/40 text-orange-300 px-2 py-1 rounded text-xs font-bold">
                              +{missedDays} дн.
                          </span>
                      ) : <span className="text-gray-600">-</span>}
                  </td>
                  {title === t('pay_group_hookah') && (
                    <>
                      <td className="p-3 text-center">{editMode ? <input type="number" value={entry.sales_1_15} onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'sales_1_15', e.target.value)} className="table-input h-8 text-center w-16 p-1" /> : entry.sales_1_15}</td>
                      <td className="p-3 text-center">{editMode ? <input type="number" value={entry.sales_16_31} onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'sales_16_31', e.target.value)} className="table-input h-8 text-center w-16 p-1" /> : entry.sales_16_31}</td>
                      <td className="p-3 text-center font-bold text-blue-400">{entry.total_sales}</td>
                    </>
                  )}
                  <td className="p-3 text-center font-bold text-green-400">{formatCurrency(entry.monthly_total)}</td>
                  
                  {editMode && (
                      <td className="p-3 text-center">
                          <button 
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="text-red-500 hover:text-red-300 transition-colors p-1"
                              title={t('btn_delete')}
                          >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                      </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-gray-700">
             {/* Advance */}
             <div className="p-4 border-r border-gray-700 bg-yellow-900/5">
                 <h5 className="font-bold text-yellow-500 mb-3 text-xs uppercase tracking-wider">{t('pay_advance')}</h5>
                 <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left pb-2">{t('pay_employee')}</th><th className="text-center pb-2">{t('pay_expenses')}</th><th className="text-center pb-2">{t('pay_total_pay')}</th><th className="text-center pb-2">{t('pay_paid')}</th></tr></thead>
                    <tbody>
                        {entries.map(e => (
                            <tr key={'adv'+e.id} className="border-t border-gray-700/50">
                                <td className="py-2">{e.user_name}</td>
                                <td className="py-2 text-center">{editMode ? <input type="number" className="bg-gray-800 text-white w-16 text-center border border-gray-600 rounded p-1" value={e.advance_expenses} onChange={ev=>updateEntry(reportEntries.indexOf(e),'advance_expenses',ev.target.value)} /> : formatCurrency(e.advance_expenses)}</td>
                                <td className="py-2 text-center font-bold text-yellow-200">{formatCurrency(e.advance_total)}</td>
                                <td className="py-2 text-center">{editMode ? <input type="checkbox" checked={e.advance_paid} onChange={ev=>updateEntry(reportEntries.indexOf(e),'advance_paid',ev.target.checked)}/> : (e.advance_paid ? '✓' : '')}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
             {/* Salary */}
             <div className="p-4 bg-green-900/5">
                 <h5 className="font-bold text-green-500 mb-3 text-xs uppercase tracking-wider">{t('pay_salary')}</h5>
                 <table className="w-full text-xs">
                    <thead><tr className="text-gray-500"><th className="text-left pb-2">{t('pay_remainder')}</th><th className="text-center pb-2">{t('pay_expenses')}</th><th className="text-center pb-2">{t('pay_total_pay')}</th><th className="text-center pb-2">{t('pay_paid')}</th><th className="text-right pb-2">{t('pay_comment')}</th></tr></thead>
                    <tbody>
                        {entries.map(e => (
                            <tr key={'sal'+e.id} className="border-t border-gray-700/50">
                                <td className="py-2">{formatCurrency(e.salary_remainder)}</td>
                                <td className="py-2 text-center">{editMode ? <input type="number" className="bg-gray-800 text-white w-16 text-center border border-gray-600 rounded p-1" value={e.salary_expenses} onChange={ev=>updateEntry(reportEntries.indexOf(e),'salary_expenses',ev.target.value)} /> : formatCurrency(e.salary_expenses)}</td>
                                <td className="py-2 text-center font-bold text-green-200">{formatCurrency(e.salary_total)}</td>
                                <td className="py-2 text-center">{editMode ? <input type="checkbox" checked={e.salary_paid} onChange={ev=>updateEntry(reportEntries.indexOf(e),'salary_paid',ev.target.checked)}/> : (e.salary_paid ? '✓' : '')}</td>
                                <td className="py-2 text-right">{editMode ? <input type="text" className="bg-gray-800 text-white w-24 text-xs border border-gray-600 rounded p-1" value={e.salary_comment} onChange={ev=>updateEntry(reportEntries.indexOf(e),'salary_comment',ev.target.value)} /> : e.salary_comment}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">{t('pay_title')}</h1>
        <div className="flex gap-3">
            {!showCreateForm && <button onClick={() => setShowCreateForm(true)} className="btn-primary">{t('btn_calculate')}</button>}
            {currentReport && <button onClick={() => setCurrentReport(null)} className="h-11 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors">{t('btn_back')}</button>}
        </div>
      </div>

      {showCreateForm && (
        <div className="card-surface p-6">
            <h2 className="text-xl font-bold mb-6 text-white">{t('pay_create_report')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('sched_location')}</label>
                    <select value={selectedEstablishment} onChange={(e) => setSelectedEstablishment(e.target.value)} className="table-input">
                        <option value="">...</option>
                        {establishments.map(est => <option key={est.id} value={est.id}>{est.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('sched_year')}</label>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="table-input">
                        {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('sched_month')}</label>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="table-input">
                        {Array.from({length:12},(_,i)=>i).map(i => <option key={i+1} value={i+1}>{getSafeMonthName(i+1)}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <button onClick={() => setShowCreateForm(false)} className="h-11 px-6 rounded-lg text-gray-400 hover:text-white transition-colors">{t('btn_cancel')}</button>
                <button onClick={createPayrollReport} disabled={isCreating} className="btn-primary">{isCreating ? t('loading') : t('btn_save')}</button>
            </div>
        </div>
      )}

      {currentReport ? (
        <div>
             <div className="card-surface p-6 mb-6 flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                   <h2 className="text-2xl font-bold text-white mb-1">{t('pay_title')} #{currentReport.id}</h2>
                   {/* Отображаем название заведения динамически */}
                   <p className="text-gray-400">
                       {(establishments.find(e => e.id === currentReport.establishment_id) || {name: 'Unknown'}).name} • {getSafeMonthName(currentReport.month)} {currentReport.year}
                   </p>
                   <div className="mt-4 flex items-center gap-3">
                       <div className={`px-3 py-1 rounded text-xs uppercase font-bold tracking-wide ${currentReport.status==='finalized'?'bg-green-900/30 text-green-400':'bg-yellow-900/30 text-yellow-400'}`}>
                           {currentReport.status === 'finalized' ? t('status_finalized') : t('status_draft')}
                       </div>
                       {editMode ? (
                           <input type="number" value={revenue} onChange={e=>updateRevenue(e.target.value)} className="table-input h-10 w-40" placeholder={t('dash_revenue')} />
                       ) : (
                           <div className="text-xl font-bold text-white ml-4">{t('dash_revenue')}: {formatCurrency(currentReport.revenue)}</div>
                       )}
                   </div>
                </div>
                <div className="flex gap-3">
                    {currentReport.status !== 'finalized' && (
                        <>
                           <button onClick={() => setEditMode(!editMode)} className={`h-11 px-6 rounded-lg font-medium transition-colors ${editMode ? 'bg-gray-700 text-white' : 'btn-primary'}`}>
                               {editMode ? t('btn_cancel') : t('btn_edit')}
                           </button>
                           {editMode && hasChanges && (
                               <button onClick={saveChanges} disabled={saving} className="h-11 px-6 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium animate-pulse">
                                   {t('btn_save')}
                               </button>
                           )}
                           <button onClick={finalizeReport} className="h-11 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors">
                               {t('btn_finalize')}
                           </button>
                        </>
                    )}
                </div>
             </div>
             
             {groupedEntries.hookah_masters && renderEmployeeGroup(groupedEntries.hookah_masters, t('pay_group_hookah'))}
             {groupedEntries.others && renderEmployeeGroup(groupedEntries.others, t('pay_group_others'))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map(r => (
                <div key={r.id} onClick={() => loadReportDetails(r.id)} className="card-surface p-6 cursor-pointer hover:border-blue-500 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-2 h-2 rounded-full ${r.status === 'finalized' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="text-xs text-gray-500 font-mono">#{r.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">
                        {(establishments.find(e => e.id === r.establishment_id) || {name: 'Unknown'}).name}
                    </h3>
                    <p className="text-gray-400 mb-4">{getSafeMonthName(r.month)} {r.year}</p>
                    <div className="flex justify-between items-end border-t border-gray-700 pt-4">
                        <div>
                            <div className="text-xs text-gray-500 uppercase">{t('dash_revenue')}</div>
                            <div className="font-medium text-white">{formatCurrency(r.revenue)}</div>
                        </div>
                        <span className="text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">{t('btn_open')} &rarr;</span>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default PayrollManagerV2;