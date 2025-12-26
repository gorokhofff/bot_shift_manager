import React, { useState, useEffect } from 'react';
import API from '../api';

const ESTABLISHMENTS = [
  { id: 1, name: "Yenibosna", location: "yenibosna" },
  { id: 2, name: "Göktürk", location: "göktürk" }
];

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

function PayrollManagerV2() {
  // Состояния для создания отчета
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isCreating, setIsCreating] = useState(false);

  // Состояния для отчетов
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [reportEntries, setReportEntries] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Состояния для редактирования
  const [revenue, setRevenue] = useState('');

  useEffect(() => {
    loadReports();
  }, []);
  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await API.get('/payroll/reports-v2');
      setReports(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки отчетов ФОТ:', error);
      alert('Ошибка загрузки отчетов ФОТ');
    } finally {
      setLoading(false);
    }
  };

  const createPayrollReport = async () => {
    if (!selectedEstablishment) {
      alert('Выберите заведение');
      return;
    }

    setIsCreating(true);
    try {
      console.log('🔄 Создаем месячный отчет ФОТ:', {
        establishment_id: selectedEstablishment,
        year: selectedYear,
        month: selectedMonth
      });

      const response = await API.post('/payroll/generate-monthly', {
        establishment_id: parseInt(selectedEstablishment),
        year: selectedYear,
        month: selectedMonth
      });

      console.log('✅ Отчет создан:', response.data);
      
      // Загружаем созданный отчет
      await loadReportDetails(response.data.report_id);
      setShowCreateForm(false);
      
      alert(`✅ Черновик создан! Найдено ${response.data.employees_count} сотрудников, ${response.data.total_sales || 0} продаж`);
      
    } catch (error) {
      console.error('❌ Ошибка создания отчета:', error);
      alert(`❌ Ошибка создания отчета: ${error.response?.data?.detail || error.message}`);
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
      
      await loadReports(); // Обновляем список отчетов
      
    } catch (error) {
      console.error('Ошибка загрузки деталей отчета:', error);
      alert('Ошибка загрузки деталей отчета');
    } finally {
      setLoading(false);
    }
  };
  const updateEntry = (entryIndex, field, value) => {
    if (!editMode) return;

    const newEntries = [...reportEntries];
    const oldValue = newEntries[entryIndex][field];
    
    // Преобразуем значение в правильный тип
    if (['monthly_tariff', 'motivation_percent', 'motivation_tl', 'hourly_rate_tl', 'advance_expenses', 'salary_expenses', 'sales_1_15', 'sales_16_31', 'actual_hours'].includes(field)) {
      value = value === '' ? 0 : parseFloat(value) || 0;
    } else if (['advance_paid', 'salary_paid'].includes(field)) {
      value = Boolean(value);
    }
    
    newEntries[entryIndex][field] = value;
    
    // Автоматически пересчитываем total_sales для кальянщиков
    if (field === 'sales_1_15' || field === 'sales_16_31') {
      const sales_1_15 = field === 'sales_1_15' ? value : (newEntries[entryIndex].sales_1_15 || 0);
      const sales_16_31 = field === 'sales_16_31' ? value : (newEntries[entryIndex].sales_16_31 || 0);
      newEntries[entryIndex].total_sales = sales_1_15 + sales_16_31;
    }
    
    setReportEntries(newEntries);
    
    if (oldValue !== value) {
      setHasChanges(true);
    }
  };

  const updateRevenue = (value) => {
    setRevenue(value);
    if (editMode) {
      setHasChanges(true);
    }
  };

  const saveChanges = async () => {
    if (!hasChanges || !currentReport) {
      alert('Нет изменений для сохранения');
      return;
    }

    setSaving(true);
    try {
      // Сохраняем выручку в основном отчете
      if (revenue !== (currentReport.revenue || '')) {
        await API.put(`/payroll/reports/${currentReport.id}`, {
          revenue: parseFloat(revenue) || null
        });
      }

      // Сохраняем изменения в записях сотрудников
      for (const entry of reportEntries) {
        await API.put(`/payroll/entries-v2/${entry.id}`, {
          monthly_tariff: entry.monthly_tariff,
          motivation_percent: entry.motivation_percent,
          motivation_tl: entry.motivation_tl,
          hourly_rate_tl: entry.hourly_rate_tl,
          actual_hours: entry.actual_hours, // ДОБАВИТЬ ЭТУ СТРОКУ
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
      alert('✅ Изменения сохранены!');

      // Перезагружаем отчет
      await loadReportDetails(currentReport.id);

    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
      alert(`❌ Ошибка сохранения: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSaving(false);
    }
  };
  const toggleEditMode = () => {
    if (editMode && hasChanges) {
      const confirm = window.confirm('У вас есть несохраненные изменения. Выйти из режима редактирования?');
      if (!confirm) return;
    }

    setEditMode(!editMode);
    if (editMode) {
      // При выходе из режима редактирования - перезагружаем данные
      if (currentReport) {
        loadReportDetails(currentReport.id);
      }
    }
  };

  const finalizeReport = async () => {
    if (!currentReport || currentReport.status === 'finalized') return;

    const confirm = window.confirm('Финализировать отчет? После этого его нельзя будет изменить.');
    if (!confirm) return;

    try {
      await API.post(`/payroll/reports/${currentReport.id}/finalize`);
      alert('✅ Отчет финализирован!');
      await loadReportDetails(currentReport.id);
    } catch (error) {
      console.error('❌ Ошибка финализации:', error);
      alert(`❌ Ошибка финализации: ${error.response?.data?.detail || error.message}`);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const getMonthName = (month) => {
    return MONTHS[month - 1] || month;
  };

  // ИСПРАВЛЕННАЯ функция группировки сотрудников
  const groupedEntries = reportEntries.reduce((groups, entry) => {
    const isHookahMaster = ['кальянщик', 'старший кальянщик'].includes(entry.user_role);
    const groupKey = isHookahMaster ? 'hookah_masters' : 'others';
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(entry);
    
    return groups;
  }, {});

  // Сортируем группы
  if (groupedEntries.others) {
    groupedEntries.others.sort((a, b) => (a.user_role || '').localeCompare(b.user_role || ''));
  }

// Функция для получения плана часов/продаж
const getPlannedHours = (userRole, establishmentId) => {
  if (['кальянщик', 'старший кальянщик'].includes(userRole)) {
    // Для кальянщиков план = план продаж
    return establishmentId === 2 ? 2500 : 4000; // Göktürk=2500, Yenibosna=4000
  }
  return 260; // Для остальных 260 часов
};

  // ИСПРАВЛЕННАЯ функция статистики
const getTotalStats = () => {
  if (!reportEntries.length) return {
    totalMonthlyTotal: 0,
    totalAdvanceTotal: 0,
    totalSalaryTotal: 0,
    totalSales: 0,
    totalSales_1_15: 0,
    totalSales_16_31: 0
  };
  
  // Считаем только финансовые показатели
  const stats = reportEntries.reduce((acc, entry) => ({
    totalMonthlyTotal: acc.totalMonthlyTotal + (entry.monthly_total || 0),
    totalAdvanceTotal: acc.totalAdvanceTotal + (entry.advance_total || 0),
    totalSalaryTotal: acc.totalSalaryTotal + (entry.salary_total || 0)
  }), { 
    totalMonthlyTotal: 0, 
    totalAdvanceTotal: 0, 
    totalSalaryTotal: 0
  });

  // Продажи берем ТОЛЬКО из первого кальянщика (они одинаковые для всех)
  const hookahMaster = reportEntries.find(entry => 
    ['кальянщик', 'старший кальянщик'].includes(entry.user_role)
  );

  if (hookahMaster) {
    stats.totalSales = hookahMaster.total_sales || 0;
    stats.totalSales_1_15 = hookahMaster.sales_1_15 || 0;
    stats.totalSales_16_31 = hookahMaster.sales_16_31 || 0;
  } else {
    stats.totalSales = 0;
    stats.totalSales_1_15 = 0;
    stats.totalSales_16_31 = 0;
  }

  return stats;
};

  const stats = getTotalStats();
  const renderEmployeeGroup = (entries, title) => (
    <div key={title} className="mb-8">
      <h4 className="text-lg font-semibold mb-4 text-blue-400">{title}</h4>
      
      <div className="bg-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-600">
              <tr>
                <th className="p-2 text-left">Сотрудник</th>
                <th className="p-2 text-center">Тариф/мес</th>
                <th className="p-2 text-center">Мотивация %</th>
                <th className="p-2 text-center">Мотивация TL</th>
                <th className="p-2 text-center">Доход/мес</th>
                <th className="p-2 text-center">План ч.</th>
                <th className="p-2 text-center">Ставка/ч TL</th>
                <th className="p-2 text-center">Факт ч.</th>
                
                {/* Дополнительные колонки для кальянщиков */}
                {title.includes('Кальянщики') && (
                  <>
                    <th className="p-2 text-center">Продажи 1-15</th>
                    <th className="p-2 text-center">Продажи 16-31</th>
                    <th className="p-2 text-center">Всего продаж</th>
                  </>
                )}
                
                <th className="p-2 text-center font-bold">К выплате/мес</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.id} className="border-t border-gray-600 hover:bg-gray-650">
                  <td className="p-2">
                    <div>
                      <p className="font-medium">{entry.user_name}</p>
                      <p className="text-xs text-gray-400">{entry.user_role}</p>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    {['кальянщик', 'старший кальянщик'].includes(entry.user_role) ? (
                      <span className="text-blue-400 font-medium">по продажам</span>
                    ) : editMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={entry.monthly_tariff || ''}
                        onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'monthly_tariff', e.target.value)}
                        className="w-20 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                      />
                    ) : (
                      formatCurrency(entry.monthly_tariff)
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        step="0.1"
                        value={entry.motivation_percent || ''}
                        onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'motivation_percent', e.target.value)}
                        className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                      />
                    ) : (
                      `${entry.motivation_percent || 0}%`
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={entry.motivation_tl || ''}
                        onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'motivation_tl', e.target.value)}
                        className="w-20 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                      />
                    ) : (
                      formatCurrency(entry.motivation_tl)
                    )}
                  </td>
                  <td className="p-2 text-center font-medium text-green-400">
                    {formatCurrency(entry.monthly_income)}
                  </td>
                  <td className="p-2 text-center">
                    {getPlannedHours(entry.user_role, currentReport?.establishment_id)}
                  </td>
                  <td className="p-2 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={entry.hourly_rate_tl || ''}
                        onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'hourly_rate_tl', e.target.value)}
                        className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                      />
                    ) : (
                      `${entry.hourly_rate_tl || 0} TL`
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        step="0.1"
                        value={entry.actual_hours || ''}
                        onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'actual_hours', e.target.value)}
                        className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                      />
                    ) : (
                      entry.actual_hours || 0
                    )}
                  </td>
                  
                  {/* Дополнительные ячейки для кальянщиков */}
                  {title.includes('Кальянщики') && (
                    <>
                      <td className="p-2 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={entry.sales_1_15 || ''}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'sales_1_15', e.target.value)}
                            className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-blue-400 font-medium">{entry.sales_1_15 || 0}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            value={entry.sales_16_31 || ''}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'sales_16_31', e.target.value)}
                            className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-blue-400 font-medium">{entry.sales_16_31 || 0}</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <span className="text-blue-600 font-bold">{entry.total_sales || 0}</span>
                      </td>
                    </>
                  )}
                  
                  <td className="p-2 text-center font-bold text-xl text-green-400">
                    {formatCurrency(entry.monthly_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Секции Аванс и Зарплата */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-gray-750">
          {/* Аванс 1-15 */}
          <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-3">
            <h5 className="font-semibold mb-3 text-yellow-300">1-15 Аванс</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-1">Сотрудник</th>
                    <th className="text-center p-1">Сумма</th>
                    <th className="text-center p-1">Расходы</th>
                    <th className="text-center p-1">К выплате</th>
                    <th className="text-center p-1">Выплачено</th>
                    <th className="text-center p-1">Продажи 1-15</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={`advance-${entry.id}`} className="border-t border-yellow-600">
                      <td className="p-1 text-xs">{entry.user_name}</td>
                      <td className="p-1 text-center text-xs">{formatCurrency(entry.advance_amount)}</td>
                      <td className="p-1 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            step="0.01"
                            value={entry.advance_expenses || ''}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'advance_expenses', e.target.value)}
                            className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-red-400 text-xs">{formatCurrency(entry.advance_expenses)}</span>
                        )}
                      </td>
                      <td className="p-1 text-center font-bold text-yellow-300 text-xs">
                        {formatCurrency(entry.advance_total)}
                      </td>
                      <td className="p-1 text-center">
                        {editMode ? (
                          <input
                            type="checkbox"
                            checked={entry.advance_paid || false}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'advance_paid', e.target.checked)}
                            className="w-4 h-4"
                          />
                        ) : (
                          <span className={entry.advance_paid ? 'text-green-400' : 'text-gray-500'}>
                            {entry.advance_paid ? '✅' : '⏳'}
                          </span>
                        )}
                      </td>
                      <td className="p-1 text-center text-blue-400 text-xs">
                        {['кальянщик', 'старший кальянщик'].includes(entry.user_role) ? 
                          (entry.sales_1_15 || 0) : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Зарплата 16-end */}
          <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-3">
            <h5 className="font-semibold mb-3 text-green-300">16-end Зарплата</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-1">Сотрудник</th>
                    <th className="text-center p-1">Остаток</th>
                    <th className="text-center p-1">Расходы</th>
                    <th className="text-center p-1">К выплате ЗП</th>
                    <th className="text-center p-1">Выплачено</th>
                    <th className="text-center p-1">Комментарий</th>
                    <th className="text-center p-1">Продажи 16-31</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={`salary-${entry.id}`} className="border-t border-green-600">
                      <td className="p-1 text-xs">{entry.user_name}</td>
                      <td className="p-1 text-center text-xs">{formatCurrency(entry.salary_remainder)}</td>
                      <td className="p-1 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            step="0.01"
                            value={entry.salary_expenses || ''}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'salary_expenses', e.target.value)}
                            className="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-red-400 text-xs">{formatCurrency(entry.salary_expenses)}</span>
                        )}
                      </td>
                      <td className="p-1 text-center font-bold text-green-300 text-xs">
                        {formatCurrency(entry.salary_total)}
                      </td>
                      <td className="p-1 text-center">
                        {editMode ? (
                          <input
                            type="checkbox"
                            checked={entry.salary_paid || false}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'salary_paid', e.target.checked)}
                            className="w-4 h-4"
                          />
                        ) : (
                          <span className={entry.salary_paid ? 'text-green-400' : 'text-gray-500'}>
                            {entry.salary_paid ? '✅' : '⏳'}
                          </span>
                        )}
                      </td>
                      <td className="p-1">
                        {editMode ? (
                          <input
                            type="text"
                            value={entry.salary_comment || ''}
                            onChange={(e) => updateEntry(reportEntries.indexOf(entry), 'salary_comment', e.target.value)}
                            className="w-24 p-1 bg-gray-800 border border-gray-600 rounded text-xs"
                            placeholder="Комментарий"
                          />
                        ) : (
                          <span className="text-xs text-gray-300">{entry.salary_comment || '—'}</span>
                        )}
                      </td>
                      <td className="p-1 text-center text-blue-400 text-xs">
                        {['кальянщик', 'старший кальянщик'].includes(entry.user_role) ? 
                          (entry.sales_16_31 || 0) : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">💰 Управление ФОТ v2.0</h1>
          
          <div className="flex gap-3">
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                ➕ Рассчитать ФОТ
              </button>
            )}
            
            {currentReport && (
              <button
                onClick={() => setCurrentReport(null)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                📋 К списку отчетов
              </button>
            )}
          </div>
        </div>

        {/* Форма создания отчета */}
        {showCreateForm && (
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">Создание месячного отчета ФОТ</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Заведение</label>
                <select
                  value={selectedEstablishment}
                  onChange={(e) => setSelectedEstablishment(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                >
                  <option value="">Выберите заведение</option>
                  {ESTABLISHMENTS.map(est => (
                    <option key={est.id} value={est.id}>{est.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Год</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                >
                  {[2023, 2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Месяц</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                >
                  {MONTHS.map((month, index) => (
                    <option key={index + 1} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createPayrollReport}
                disabled={isCreating || !selectedEstablishment}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
              >
                {isCreating ? '🔄 Создание...' : '✅ Создать черновик'}
              </button>

              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                ❌ Отмена
              </button>
            </div>
          </div>
        )}

        {/* Отображение текущего отчета */}
        {currentReport ? (
          <div>
            {/* Заголовок отчета */}
            <div className="bg-gray-800 p-6 rounded-lg mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    Отчет ФОТ #{currentReport.id}
                  </h2>
                  <p className="text-gray-300">
                    {ESTABLISHMENTS.find(e => e.id === currentReport.establishment_id)?.name} • 
                    {getMonthName(currentReport.month)} {currentReport.year}
                  </p>
                  <p className="text-sm text-gray-400">
                    Статус: <span className={`font-medium ${currentReport.status === 'finalized' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {currentReport.status === 'finalized' ? 'Финализирован' : 'Черновик'}
                    </span>
                  </p>
                </div>

                <div className="flex gap-3">
                  {currentReport.status !== 'finalized' && (
                    <>
                      <button
                        onClick={toggleEditMode}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          editMode 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {editMode ? '❌ Отменить' : '✏️ Редактировать'}
                      </button>

                      {editMode && hasChanges && (
                        <button
                          onClick={saveChanges}
                          disabled={saving}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
                        >
                          {saving ? '💾 Сохранение...' : '💾 Сохранить'}
                        </button>
                      )}

                      <button
                        onClick={finalizeReport}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        🔒 Финализировать
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Общая статистика */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Выручка (Revenue)</label>
                  {editMode ? (
                    <input
                      type="number"
                      value={revenue}
                      onChange={(e) => updateRevenue(e.target.value)}
                      placeholder="Введите выручку"
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-400"
                    />
                  ) : (
                    <p className="text-lg font-bold text-green-400">
                      {formatCurrency(currentReport.revenue)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Всего к выплате/мес</label>
                  <p className="text-lg font-bold text-green-400">
                    {formatCurrency(stats.totalMonthlyTotal)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Авансы</label>
                  <p className="text-lg font-bold text-yellow-400">
                    {formatCurrency(stats.totalAdvanceTotal)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Зарплаты</label>
                  <p className="text-lg font-bold text-green-400">
                    {formatCurrency(stats.totalSalaryTotal)}
                  </p>
                </div>

                {/* Дополнительная информация для кальянщиков */}
                {stats.totalSales > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Всего продаж</label>
                    <p className="text-lg font-bold text-blue-400">
                      {stats.totalSales}
                    </p>
                    <p className="text-xs text-gray-400">
                      1-15: {stats.totalSales_1_15} | 16-31: {stats.totalSales_16_31}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Группы сотрудников */}
            {loading ? (
              <div className="bg-gray-800 p-8 rounded-lg text-center">
                <p>🔄 Загрузка данных...</p>
              </div>
            ) : (
              <div>
                {groupedEntries.hookah_masters && renderEmployeeGroup(
                  groupedEntries.hookah_masters, 
                  '💨 Кальянщики'
                )}
                
                {groupedEntries.others && renderEmployeeGroup(
                  groupedEntries.others, 
                  '👥 Остальные сотрудники'
                )}
              </div>
            )}
          </div>
        ) : (
          /* Список отчетов */
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold">📋 Список отчетов ФОТ v2.0</h2>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <p>🔄 Загрузка отчетов...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>📋 Отчетов пока нет</p>
                <p className="text-sm mt-2">Создайте первый месячный отчет ФОТ</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="p-3 text-left">ID</th>
                      <th className="p-3 text-left">Заведение</th>
                      <th className="p-3 text-left">Период</th>
                      <th className="p-3 text-right">Выручка</th>
                      <th className="p-3 text-center">Статус</th>
                      <th className="p-3 text-left">Создан</th>
                      <th className="p-3 text-center">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => (
                      <tr key={report.id} className="border-t border-gray-700 hover:bg-gray-750">
                        <td className="p-3 font-mono">#{report.id}</td>
                        <td className="p-3">
                          {ESTABLISHMENTS.find(e => e.id === report.establishment_id)?.name || 'Неизвестно'}
                        </td>
                        <td className="p-3">
                          {getMonthName(report.month)} {report.year}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(report.revenue)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.status === 'finalized' 
                              ? 'bg-green-600 text-green-100' 
                              : 'bg-yellow-600 text-yellow-100'
                          }`}>
                            {report.status === 'finalized' ? 'Финализирован' : 'Черновик'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-400">
                          {formatDate(report.created_at)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => loadReportDetails(report.id)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            👁️ Открыть
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Информационная панель для новой системы */}
        <div className="mt-6 bg-gradient-to-r from-green-900 to-blue-900 p-6 rounded-lg border border-green-700">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                🚀
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">ФОТ система v2.0 - Месячные отчеты</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2 text-green-300">🆕 Новые возможности:</h4>
                  <ul className="text-green-100 space-y-1 text-sm">
                    <li>• <strong>Месячные отчеты</strong> - расчет за весь месяц</li>
                    <li>• <strong>Планы рабочего времени</strong> - настройка администратором</li>
                    <li>• <strong>Разделение аванс/зарплата</strong> - с отметками о выплатах</li>
                    <li>• <strong>Группировка сотрудников</strong> - кальянщики отдельно</li>
                    <li>• <strong>Автоматические расчеты</strong> - по новым формулам</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-blue-300">🔧 Дополнительные инструменты:</h4>
                  <div className="space-y-2">
                    <a 
                      href="/work-plans" 
                      target="_blank"
                      className="block bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded text-sm transition-colors"
                    >
                      📅 Управление планами рабочего времени
                    </a>
                    <a 
                      href="/rates" 
                      target="_blank"
                      className="block bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded text-sm transition-colors"
                    >
                      💰 Управление тарифами
                    </a>
                    <a 
                      href="/adminDashboard" 
                      target="_blank"
                      className="block bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm transition-colors"
                    >
                      ⚙️ Админ панель
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PayrollManagerV2;