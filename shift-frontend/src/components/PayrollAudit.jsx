import React, { useState, useEffect } from 'react';
import API from '../api';

function PayrollAudit({ entryId, onClose }) {
  const [auditHistory, setAuditHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entryDetails, setEntryDetails] = useState(null);

  useEffect(() => {
    if (entryId) {
      loadAuditHistory();
    }
  }, [entryId]);

  const loadAuditHistory = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/payroll/entries/${entryId}/audit`);
      setAuditHistory(response.data || []);
      
      // Также получаем детали записи для контекста
      // Это потребует создания отдельного endpoint или получения через родительский компонент
      
    } catch (error) {
      console.error('Ошибка загрузки аудита:', error);
      alert('Ошибка загрузки истории изменений');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  const formatValue = (value, fieldName) => {
    if (value === null || value === undefined || value === '') return '—';
    
    // Форматируем числовые поля как валюту или проценты
    if (['base_salary', 'motivation_amount', 'prepaid_expense', 'card_payment', 'housing_deduction', 'final_payment'].includes(fieldName)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return value;
      
      return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(numValue);
    }
    
    if (fieldName === 'motivation_percent') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return value;
      return `${numValue}%`;
    }
    
    if (['hours_worked'].includes(fieldName)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return value;
      return `${numValue} ч`;
    }
    
    if (['hookahs_sold'].includes(fieldName)) {
      const numValue = parseInt(value);
      if (isNaN(numValue)) return value;
      return `${numValue} шт`;
    }
    
    return value;
  };

  const getFieldDisplayName = (fieldName) => {
    const fieldNames = {
      'hours_worked': 'Отработанные часы',
      'hookahs_sold': 'Количество кальянов',
      'base_salary': 'Базовая зарплата',
      'motivation_percent': 'Процент мотивации',
      'motivation_amount': 'Сумма мотивации',
      'prepaid_expense': 'Аванс',
      'card_payment': 'Перевод на карту',
      'housing_deduction': 'Квартирный вычет',
      'final_payment': 'К выплате'
    };
    
    return fieldNames[fieldName] || fieldName;
  };

  const getChangeIcon = (oldValue, newValue) => {
    const oldNum = parseFloat(oldValue);
    const newNum = parseFloat(newValue);
    
    if (isNaN(oldNum) || isNaN(newNum)) {
      return '✏️'; // Общее изменение
    }
    
    if (newNum > oldNum) {
      return '📈'; // Увеличение
    } else if (newNum < oldNum) {
      return '📉'; // Уменьшение
    } else {
      return '🔄'; // Без изменения числового значения
    }
  };

  const getChangeColor = (oldValue, newValue) => {
    const oldNum = parseFloat(oldValue);
    const newNum = parseFloat(newValue);
    
    if (isNaN(oldNum) || isNaN(newNum)) {
      return 'text-blue-400'; // Общее изменение
    }
    
    if (newNum > oldNum) {
      return 'text-green-400'; // Увеличение
    } else if (newNum < oldNum) {
      return 'text-red-400'; // Уменьшение
    } else {
      return 'text-yellow-400'; // Без изменения числового значения
    }
  };

  if (!entryId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md">
          <h2 className="text-xl font-semibold mb-4">⚠️ Ошибка</h2>
          <p className="text-gray-300 mb-4">Не указан ID записи для просмотра аудита.</p>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden mx-4">
        {/* Заголовок */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold">📚 История изменений</h2>
            <p className="text-gray-400 text-sm">Запись #{entryId}</p>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Содержимое */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="text-center py-8">
              <p>🔄 Загрузка истории изменений...</p>
            </div>
          ) : auditHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                📋
              </div>
              <p>История изменений пуста</p>
              <p className="text-sm mt-2">Эта запись еще не редактировалась</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditHistory.map((entry, index) => (
                <div key={entry.id} className="bg-gray-700 rounded-lg p-4">
                  {/* Заголовок изменения */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className={`text-2xl ${getChangeColor(entry.old_value, entry.new_value)}`}>
                        {getChangeIcon(entry.old_value, entry.new_value)}
                      </span>
                      <div>
                        <h3 className="font-medium">
                          {getFieldDisplayName(entry.field_name)}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {formatDate(entry.changed_at)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        Изменил: {entry.changed_by_name || `ID ${entry.changed_by}`}
                      </p>
                      {entry.change_reason && (
                        <p className="text-xs text-gray-500 mt-1">
                          Причина: {entry.change_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Детали изменения */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Было:
                      </label>
                      <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-2">
                        <span className="text-red-300 font-mono text-sm">
                          {formatValue(entry.old_value, entry.field_name)}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Стало:
                      </label>
                      <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded p-2">
                        <span className="text-green-300 font-mono text-sm">
                          {formatValue(entry.new_value, entry.field_name)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Разделитель между изменениями */}
                  {index < auditHistory.length - 1 && (
                    <div className="mt-4 border-t border-gray-600"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подвал */}
        <div className="flex justify-between items-center p-6 border-t border-gray-700 bg-gray-750">
          <div className="text-sm text-gray-400">
            {auditHistory.length > 0 && (
              <span>Всего изменений: {auditHistory.length}</span>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// Компонент для встраивания кнопки аудита в таблицу
export function AuditButton({ entryId, onShowAudit }) {
  const [hasHistory, setHasHistory] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuditHistory();
  }, [entryId]);

  const checkAuditHistory = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/payroll/entries/${entryId}/audit`);
      setHasHistory((response.data || []).length > 0);
    } catch (error) {
      console.error('Ошибка проверки аудита:', error);
      setHasHistory(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <span className="text-xs text-gray-500">...</span>
    );
  }

  if (!hasHistory) {
    return (
      <span className="text-xs text-gray-500">Нет изменений</span>
    );
  }

  return (
    <button
      onClick={() => onShowAudit(entryId)}
      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
      title="Посмотреть историю изменений"
    >
      📚 История
    </button>
  );
}

export default PayrollAudit;