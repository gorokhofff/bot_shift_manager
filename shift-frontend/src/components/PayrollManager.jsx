import React, { useState, useEffect } from 'react';
import API from '../api';
import PayrollAudit, { AuditButton } from './PayrollAudit';
import { ExportButton } from './ExportUtils';

const ESTABLISHMENTS = [
  { id: 1, name: "Yenibosna", location: "yenibosna" },
  { id: 2, name: "Göktürk", location: "göktürk" }
];

const PERIOD_TYPES = [
  { 
    label: "1-15 число", 
    getValue: (year, month) => ({
      start: `${year}-${month.toString().padStart(2, '0')}-01`,
      end: `${year}-${month.toString().padStart(2, '0')}-15`
    })
  },
  { 
    label: "16-последний день", 
    getValue: (year, month) => {
      const lastDay = new Date(year, month, 0).getDate();
      return {
        start: `${year}-${month.toString().padStart(2, '0')}-16`,
        end: `${year}-${month.toString().padStart(2, '0')}-${lastDay}`
      };
    }
  }
];

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

function PayrollManager() {
  // Состояния для создания отчета
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedPeriodType, setSelectedPeriodType] = useState(0);
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

  // Состояния для аудита
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  // Состояния для управления сотрудниками
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await API.get('/payroll/reports');
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

    const period = PERIOD_TYPES[selectedPeriodType].getValue(selectedYear, selectedMonth);
    
    setIsCreating(true);
    try {
      console.log('🔄 Создаем отчет ФОТ:', {
        establishment_id: selectedEstablishment,
        period_start: period.start,
        period_end: period.end
      });

      const response = await API.post('/payroll/generate-draft', {
        establishment_id: parseInt(selectedEstablishment),
        period_start: period.start,
        period_end: period.end
      });

      console.log('✅ Отчет создан:', response.data);
      
      // Загружаем созданный отчет
      await loadReportDetails(response.data.report_id);
      setShowCreateForm(false);
      
      alert(`✅ Черновик создан! Найдено ${response.data.employees_count} сотрудников, ${response.data.total_hookahs} кальянов`);
      
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
      const response = await API.get(`/payroll/reports/${reportId}`);
      
      setCurrentReport(response.data.report);
      setReportEntries(response.data.entries || []);
      setRevenue(response.data.report.revenue || '');
      setEditMode(false);
      setHasChanges(false);
      
      // Загружаем доступных пользователей для добавления
      await loadAvailableUsers(reportId);
      
      await loadReports(); // Обновляем список отчетов
      
    } catch (error) {
      console.error('Ошибка загрузки деталей отчета:', error);
      alert('Ошибка загрузки деталей отчета');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async (reportId) => {
    try {
      const response = await API.get(`/payroll/reports/${reportId}/available-users`);
      setAvailableUsers(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки доступных пользователей:', error);
      setAvailableUsers([]);
    }
  };

  const updateEntry = (entryIndex, field, value) => {
    if (!editMode) return;

    const newEntries = [...reportEntries];
    const oldValue = newEntries[entryIndex][field];
    
    // Преобразуем значение в число для числовых полей
    if (['hours_worked', 'hookahs_sold', 'motivation_percent', 'prepaid_expense', 'card_payment', 'housing_deduction'].includes(field)) {
      value = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    newEntries[entryIndex][field] = value;
    
    // Пересчитываем автоматические поля
    recalculateEntry(newEntries[entryIndex]);
    
    setReportEntries(newEntries);
    
    if (oldValue !== value) {
      setHasChanges(true);
    }
  };

  const recalculateEntry = (entry) => {
    const role = entry.user_role;
    const hookahs = entry.hookahs_sold || 0;
    const motivationPercent = entry.motivation_percent || 0;
    const prepaid = entry.prepaid_expense || 0;
    const card = entry.card_payment || 0;
    const housing = entry.housing_deduction || 0;
    const currentRevenue = parseFloat(revenue) || 0;

    // Базовая зарплата
    let baseSalary = 0;
    if (role === 'кальянщик' || role === 'старший кальянщик') {
      baseSalary = hookahs * 10; // 10 за кальян
    } else {
      // Для других ролей используем тарифы
      const periodType = getPeriodType();
      const rates = {
        'уборщик': { '1-15': 15000, '16-end': 19000 },
        'бармен/зал': { '1-15': 15000, '16-end': 21000 },
        'студент': { '1-15': 15000, '16-end': 20000 },
        'администратор': { '1-15': 20000, '16-end': 26000 }
      };
      baseSalary = rates[role]?.[periodType] || 0;
    }

    // Мотивация
    const revenueWithoutService = currentRevenue / 1.1;
    const motivationAmount = (motivationPercent / 100) * revenueWithoutService;

    // Итоговая выплата
    const finalPayment = Math.max(0, baseSalary + motivationAmount - prepaid - card - housing);

    // Обновляем рассчитанные поля
    entry.base_salary = Math.round(baseSalary * 100) / 100;
    entry.motivation_amount = Math.round(motivationAmount * 100) / 100;
    entry.final_payment = Math.round(finalPayment * 100) / 100;
  };

  const getPeriodType = () => {
    if (!currentReport) return '1-15';
    const startDate = new Date(currentReport.period_start);
    return startDate.getDate() === 1 ? '1-15' : '16-end';
  };

  const updateRevenue = (value) => {
    setRevenue(value);
    if (editMode) {
      setHasChanges(true);
      // Пересчитываем все записи
      const newEntries = [...reportEntries];
      newEntries.forEach(entry => recalculateEntry(entry));
      setReportEntries(newEntries);
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
        await API.put(`/payroll/entries/${entry.id}`, {
          hours_worked: entry.hours_worked,
          hookahs_sold: entry.hookahs_sold,
          motivation_percent: entry.motivation_percent,
          prepaid_expense: entry.prepaid_expense,
          card_payment: entry.card_payment,
          housing_deduction: entry.housing_deduction
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

  const showAudit = (entryId) => {
    setSelectedEntryId(entryId);
    setShowAuditModal(true);
  };

  const closeAudit = () => {
    setShowAuditModal(false);
    setSelectedEntryId(null);
  };

  const addEmployee = async () => {
    if (!selectedUserId) {
      alert('Выберите сотрудника для добавления');
      return;
    }

    try {
      const response = await API.post(`/payroll/reports/${currentReport.id}/add-employee`, {
        user_id: parseInt(selectedUserId)
      });

      alert(`✅ Сотрудник ${response.data.user_name} добавлен в отчет!`);
      
      // Перезагружаем отчет
      await loadReportDetails(currentReport.id);
      
      // Сбрасываем форму
      setSelectedUserId('');
      setShowAddEmployee(false);

    } catch (error) {
      console.error('❌ Ошибка добавления сотрудника:', error);
      alert(`❌ Ошибка добавления: ${error.response?.data?.detail || error.message}`);
    }
  };

  const removeEmployee = async (entryId, userName) => {
    const confirm = window.confirm(`Удалить сотрудника "${userName}" из отчета?`);
    if (!confirm) return;

    try {
      await API.delete(`/payroll/entries/${entryId}`);
      alert(`✅ Сотрудник удален из отчета`);
      
      // Перезагружаем отчет
      await loadReportDetails(currentReport.id);

    } catch (error) {
      console.error('❌ Ошибка удаления сотрудника:', error);
      alert(`❌ Ошибка удаления: ${error.response?.data?.detail || error.message}`);
    }
  };

  const deleteReport = async () => {
    if (!currentReport || currentReport.status === 'finalized') {
      alert('Нельзя удалить финализированный отчет');
      return;
    }

    const confirm = window.confirm(`Удалить отчет ФОТ #${currentReport.id}?\n\nВНИМАНИЕ: Это действие необратимо!`);
    if (!confirm) return;

    try {
      await API.delete(`/payroll/reports/${currentReport.id}`);
      alert('✅ Отчет удален!');
      
      // Возвращаемся к списку отчетов
      setCurrentReport(null);
      await loadReports();

    } catch (error) {
      console.error('❌ Ошибка удаления отчета:', error);
      alert(`❌ Ошибка удаления: ${error.response?.data?.detail || error.message}`);
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

  const getTotalStats = () => {
    if (!reportEntries.length) return { totalBaseSalary: 0, totalMotivation: 0, totalFinalPayment: 0 };
    
    return reportEntries.reduce((acc, entry) => ({
      totalBaseSalary: acc.totalBaseSalary + (entry.base_salary || 0),
      totalMotivation: acc.totalMotivation + (entry.motivation_amount || 0),
      totalFinalPayment: acc.totalFinalPayment + (entry.final_payment || 0)
    }), { totalBaseSalary: 0, totalMotivation: 0, totalFinalPayment: 0 });
  };

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">💰 Управление ФОТ</h1>
          
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
            <h2 className="text-xl font-semibold mb-4">Создание отчета ФОТ</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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

              <div>
                <label className="block text-sm font-medium mb-2">Период</label>
                <select
                  value={selectedPeriodType}
                  onChange={(e) => setSelectedPeriodType(parseInt(e.target.value))}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
                >
                  {PERIOD_TYPES.map((period, index) => (
                    <option key={index} value={index}>{period.label}</option>
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
                    {formatDate(currentReport.period_start)} - {formatDate(currentReport.period_end)}
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

                  <ExportButton 
                    report={currentReport} 
                    entries={reportEntries} 
                    variant="dropdown"
                  />
                </div>
              </div>

              {/* Основные метрики */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <label className="block text-sm font-medium mb-2">Revenue без сервиса</label>
                  <p className="text-lg font-bold text-blue-400">
                    {formatCurrency((currentReport.revenue || 0) / 1.1)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Всего кальянов</label>
                  <p className="text-lg font-bold text-purple-400">
                    {currentReport.total_hookahs}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Сотрудников</label>
                  <p className="text-lg font-bold text-yellow-400">
                    {reportEntries.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Таблица сотрудников */}
            {loading ? (
              <div className="bg-gray-800 p-8 rounded-lg text-center">
                <p>🔄 Загрузка данных...</p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="p-3 text-left">Сотрудник</th>
                        <th className="p-3 text-left">Роль</th>
                        <th className="p-3 text-right">Часы</th>
                        <th className="p-3 text-right">Кальяны</th>
                        <th className="p-3 text-right">Базовая ЗП</th>
                        <th className="p-3 text-right">Мотивация %</th>
                        <th className="p-3 text-right">Мотивация ₽</th>
                        <th className="p-3 text-right">Аванс</th>
                        <th className="p-3 text-right">Карта</th>
                        <th className="p-3 text-right">Квартира</th>
                        <th className="p-3 text-right font-bold">К выплате</th>
                        <th className="p-3 text-center">Аудит</th>
                        {currentReport?.status === 'draft' && (
                          <th className="p-3 text-center">Действия</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {reportEntries.map((entry, index) => (
                        <tr key={entry.id} className="border-t border-gray-700 hover:bg-gray-750">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{entry.user_name}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm bg-gray-600 px-2 py-1 rounded">
                              {entry.user_role || '—'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                step="0.1"
                                value={entry.hours_worked || ''}
                                onChange={(e) => updateEntry(index, 'hours_worked', e.target.value)}
                                className="w-20 p-1 bg-gray-700 border border-gray-600 rounded text-sm text-right"
                              />
                            ) : (
                              <span>{entry.hours_worked || 0}</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                value={entry.hookahs_sold || ''}
                                onChange={(e) => updateEntry(index, 'hookahs_sold', e.target.value)}
                                className="w-20 p-1 bg-gray-700 border border-gray-600 rounded text-sm text-right"
                              />
                            ) : (
                              <span>{entry.hookahs_sold || 0}</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(entry.base_salary)}
                          </td>
                          <td className="p-3 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                step="0.1"
                                value={entry.motivation_percent || ''}
                                onChange={(e) => updateEntry(index, 'motivation_percent', e.target.value)}
                                className="w-20 p-1 bg-gray-700 border border-gray-600 rounded text-sm text-right"
                              />
                            ) : (
                              <span>{entry.motivation_percent || 0}%</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-green-400">
                            {formatCurrency(entry.motivation_amount)}
                          </td>
                          <td className="p-3 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                value={entry.prepaid_expense || ''}
                                onChange={(e) => updateEntry(index, 'prepaid_expense', e.target.value)}
                                className="w-24 p-1 bg-gray-700 border border-gray-600 rounded text-sm text-right"
                              />
                            ) : (
                              <span className="text-red-400">{formatCurrency(entry.prepaid_expense)}</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                value={entry.card_payment || ''}
                                onChange={(e) => updateEntry(index, 'card_payment', e.target.value)}
                                className="w-24 p-1 bg-gray-700 border border-gray-600 rounded text-sm text-right"
                              />
                            ) : (
                              <span className="text-red-400">{formatCurrency(entry.card_payment)}</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {editMode ? (
                              <input
                                type="number"
                                value={entry.housing_deduction || ''}
                                onChange={(e) => updateEntry(index, 'housing_deduction', e.target.value)}
                                className="w-24 p-1 bg-gray-700 border border-gray-600 rounded text-sm text-right"
                              />
                            ) : (
                              <span className="text-red-400">{formatCurrency(entry.housing_deduction)}</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-bold text-xl text-green-400">
                              {formatCurrency(entry.final_payment)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <AuditButton 
                              entryId={entry.id} 
                              onShowAudit={showAudit}
                            />
                          </td>
                          {currentReport?.status === 'draft' && (
                            <td className="p-3 text-center">
                              <button
                                onClick={() => removeEmployee(entry.id, entry.user_name)}
                                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors"
                                title={`Удалить ${entry.user_name} из отчета`}
                              >
                                ❌
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-700 border-t-2 border-gray-600">
                      <tr>
                        <td colSpan="4" className="p-3 font-bold">ИТОГО:</td>
                        <td className="p-3 text-right font-bold">{formatCurrency(stats.totalBaseSalary)}</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right font-bold text-green-400">{formatCurrency(stats.totalMotivation)}</td>
                        <td colSpan="3" className="p-3"></td>
                        <td className="p-3 text-right font-bold text-xl text-green-400">
                          {formatCurrency(stats.totalFinalPayment)}
                        </td>
                        <td className="p-3"></td>
                        {currentReport?.status === 'draft' && <td className="p-3"></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Кнопка добавления сотрудника */}
                {currentReport?.status === 'draft' && (
                  <div className="p-4 bg-gray-750 border-t border-gray-600">
                    {!showAddEmployee ? (
                      <button
                        onClick={() => setShowAddEmployee(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ➕ Добавить сотрудника
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-400"
                        >
                          <option value="">-- Выберите сотрудника --</option>
                          {availableUsers.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.display_name}
                            </option>
                          ))}
                        </select>
                        
                        <button
                          onClick={addEmployee}
                          disabled={!selectedUserId}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
                        >
                          ✅ Добавить
                        </button>
                        
                        <button
                          onClick={() => {
                            setShowAddEmployee(false);
                            setSelectedUserId('');
                          }}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          ❌ Отмена
                        </button>
                      </div>
                    )}
                    
                    {availableUsers.length === 0 && showAddEmployee && (
                      <p className="text-gray-400 text-sm mt-2">
                        Все сотрудники с назначенными ролями уже включены в отчет
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Список отчетов */
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold">📋 Список отчетов ФОТ</h2>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <p>🔄 Загрузка отчетов...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>📋 Отчетов пока нет</p>
                <p className="text-sm mt-2">Создайте первый отчет ФОТ</p>
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
                      <th className="p-3 text-right">Кальяны</th>
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
                          {formatDate(report.period_start)} - {formatDate(report.period_end)}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(report.revenue)}
                        </td>
                        <td className="p-3 text-right">
                          {report.total_hookahs}
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
      </div>
    </div>
  );
}

export default PayrollManager;