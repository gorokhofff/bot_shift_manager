import React, { useEffect, useState } from "react";
import { useTable } from "react-table";
import API from "../api";

const EditableCell = ({ value: initialValue, row, column, updateData, editMode }) => {
  const [value, setValue] = useState(initialValue);
  const [originalValue] = useState(initialValue);

  const onChange = e => {
    setValue(e.target.value);
    updateData(row.index, column.id, e.target.value);
  };

  const onBlur = () => {
    // Можно добавить логику при потере фокуса
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const isChanged = value !== originalValue;

  // Если не в режиме редактирования - показываем текст
  if (!editMode) {
    return (
      <span className={`${isChanged ? 'bg-yellow-800 px-1 rounded' : ''}`}>
        {value || "—"}
      </span>
    );
  }

  // В режиме редактирования - показываем input
  return (
    <input
      value={value || ""}
      onChange={onChange}
      onBlur={onBlur}
      className={`bg-gray-700 text-white p-1 w-full text-xs border ${
        isChanged ? 'border-yellow-400' : 'border-gray-600'
      } rounded focus:border-blue-400 focus:outline-none`}
      disabled={!row.original.isValid}
      placeholder={!row.original.isValid ? 'Недоступно' : ''}
    />
  );
};

// Безопасная функция парсинга
function parseReportText(text, reportId) {
  const result = {
    id: reportId,
    isValid: false,
    errorMessage: null,
    originalText: text || '',
    tarih: '',
    satış: '',
    'satış_dubai chocolate': '',
    'satış_Bonche': '',
    'Ücretsiz': '',
    'Ücretsiz_G': '',
    'Ücretsiz_K': '',
    'Ücretsiz_M': '',
    'Değiştirme': '',
    'koz': '',
    'Elek': '',
    'nargile': '',
    'lule': '',
    'kalaud': '',
    'baca': '',
    'Maşa': '',
    'Sipsi': ''
  };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    result.errorMessage = 'Пустой текст';
    return result;
  }

  try {
    let fieldsFound = 0;

    const mainFields = ['tarih', 'satış', 'Ücretsiz', 'Değiştirme', 'koz', 'Elek', 'nargile', 'lule', 'kalaud', 'baca', 'Maşa', 'Sipsi'];
    
    mainFields.forEach(field => {
      try {
        const regex = new RegExp(`${field}\\s*-\\s*([^\\n\\(]+)`, 'i');
        const match = text.match(regex);
        if (match && match[1]) {
          result[field] = match[1].trim();
          fieldsFound++;
        }
      } catch (err) {
        // Игнорируем ошибки отдельных полей
      }
    });

    const nestedFields = [
      { parent: 'satış', sub: ['dubai chocolate', 'Bonche'] },
      { parent: 'Ücretsiz', sub: ['G', 'K', 'M'] }
    ];

    nestedFields.forEach(({ parent, sub }) => {
      try {
        const parentRegex = new RegExp(`${parent}[^\\n]*\\(([^\\)]+)\\)`, 'i');
        const parentMatch = text.match(parentRegex);

        if (parentMatch && parentMatch[1]) {
          sub.forEach(s => {
            try {
              const subRegex = new RegExp(`•\\s*${s}\\s*-\\s*([^•\\n]+)`, 'i');
              const subMatch = parentMatch[1].match(subRegex);
              if (subMatch && subMatch[1]) {
                result[`${parent}_${s}`] = subMatch[1].trim();
                fieldsFound++;
              }
            } catch (err) {
              // Игнорируем ошибки подполей
            }
          });
        }
      } catch (err) {
        // Игнорируем ошибки родительских полей
      }
    });

    if (fieldsFound >= 1) {
      result.isValid = true;
      if (reportId && fieldsFound > 0) {
        console.log(`✅ Отчет ${reportId} распарсен успешно:`, {
          fieldsFound,
          sample: {
            tarih: result.tarih,
            satış: result.satış,
            'dubai chocolate': result['satış_dubai chocolate'],
            koz: result.koz
          }
        });
      }
    } else {
      result.errorMessage = `Найдено ${fieldsFound} полей`;
      if (reportId) {
        console.log(`❌ Отчет ${reportId} не валиден:`, {
          fieldsFound,
          errorMessage: result.errorMessage,
          textPreview: text.substring(0, 100) + '...'
        });
      }
    }

  } catch (error) {
    result.errorMessage = `Ошибка: ${error.message}`;
  }

  return result;
}

