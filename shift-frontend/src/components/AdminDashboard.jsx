import React, { useState, useEffect } from 'react';
import API from '../api';

const AdminDashboard = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    pages: 0
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Метаданные для таблиц - описания и специальные настройки
  const tableMetadata = {
    'Users': {
      name: 'Пользователи',
      description: 'Пользователи системы с ролями',
      icon: '👥',
      category: 'Основные'
    },
    'Shifts': {
      name: 'Смены',
      description: 'Рабочие смены сотрудников с именами пользователей',
      icon: '⏰',
      category: 'Основные'
    },
    'Reports': {
      name: 'Отчеты',
      description: 'Отчеты сотрудников по сменам',
      icon: '📋',
      category: 'Основные'
    },
    'ReportsAuditLog': {
      name: 'Аудит отчетов',
      description: 'История изменений отчетов',
      icon: '📚',
      category: 'Аудит'
    },
    'ReportsEditSessions': {
      name: 'Сессии редактирования',
      description: 'Активные сессии редактирования',
      icon: '🔄',
      category: 'Аудит'
    },
    'rates': {
      name: 'Тарифы',
      description: 'Тарифы оплаты по ролям',
      icon: '💰',
      category: 'ФОТ'
    },
    'payroll_reports': {
      name: 'Отчеты ФОТ',
      description: 'Отчеты фонда оплаты труда',
      icon: '📊',
      category: 'ФОТ'
    },
    'payroll_entries': {
      name: 'Записи ФОТ',
      description: 'Записи по сотрудникам в ФОТ',
      icon: '💼',
      category: 'ФОТ'
    },
    'payroll_audit_log': {
      name: 'Аудит ФОТ',
      description: 'История изменений в ФОТ',
      icon: '📝',
      category: 'ФОТ'
    }
  };

  // Специальные колонки для отображения
  const specialColumns = {
    'Users': {
      'role': {
        type: 'select',
        options: ['кальянщик', 'старший кальянщик', 'администратор', 'уборщик', 'студент', 'бармен/зал']
      },
      'status': {
        type: 'select',
        options: ['pending', 'active', 'inactive']
      }
    },
    'rates': {
      'role': {
        type: 'select',
        options: ['кальянщик', 'старший кальянщик', 'администратор', 'уборщик', 'студент', 'бармен/зал']
      },
      'period_type': {
        type: 'select',
        options: ['1-15', '16-end', 'per_hookah']
      }
    },
    'payroll_reports': {
      'status': {
        type: 'select',
        options: ['draft', 'finalized']
      }
    }
  };

  // Загрузка списка таблиц
  useEffect(() => {
    const fetchTables = async () => {
      try {
        console.log('🔍 Загружаем список таблиц...');
        const response = await API.get('/tables');
        console.log('✅ Таблицы получены:', response.data);
        
        // Сортируем таблицы по категориям и названиям
        const sortedTables = (response.data || []).sort((a, b) => {
          const metaA = tableMetadata[a] || { category: 'Другие', name: a };
          const metaB = tableMetadata[b] || { category: 'Другие', name: b };
          
          if (metaA.category !== metaB.category) {
            const categoryOrder = ['Основные', 'ФОТ', 'Аудит', 'Другие'];
            return categoryOrder.indexOf(metaA.category) - categoryOrder.indexOf(metaB.category);
          }
          
          return metaA.name.localeCompare(metaB.name);
        });
        
        setTables(sortedTables);
        
        // Автоматически выбираем Users если доступна
        if (sortedTables.includes('Users')) {
          setSelectedTable('Users');
        } else if (sortedTables.length > 0) {
          setSelectedTable(sortedTables[0]);
        }
      } catch (err) {
        console.error('❌ Ошибка загрузки таблиц:', err);
        setError(`Ошибка загрузки таблиц: ${err.message}`);
      }
    };

    fetchTables();
  }, []);

  // Загрузка данных таблицы
  useEffect(() => {
    if (selectedTable) {
      fetchTableData();
    }
  }, [selectedTable, pagination.page, searchTerm]);

  const fetchTableData = async () => {
    if (!selectedTable) return;

    setLoading(true);
    setError('');
    
    try {
      console.log(`📊 Загружаем данные таблицы ${selectedTable}...`);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.pageSize.toString(),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await API.get(`/tables/${selectedTable}?${params}`);
      console.log('✅ Данные таблицы получены:', response.data);
      
      const data = response.data;
      
      setTableData(data.data || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        pages: data.pages || 0
      }));

      // Извлекаем колонки из первой записи
      if (data.data && data.data.length > 0) {
        setColumns(Object.keys(data.data[0]));
      } else {
        setColumns([]);
      }

    } catch (err) {
      console.error(`❌ Ошибка загрузки таблицы ${selectedTable}:`, err);
      setError(`Ошибка загрузки таблицы: ${err.message}`);
      setTableData([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (tableName) => {
    setSelectedTable(tableName);
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchTerm('');
    setEditingCell(null);
  };

  const handleCellEdit = (rowIndex, columnName, currentValue) => {
    setEditingCell(`${rowIndex}-${columnName}`);
    setEditValue(currentValue || '');
  };

  const handleCellSave = async (rowIndex, columnName) => {
    const row = tableData[rowIndex];
    const originalValue = row[columnName];
    
    if (editValue === originalValue) {
      setEditingCell(null);
      return;
    }

    try {
      console.log(`💾 Сохраняем изменение в ${selectedTable}:`, {
        row: row.id,
        column: columnName,
        oldValue: originalValue,
        newValue: editValue
      });

      await API.put(`/tables/${selectedTable}`, {
        updates: [{
          original: row,
          changes: { [columnName]: editValue }
        }]
      });

      // Обновляем локальные данные
      const updatedData = [...tableData];
      updatedData[rowIndex] = { ...row, [columnName]: editValue };
      setTableData(updatedData);
      
      setEditingCell(null);
      console.log('✅ Изменение сохранено');
      
    } catch (err) {
      console.error('❌ Ошибка сохранения:', err);
      setError(`Ошибка сохранения: ${err.message}`);
      setEditingCell(null);
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyPress = (e, rowIndex, columnName) => {
    if (e.key === 'Enter') {
      handleCellSave(rowIndex, columnName);
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };

  const handleDeleteRow = async (row) => {
    if (!row.id) {
      setError('Невозможно удалить запись без ID');
      return;
    }

    const tableInfo = tableMetadata[selectedTable];
    const tableName = tableInfo ? tableInfo.name : selectedTable;
    
    const confirmDelete = window.confirm(`Удалить запись ID ${row.id} из таблицы "${tableName}"?\n\nВНИМАНИЕ: Это действие необратимо!`);
    if (!confirmDelete) return;

    try {
      console.log(`🗑️ Удаляем запись ${row.id} из ${selectedTable}`);
      
      await API.delete(`/tables/${selectedTable}`, { data: row });
      
      // Обновляем данные
      await fetchTableData();
      console.log('✅ Запись удалена');
      
    } catch (err) {
      console.error('❌ Ошибка удаления:', err);
      setError(`Ошибка удаления: ${err.message}`);
    }
  };

  const exportToExcel = () => {
    if (!tableData.length) {
      alert('Нет данных для экспорта');
      return;
    }

    try {
      const tableInfo = tableMetadata[selectedTable];
      const tableName = tableInfo ? tableInfo.name : selectedTable;
      
      // CSV экспорт с BOM для правильной кодировки
      const csvContent = '\uFEFF' + [
        columns.join(','), // Заголовки
        ...tableData.map(row => 
          columns.map(col => {
            let value = row[col] || '';
            // Экранируем запятые и кавычки
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${tableName}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Экспорт завершен');
    } catch (err) {
      console.error('❌ Ошибка экспорта:', err);
      setError(`Ошибка экспорта: ${err.message}`);
    }
  };

  const renderCellEditor = (rowIndex, columnName, cellValue) => {
    const cellKey = `${rowIndex}-${columnName}`;
    const isEditing = editingCell === cellKey;

    // Если это колонка user_name в таблице Shifts, делаем её только для чтения
    if (selectedTable === 'Shifts' && columnName === 'user_name') {
    return (
      <div className="p-2 bg-gray-700 text-gray-300 rounded" title="Только для чтения - имя берётся из таблицы пользователей">
        {cellValue || <span className="text-gray-500 italic">Пользователь не найден</span>}
      </div>
    );
    }
    
    if (!isEditing) {
      return (
        <div
          onClick={() => handleCellEdit(rowIndex, columnName, cellValue)}
          className="cursor-pointer hover:bg-gray-600 p-2 rounded min-h-8 flex items-center"
          title="Кликните для редактирования"
        >
          {cellValue !== null && cellValue !== undefined ? 
            String(cellValue) : 
            <span className="text-gray-500 italic">null</span>
          }
        </div>
      );
    }

    // Проверяем, есть ли специальные настройки для этой колонки
    const columnConfig = specialColumns[selectedTable]?.[columnName];
    
    if (columnConfig?.type === 'select') {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleCellSave(rowIndex, columnName)}
          onKeyPress={(e) => handleKeyPress(e, rowIndex, columnName)}
          className="w-full p-1 bg-gray-600 text-white rounded border border-blue-500"
          autoFocus
        >
          <option value="">-- Выберите --</option>
          {columnConfig.options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    // Обычное текстовое поле
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyPress={(e) => handleKeyPress(e, rowIndex, columnName)}
        onBlur={() => handleCellSave(rowIndex, columnName)}
        className="w-full p-1 bg-gray-600 text-white rounded border border-blue-500"
        autoFocus
      />
    );
  };

  const formatColumnName = (columnName) => {
    const columnNames = {
      'id': 'ID',
      'telegram_id': 'Telegram ID',
      'name': 'Имя',
      'status': 'Статус',
      'role': 'Роль',
      'user_id': 'ID пользователя',
      'user_name': 'Имя пользователя',  // НОВАЯ колонка
      'start_time': 'Начало смены',
      'end_time': 'Конец смены',
      'location': 'Локация',
      'duration_hours': 'Часы',
      'shift_date': 'Дата смены',
      'shift_id': 'ID смены',
      'report_text': 'Текст отчета',
      'created_at': 'Создано',
      'updated_at': 'Обновлено',
      'rate': 'Тариф',
      'period_type': 'Тип периода',
      'effective_date': 'Дата действия',
      'establishment_id': 'ID заведения',
      'period_start': 'Начало периода',
      'period_end': 'Конец периода',
      'revenue': 'Выручка',
      'total_hookahs': 'Всего кальянов',
      'created_by': 'Создал',
      'payroll_report_id': 'ID отчета ФОТ',
      'hours_worked': 'Отраб. часы',
      'hookahs_sold': 'Кальяны',
      'base_salary': 'Базовая ЗП',
      'motivation_percent': 'Мотивация %',
      'motivation_amount': 'Мотивация ₽',
      'prepaid_expense': 'Аванс',
      'card_payment': 'Карта',
      'housing_deduction': 'Квартира',
      'final_payment': 'К выплате',
      'payroll_entry_id': 'ID записи ФОТ',
      'field_name': 'Поле',
      'old_value': 'Было',
      'new_value': 'Стало',
      'changed_by': 'Изменил',
      'changed_at': 'Дата изменения',
      'change_reason': 'Причина'
    };
    
    return columnNames[columnName] || columnName;
  };

  const formatCellValue = (value, columnName) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">null</span>;
    }

    // Форматирование денежных значений
    if (['revenue', 'base_salary', 'motivation_amount', 'prepaid_expense', 'card_payment', 'housing_deduction', 'final_payment', 'rate'].includes(columnName)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(numValue);
      }
    }

    // Форматирование процентов
    if (columnName === 'motivation_percent') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return `${numValue}%`;
      }
    }

    // Форматирование дат
    if (['created_at', 'updated_at', 'effective_date', 'period_start', 'period_end', 'shift_date', 'changed_at'].includes(columnName)) {
      try {
        return new Date(value).toLocaleString('ru-RU');
      } catch (e) {
        return value;
      }
    }

    // Форматирование статусов
    if (columnName === 'status') {
      const statusLabels = {
        'pending': '⏳ Ожидание',
        'active': '✅ Активен',
        'inactive': '❌ Неактивен',
        'draft': '📝 Черновик',
        'finalized': '🔒 Финализирован'
      };
      return statusLabels[value] || value;
    }

    // Форматирование ролей
    if (columnName === 'role' && value) {
      const roleIcons = {
        'кальянщик': '💨',
        'старший кальянщик': '👑',
        'администратор': '⚙️',
        'уборщик': '🧹',
        'студент': '🎓',
        'бармен/зал': '🍹'
      };
      return `${roleIcons[value] || '👤'} ${value}`;
    }

    return String(value);
  };

  // Группируем таблицы по категориям
  const groupedTables = tables.reduce((groups, table) => {
    const meta = tableMetadata[table] || { category: 'Другие' };
    const category = meta.category;
    
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(table);
    
    return groups;
  }, {});

  const currentTableInfo = tableMetadata[selectedTable];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">⚙️ Админ Панель</h1>
          <p className="text-gray-300 mt-1">Управление базой данных системы</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => window.open('/payroll', '_blank')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
          >
            💰 Система ФОТ
          </button>
          <button
            onClick={() => window.open('/rates', '_blank')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium"
          >
            📊 Управление тарифами
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-800 border border-red-600 p-4 rounded mb-4">
          <strong>Ошибка:</strong> {error}
          <button 
            onClick={() => setError('')}
            className="float-right text-red-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Выбор таблицы */}
      <div className="mb-6 bg-gray-800 p-4 rounded-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Выберите таблицу:</label>
            <select
              value={selectedTable}
              onChange={(e) => handleTableSelect(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500"
            >
              <option value="">-- Выберите таблицу --</option>
              {Object.entries(groupedTables).map(([category, categoryTables]) => (
                <optgroup key={category} label={`📁 ${category}`}>
                  {categoryTables.map((table) => {
                    const meta = tableMetadata[table];
                    return (
                      <option key={table} value={table}>
                        {meta ? `${meta.icon} ${meta.name}` : table}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
            
            {currentTableInfo && (
              <p className="text-xs text-gray-400 mt-1">
                {currentTableInfo.description}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Поиск:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по всем полям..."
              className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Действия:</label>
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                disabled={!tableData.length}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm font-medium flex-1"
              >
                📤 Экспорт
              </button>
              <button
                onClick={() => fetchTableData()}
                disabled={loading}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium flex-1"
              >
                {loading ? '🔄' : '🔄 Обновить'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Информация о таблице */}
      {selectedTable && (
        <div className="mb-4 bg-gray-800 p-4 rounded border-l-4 border-blue-500">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                {currentTableInfo ? `${currentTableInfo.icon} ${currentTableInfo.name}` : selectedTable}
                <span className="text-sm font-normal text-gray-400">({selectedTable})</span>
              </h2>
              {currentTableInfo && (
                <p className="text-gray-300 text-sm mt-1">{currentTableInfo.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">
                Страница {pagination.page} из {pagination.pages}
              </div>
              <div className="text-lg font-bold text-blue-400">
                {pagination.total} записей
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Данные таблицы */}
      {loading ? (
        <div className="text-center py-8 bg-gray-800 rounded-lg">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full"></div>
          <p className="mt-2">Загрузка данных...</p>
        </div>
      ) : selectedTable && tableData.length > 0 ? (
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="p-3 text-left font-semibold border-b border-gray-600 min-w-32">
                      <div className="flex flex-col">
                        <span>{formatColumnName(column)}</span>
                        <span className="text-xs font-normal text-gray-400">{column}</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-center font-semibold border-b border-gray-600 w-24">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, rowIndex) => (
                  <tr key={row.id || rowIndex} className="border-b border-gray-700 hover:bg-gray-750">
                    {columns.map((column) => (
                      <td key={column} className="border-r border-gray-700 align-top">
                        {renderCellEditor(rowIndex, column, row[column])}
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteRow(row)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                        title={`Удалить запись ID ${row.id}`}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {pagination.pages > 1 && (
            <div className="flex justify-between items-center p-4 bg-gray-700 border-t border-gray-600">
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-sm"
                >
                  ⏮️ Первая
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-sm"
                >
                  ◀️ Назад
                </button>
                <span className="px-3 py-1 bg-gray-800 rounded text-sm">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-sm"
                >
                  Вперед ▶️
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.pages }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded text-sm"
                >
                  Последняя ⏭️
                </button>
              </div>
              
              <div className="text-sm text-gray-400">
                Показано {Math.min(pagination.pageSize, tableData.length)} из {pagination.total} записей
              </div>
            </div>
          )}
        </div>
      ) : selectedTable ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold mb-2">Нет данных</h3>
          <p className="text-gray-400 mb-4">
            В таблице {currentTableInfo ? currentTableInfo.name : selectedTable} пока нет записей
          </p>
          {searchTerm && (
            <p className="text-sm text-gray-500">
              Попробуйте изменить поисковый запрос: "{searchTerm}"
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <div className="text-6xl mb-4">🗃️</div>
          <h3 className="text-xl font-semibold mb-2">Выберите таблицу</h3>
          <p className="text-gray-400">
            Выберите таблицу из списка выше для просмотра и редактирования данных
          </p>
        </div>
      )}

      {/* Информационная панель */}
      <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 p-4 rounded-lg border border-blue-700">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">
              💡
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Советы по использованию:</h3>
            <ul className="text-blue-100 text-sm space-y-1">
              <li>• <strong>Клик по ячейке</strong> - редактирование значения</li>
              <li>• <strong>Enter</strong> - сохранить изменения, <strong>Escape</strong> - отменить</li>
              <li>• <strong>Поиск</strong> работает по всем полям таблицы</li>
              <li>• <strong>Экспорт</strong> сохраняет данные в формате CSV</li>
              <li>• <strong>Осторожно с удалением</strong> - действие необратимо!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;