// Функция для определения локации отчета
function getLocationFromShift(shiftData, reportData, allReports) {
  if (!shiftData || !reportData) {
    return 'Неизвестно';
  }

  // Способ 1: Прямое сопоставление по shift_id
  if (reportData.shift_id) {
    const directShift = shiftData.find(shift => shift.id === reportData.shift_id);
    if (directShift) {
      return directShift.location || 'Неизвестно';
    }
  }

  // Способ 2: Поиск по дате создания отчета
  let reportDate = null;
  if (reportData.created_at) {
    reportDate = reportData.created_at.split('T')[0];
  }

  if (!reportDate) {
    return 'Неизвестно';
  }

  const shiftsOnDate = shiftData.filter(shift => {
    const shiftDate = shift.shift_date;
    return shiftDate === reportDate;
  });

  // Способ 3: Поиск по user_id и дате
  if (reportData.user_id) {
    const userShiftOnDate = shiftsOnDate.find(shift => shift.user_id === reportData.user_id);
    if (userShiftOnDate) {
      return userShiftOnDate.location || 'Неизвестно';
    }
  }

  // Способ 4: Если одна смена на дату - берем ее
  if (shiftsOnDate.length === 1) {
    return shiftsOnDate[0].location || 'Неизвестно';
  }

  return 'Неизвестно';
}

function reconstructReportText(parsed) {
  const result = `tarih - ${parsed.tarih || ""}

satış - ${parsed["satış"] || ""}
(• dubai chocolate - ${parsed["satış_dubai chocolate"] || ""}
• Bonche - ${parsed["satış_Bonche"] || ""})

Ücretsiz - ${parsed["Ücretsiz"] || ""}
(• G - ${parsed["Ücretsiz_G"] || ""}
• K - ${parsed["Ücretsiz_K"] || ""}
• M - ${parsed["Ücretsiz_M"] || ""})

Değiştirme - ${parsed["Değiştirme"] || ""}
———————————————
• koz - ${parsed["koz"] || ""}
• Elek - ${parsed["Elek"] || ""}
• nargile - ${parsed["nargile"] || ""}
• lule - ${parsed["lule"] || ""}
• kalaud - ${parsed["kalaud"] || ""}
• baca - ${parsed["baca"] || ""}
• Maşa - ${parsed["Maşa"] || ""}
• Sipsi - ${parsed["Sipsi"] || ""}`;

  console.log('🔧 Реконструированный текст:', {
    length: result.length,
    preview: result.substring(0, 200) + '...',
    fullText: result
  });

  return result;
}

function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [parsedData, setParsedData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    valid: 0, 
    invalid: 0,
    göktürk: 0,
    yenibosna: 0,
    unknown: 0
  });

  // Функция для обновления данных
  const updateData = (rowIndex, columnId, value) => {
    console.log('🔧 updateData вызвана:', { rowIndex, columnId, value, editMode });
    
    if (!editMode) {
      console.log('❌ Не в режиме редактирования');
      return;
    }
    
    const newData = [...parsedData];
    newData[rowIndex][columnId] = value;
    setParsedData(newData);
    console.log('✅ Данные обновлены');
  };

  useEffect(() => {
    console.log('🔥 ReportsPage: Загружаем данные...');
    
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        console.log('📡 Загружаем отчеты, смены и пользователей...');
        const [reportsResponse, shiftsResponse, usersResponse] = await Promise.all([
          API.get('/reports'),
          API.get('/shifts'),
          API.get('/users')
        ]);
        
        console.log('✅ Получено:', {
          reports: reportsResponse.data?.length,
          shifts: shiftsResponse.data?.length,
          users: usersResponse.data?.length
        });
        
        if (reportsResponse.data && Array.isArray(reportsResponse.data)) {
          setReports(reportsResponse.data);
          setShifts(shiftsResponse.data || []);
          setUsers(usersResponse.data || []);
          
          const userMap = {};
          (usersResponse.data || []).forEach(user => {
            userMap[user.id] = user;
          });
          
          // Парсим каждый отчет и добавляем информацию о локации
            const parsed = reportsResponse.data.map(report => {
              const parsedReport = parseReportText(report.report_text, report.id);
              
              const location = getLocationFromShift(shiftsResponse.data, report, reportsResponse.data);
              
              parsedReport.location = location;
              parsedReport.shift_id = report.shift_id;
              parsedReport.user_id = report.user_id;  // user_id уже получен через JOIN
              parsedReport.user_name = report.user_name;  // user_name уже получен через JOIN
              parsedReport.created_at = report.created_at;  // created_at из таблицы Reports
              
              return parsedReport;
            });
          
          setParsedData(parsed);
          setOriginalData(JSON.parse(JSON.stringify(parsed))); // Deep copy
          
          // Подсчитываем статистику
          const validCount = parsed.filter(p => p.isValid).length;
          const invalidCount = parsed.filter(p => !p.isValid).length;
          const göktürkCount = parsed.filter(p => p.location === 'Göktürk').length;
          const yenibosnaCount = parsed.filter(p => p.location === 'Yenibosna').length;
          const unknownLocationCount = parsed.filter(p => p.location === 'Неизвестно').length;
          
          setStats({
            total: parsed.length,
            valid: validCount,
            invalid: invalidCount,
            göktürk: göktürkCount,
            yenibosna: yenibosnaCount,
            unknown: unknownLocationCount
          });
          
        } else {
          console.error('Неверный формат данных отчетов:', reportsResponse.data);
          setParsedData([]);
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        setParsedData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Проверяем наличие изменений
  useEffect(() => {
    const hasAnyChanges = JSON.stringify(parsedData) !== JSON.stringify(originalData);
    setHasChanges(hasAnyChanges);
  }, [parsedData, originalData]);

  const toggleEditMode = () => {
    console.log('🔄 Переключение режима редактирования. Текущий editMode:', editMode);
    
    if (editMode && hasChanges) {
      const confirm = window.confirm('У вас есть несохраненные изменения. Выйти из режима редактирования?');
      if (!confirm) return;
    }
    
    if (editMode) {
      // Выход из режима редактирования - восстанавливаем оригинальные данные
      setParsedData(JSON.parse(JSON.stringify(originalData)));
    }
    
    setEditMode(!editMode);
    console.log('✅ Новый editMode:', !editMode);
  };

  // Тестовая функция на fetch
  const testSaveOneFetch = async () => {
    console.log('🧪 Тест сохранения через fetch...');
    
    try {
      // Найдем первый валидный отчет
      const validReport = parsedData.find(report => report.isValid);
      
      if (!validReport) {
        alert('Нет валидных отчетов для тестирования');
        return;
      }
      
      console.log('📝 Тестируем fetch с отчетом:', validReport.id);
      
      const testText = `tarih - 02-06-2025

satış - 175
(• dubai chocolate - 85
• Bonche - 90)

Ücretsiz - 30
(• G - 12
• K - 10
• M - 8)

Değiştirme - 6
———————————————
• koz - 3
• Elek - 2
• nargile - 2
• lule - 2
• kalaud - 2
• baca - 2
• Maşa - 2
• Sipsi - 2`;

      console.log('📡 Fetch запрос:', {
        url: `http://66.151.43.24:8000/reports/${validReport.id}`,
        method: 'PUT',
        textLength: testText.length
      });

      // Прямой fetch запрос
      const response = await fetch(`http://66.151.43.24:8000/reports/${validReport.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          report_text: testText,
          change_reason: "Тест через fetch",
          changed_fields: {"satış": {"old": "150", "new": "175"}}
        })
      });

      console.log('✅ Fetch ответ:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('✅ Данные ответа:', responseData);
      
      alert(`✅ Fetch тест успешен! Статус: ${responseData.status || 'ok'}`);
      
    } catch (error) {
      console.error('❌ Fetch тест не удался:', error);
      alert(`❌ Fetch тест не удался: ${error.message}`);
    }
  };

  // Добавьте эту функцию для тестирования
  const testSaveOne = async () => {
    console.log('🧪 Запуск тестового сохранения...');
    
    try {
      // Найдем первый валидный отчет
      const validReport = parsedData.find(report => report.isValid);
      
      if (!validReport) {
        alert('Нет валидных отчетов для тестирования');
        return;
      }
      
      console.log('📝 Тестируем с отчетом:', validReport.id);
      
      // Создаем простой тестовый текст
      const testText = `tarih - 02-06-2025

satış - 150
(• dubai chocolate - 75
• Bonche - 75)

Ücretsiz - 25
(• G - 10
• K - 8
• M - 7)

Değiştirme - 5
———————————————
• koz - 2
• Elek - 1
• nargile - 1
• lule - 1
• kalaud - 1
• baca - 1
• Maşa - 1
• Sipsi - 1`;

      console.log('📡 Отправляем тестовый запрос:', {
        reportId: validReport.id,
        textLength: testText.length,
        text: testText
      });

      // Прямой API вызов без сложной логики
      const response = await API.put(`/reports/${validReport.id}`, {
        report_text: testText,
        change_reason: "Простой тест сохранения",
        changed_fields: {"satış": {"old": "100", "new": "150"}}
      });

      console.log('✅ Тестовое сохранение успешно:', response.data);
      
      // Проверяем что ответ корректный
      if (response && response.data) {
        alert(`✅ Тест успешен! Статус: ${response.data.status || 'ok'}, Версия: ${response.data.version || 'unknown'}`);
        
        // Обновляем данные без перезагрузки
        const fetchAllData = async () => {
          try {
            const [reportsResponse, shiftsResponse, usersResponse] = await Promise.all([
              API.get('/reports'),
              API.get('/shifts'),
              API.get('/users')
            ]);
            
            // Парсим заново...
            if (reportsResponse.data && Array.isArray(reportsResponse.data)) {
              setReports(reportsResponse.data);
              // ... остальная логика парсинга
            }
          } catch (error) {
            console.error('Ошибка обновления данных:', error);
          }
        };
        
        fetchAllData();
      } else {
        alert('✅ Сохранение выполнено, но ответ сервера неожиданный');
      }
      
    } catch (error) {
      console.error('❌ Тестовое сохранение не удалось:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      alert(`❌ Тест не удался: ${error.message}`);
    }
  };

  const saveChanges = async () => {
    if (!hasChanges) {
      alert('Нет изменений для сохранения');
      return;
    }

    setSaving(true);
    
    try {
      console.log('💾 Сохраняем изменения через fetch...');
      
      // Находим измененные отчеты
      const changedReports = [];
      
      parsedData.forEach((current, index) => {
        const original = originalData[index];
        if (JSON.stringify(current) !== JSON.stringify(original)) {
          // Определяем какие поля изменились
          const changedFields = {};
          Object.keys(current).forEach(key => {
            if (current[key] !== original[key] && !['id', 'isValid', 'errorMessage', 'originalText', 'location', 'shift_id', 'user_id', 'created_at', 'user_name'].includes(key)) {
              changedFields[key] = {
                old: original[key],
                new: current[key]
              };
            }
          });
          
          changedReports.push({
            current,
            reportId: current.id,
            changedFields
          });
        }
      });

      console.log('📝 Измененные отчеты:', changedReports.length);

      let successful = 0;
      let failed = 0;
      let errors = [];

      // Сохраняем каждый отчет через fetch
      for (const { current, reportId, changedFields } of changedReports) {
        if (!current.isValid) {
          console.log(`⚠️ Пропускаем невалидный отчет ${reportId}`);
          continue;
        }

        try {
          const updatedText = reconstructReportText(current);
          
          console.log(`💾 Сохраняем отчет ${reportId} через fetch...`);
          
          // Используем fetch вместо axios
          const response = await fetch(`http://66.151.43.24:8000/reports/${reportId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              report_text: updatedText,
              change_reason: "Редактирование через парсер отчетов",
              changed_fields: changedFields
            })
          });
          
          console.log(`📡 Fetch ответ для отчета ${reportId}:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const responseData = await response.json();
          console.log(`✅ Отчет ${reportId} сохранен через fetch:`, responseData);
          successful++;
          
        } catch (error) {
          console.error(`❌ Ошибка fetch сохранения отчета ${reportId}:`, error);
          failed++;
          errors.push(`Отчет ${reportId}: ${error.message}`);
        }
      }
      
      // Показываем результаты
      if (errors.length > 0) {
        alert(`Сохранение завершено:\n✅ Успешно: ${successful}\n❌ Ошибок: ${failed}\n\nОшибки:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`);
      } else {
        alert(`✅ Все изменения сохранены успешно!\nОбновлено отчетов: ${successful}`);
      }
      
      // Обновляем оригинальные данные и выходим из режима редактирования
      if (successful > 0) {
        setOriginalData(JSON.parse(JSON.stringify(parsedData)));
        setEditMode(false);
      }
      
    } catch (error) {
      console.error('❌ Общая ошибка сохранения:', error);
      alert(`Общая ошибка сохранения: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const showAuditHistory = async (reportId) => {
    try {
      setSelectedReportId(reportId);
      const response = await API.get(`/reports/${reportId}/audit`);
      setAuditHistory(response.data);
      setShowAuditModal(true);
    } catch (error) {
      console.error('Ошибка загрузки истории аудита:', error);
      alert('Не удалось загрузить историю изменений');
    }
  };

  // Определяем колонки таблицы
  // const columns = React.useMemo(() => [
  //   { Header: 'ID', accessor: 'id', width: 50 },
  //   { 
  //     Header: '✓', 
  //     accessor: 'isValid',
  //     width: 30,
  //     Cell: ({ value }) => (
  //       <span className={value ? 'text-green-400' : 'text-red-400'}>
  //         {value ? '✅' : '❌'}
  //       </span>
  //     )
  //   },
  //   { 
  //     Header: 'Заведение', 
  //     accessor: 'location', 
  //     width: 80,
  //     Cell: ({ value }) => (
  //       <span className={`px-2 py-1 rounded text-xs font-semibold ${
  //         value === 'Göktürk' ? 'bg-blue-600 text-white' :
  //         value === 'Yenibosna' ? 'bg-green-600 text-white' :
  //         'bg-gray-600 text-gray-200'
  //       }`}>
  //         {value === 'Göktürk' ? '🏢 Göktürk' :
  //          value === 'Yenibosna' ? '🏬 Yenibosna' :
  //          '❓ ' + value}
  //       </span>
  //     )
  //   },
  //   { Header: 'Дата', accessor: 'tarih', width: 80 },
  //   { Header: 'Продажи', accessor: 'satış', width: 60 },
  //   { Header: 'Dubai Choc', accessor: 'satış_dubai chocolate', width: 70 },
  //   { Header: 'Bonche', accessor: 'satış_Bonche', width: 60 },
  //   { Header: 'Бесплатно', accessor: 'Ücretsiz', width: 70 },
  //   { Header: 'G', accessor: 'Ücretsiz_G', width: 40 },
  //   { Header: 'K', accessor: 'Ücretsiz_K', width: 40 },
  //   { Header: 'M', accessor: 'Ücretsiz_M', width: 40 },
  //   { Header: 'Замена', accessor: 'Değiştirme', width: 60 },
  //   { Header: 'Koz', accessor: 'koz', width: 40 },
  //   { Header: 'Elek', accessor: 'Elek', width: 40 },
  //   { Header: 'Nargile', accessor: 'nargile', width: 50 },
  //   { Header: 'Lule', accessor: 'lule', width: 40 },
  //   { Header: 'Kalaud', accessor: 'kalaud', width: 50 },
  //   { Header: 'Baca', accessor: 'baca', width: 40 },
  //   { Header: 'Maşa', accessor: 'Maşa', width: 40 },
  //   { Header: 'Sipsi', accessor: 'Sipsi', width: 40 }
  // ], []);

  // Заменить в ReportsPage.jsx определение колонок (const columns = React.useMemo(() => [...)

const columns = React.useMemo(() => [
    { Header: 'ID', accessor: 'id', width: 50 },
    { 
      Header: '✓', 
      accessor: 'isValid',
      width: 30,
      Cell: ({ value }) => (
        <span className={value ? 'text-green-400' : 'text-red-400'}>
          {value ? '✅' : '❌'}
        </span>
      )
    },
    { 
      Header: 'Автор', 
      accessor: 'user_name', 
      width: 100,
      Cell: ({ value, row }) => (
        <span className="text-yellow-300 font-medium text-xs">
          {value || `ID:${row.original.user_id || '?'}`}
        </span>
      )
    },
    { 
      Header: 'Дата создания', 
      accessor: 'created_at', 
      width: 120,
      Cell: ({ value }) => {
        if (!value) return <span className="text-gray-500">—</span>;
        
        try {
          const date = new Date(value);
          return (
            <div className="text-xs">
              <div className="text-blue-300 font-medium">
                {date.toLocaleDateString('ru-RU')}
              </div>
              <div className="text-gray-400">
                {date.toLocaleTimeString('ru-RU', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          );
        } catch (e) {
          return <span className="text-gray-500">{value}</span>;
        }
      }
    },
    { 
      Header: 'Заведение', 
      accessor: 'location', 
      width: 80,
      Cell: ({ value }) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          value === 'Göktürk' ? 'bg-blue-600 text-white' :
          value === 'Yenibosna' ? 'bg-green-600 text-white' :
          'bg-gray-600 text-gray-200'
        }`}>
          {value === 'Göktürk' ? '🏢 Göktürk' :
           value === 'Yenibosna' ? '🏬 Yenibosna' :
           '❓ ' + value}
        </span>
      )
    },
    { Header: 'Дата', accessor: 'tarih', width: 80 },
    { Header: 'Продажи', accessor: 'satış', width: 60 },
    { Header: 'Dubai Choc', accessor: 'satış_dubai chocolate', width: 70 },
    { Header: 'Bonche', accessor: 'satış_Bonche', width: 60 },
    { Header: 'Бесплатно', accessor: 'Ücretsiz', width: 70 },
    { Header: 'G', accessor: 'Ücretsiz_G', width: 40 },
    { Header: 'K', accessor: 'Ücretsiz_K', width: 40 },
    { Header: 'M', accessor: 'Ücretsiz_M', width: 40 },
    { Header: 'Замена', accessor: 'Değiştirme', width: 60 },
    { Header: 'Koz', accessor: 'koz', width: 40 },
    { Header: 'Elek', accessor: 'Elek', width: 40 },
    { Header: 'Nargile', accessor: 'nargile', width: 50 },
    { Header: 'Lule', accessor: 'lule', width: 40 },
    { Header: 'Kalaud', accessor: 'kalaud', width: 50 },
    { Header: 'Baca', accessor: 'baca', width: 40 },
    { Header: 'Maşa', accessor: 'Maşa', width: 40 },
    { Header: 'Sipsi', accessor: 'Sipsi', width: 40 }
  ], []);

  // Настройка defaultColumn для редактируемых ячеек
  const defaultColumn = React.useMemo(() => ({
    Cell: EditableCell,
  }), []);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns,
    data: parsedData,
    defaultColumn,
    updateData, // Передаем функцию обновления
    editMode, // Передаем флаг режима редактирования
  });

  if (loading) {
    return (
      <div className="p-8 text-white bg-gray-900 min-h-screen">
        <h2 className="text-2xl mb-4 font-bold text-center">Raporlar</h2>
        <div className="text-center py-8">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full"></div>
          <p className="mt-2">Загрузка отчетов, смен и пользователей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 text-white bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📊 Raporlar (с заведениями и аудитом)</h2>
        
        {/* Панель управления */}
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-yellow-400 text-sm">
              Есть несохраненные изменения
            </span>
          )}
          
          {/* Кнопки тестирования */}
          <button
            onClick={testSaveOne}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium"
          >
            🧪 Axios
          </button>
          
          <button
            onClick={testSaveOneFetch}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm font-medium"
          >
            🧪 Fetch
          </button>
          
          {editMode ? (
            <>
              <button
                onClick={saveChanges}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium ${
                  hasChanges && !saving
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                💾 {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={toggleEditMode}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium"
              >
                ❌ Отменить
              </button>
            </>
          ) : (
            <button
              onClick={toggleEditMode}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              ✏️ Редактировать
            </button>
          )}
          
          <span className="flex items-center gap-1 text-sm">
            {editMode ? '🔓 Редактирование' : '🔒 Просмотр'}
          </span>
        </div>
      </div>
      
      {/* Расширенная статистика */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-center">
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-lg font-bold text-blue-400">{stats.total}</div>
          <div className="text-xs text-gray-400">Всего</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-lg font-bold text-green-400">{stats.valid}</div>
          <div className="text-xs text-gray-400">Валидных</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-lg font-bold text-red-400">{stats.invalid}</div>
          <div className="text-xs text-gray-400">Ошибок</div>
        </div>
        <div className="bg-blue-800 p-3 rounded">
          <div className="text-lg font-bold text-white">{stats.göktürk}</div>
          <div className="text-xs text-blue-200">Göktürk</div>
        </div>
        <div className="bg-green-800 p-3 rounded">
          <div className="text-lg font-bold text-white">{stats.yenibosna}</div>
          <div className="text-xs text-green-200">Yenibosna</div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-lg font-bold text-gray-300">{stats.unknown}</div>
          <div className="text-xs text-gray-400">Неизвестно</div>
        </div>
      </div>

      {/* Уведомление о режиме редактирования */}
      {editMode && (
        <div className="mb-4 bg-blue-800 border border-blue-600 p-3 rounded">
          <h3 className="font-bold text-blue-200 mb-1">✏️ Режим редактирования активен</h3>
          <p className="text-blue-300 text-sm">
            Вы можете редактировать валидные отчеты. Измененные поля подсвечиваются желтым. 
            Нажмите в любую ячейку чтобы начать редактирование!
          </p>
        </div>
      )}

      {/* Предупреждение о невалидных отчетах */}
      {stats.invalid > 0 && (
        <div className="mb-4 bg-yellow-800 border border-yellow-600 p-3 rounded">
          <h3 className="font-bold text-yellow-200 mb-1">⚠️ Обнаружены невалидные отчеты</h3>
          <p className="text-yellow-300 text-sm">
            {stats.invalid} отчетов не соответствуют ожидаемому формату и не могут быть отредактированы.
          </p>
        </div>
      )}

      {/* Таблица */}
      {parsedData.length > 0 ? (
        <div className="overflow-x-auto rounded border border-gray-600">
          <table {...getTableProps()} className="min-w-full bg-gray-800 text-xs">
            <thead className="bg-gray-700">
              {headerGroups.map((headerGroup, i) => (
                <tr key={i} {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map((col, j) => (
                    <th key={j} {...col.getHeaderProps()} className="p-1 border border-gray-600 text-xs font-semibold">
                      {col.render('Header')}
                    </th>
                  ))}
                  <th className="p-1 border border-gray-600 text-xs font-semibold">История</th>
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {rows.map((row, i) => {
                prepareRow(row);
                const isInvalid = !row.original.isValid;
                return (
                  <tr 
                    key={i} 
                    {...row.getRowProps()} 
                    className={`${isInvalid ? 'bg-red-900 bg-opacity-20' : 'odd:bg-gray-750'}`}
                  >
                    {row.cells.map((cell, j) => (
                      <td key={j} {...cell.getCellProps()} className="p-1 border border-gray-600 text-center">
                        {cell.render('Cell', { 
                          editMode, 
                          updateData,
                        })}
                      </td>
                    ))}
                    <td className="p-1 border border-gray-600 text-center">
                      <button
                        onClick={() => showAuditHistory(row.original.id)}
                        className="text-blue-400 hover:text-blue-300 px-2 py-1 text-xs"
                        title="Показать историю изменений"
                      >
                        📖
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-800 rounded">
          <p className="text-gray-400">Отчеты не найдены</p>
        </div>
      )}

      {/* Модальное окно истории аудита */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-4xl max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">История изменений отчета #{selectedReportId}</h3>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ❌
              </button>
            </div>
            
            {auditHistory.length > 0 ? (
              <div className="space-y-3">
                {auditHistory.map((entry, index) => (
                  <div key={index} className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold">Версия {entry.version}</span>
                      <span className="text-sm text-gray-400">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <p><strong>Действие:</strong> {entry.action_type}</p>
                      <p><strong>Пользователь:</strong> {entry.user_name || 'Неизвестный'}</p>
                      {entry.changes_summary && (
                        <p><strong>Изменения:</strong> {entry.changes_summary}</p>
                      )}
                      {entry.change_reason && (
                        <p><strong>Причина:</strong> {entry.change_reason}</p>
                      )}
                      {entry.changed_fields && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-blue-400">Детали изменений</summary>
                          <pre className="text-xs bg-gray-600 p-2 mt-1 rounded overflow-x-auto">
                            {JSON.stringify(entry.changed_fields, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">История изменений пуста</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;