import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTable } from "react-table";
import { useSearchParams } from 'react-router-dom';
import API from "../api";
import { useLanguage } from '../contexts/LanguageContext';

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Сохранены полностью) ---

function parseReportTextInternal(text, reportId) {
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

  if (!text || typeof text !== 'string' || text.trim().length === 0) return result;
  const cleanValue = (val) => val ? val.replace(/[_]+/g, '').trim() : '';

  try {
    let fieldsFound = 0;
    const mainFields = ['tarih', 'satış', 'Ücretsiz', 'Değiştirme', 'koz', 'Elek', 'nargile', 'lule', 'kalaud', 'baca', 'Maşa', 'Sipsi'];
    mainFields.forEach(field => {
      try {
        const regex = new RegExp(`${field}\\s*[-—–:]\\s*([^\\n\\(]+)`, 'i');
        const match = text.match(regex);
        if (match && match[1]) { 
            result[field] = cleanValue(match[1]); 
            fieldsFound++; 
        }
      } catch (err) {}
    });
    const dubaiMatch = text.match(/dubai chocolate\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (dubaiMatch) result['satış_dubai chocolate'] = dubaiMatch[1];
    const boncheMatch = text.match(/Bonche\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (boncheMatch) result['satış_Bonche'] = boncheMatch[1];
    const gMatch = text.match(/•\s*G\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (gMatch) result['Ücretsiz_G'] = gMatch[1];
    const kMatch = text.match(/•\s*K\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (kMatch) result['Ücretsiz_K'] = kMatch[1];
    const mMatch = text.match(/•\s*M\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (mMatch) result['Ücretsiz_M'] = mMatch[1];
    if (fieldsFound >= 1) result.isValid = true;
  } catch (error) {}
  return result;
}

function getLocationFromShift(shiftData, reportData) {
  if (!shiftData || !reportData) return 'Unknown';
  if (reportData.shift_id) {
    const directShift = shiftData.find(shift => shift.id === reportData.shift_id);
    if (directShift) return directShift.location || 'Unknown';
  }
  return 'Unknown';
}

function reconstructReportText(parsed) {
  return `tarih - ${parsed.tarih || ""}
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
}

// --- КОМПОНЕНТ ЯЧЕЙКИ (Построчное редактирование) ---
const EditableCell = ({ value: initialValue, row, column, updateData, isEditing }) => {
  const [value, setValue] = useState(initialValue);

  // Синхронизация при изменении initialValue или режима редактирования
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isEditing]);

  const onChange = e => {
    setValue(e.target.value);
    updateData(row.index, column.id, e.target.value);
  };

  if (!isEditing) {
    return <span>{value || "—"}</span>;
  }

  return (
    <input
      value={value || ""}
      onChange={onChange}
      className="bg-gray-800 text-white p-1 w-full text-xs border border-blue-500 rounded focus:outline-none"
    />
  );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---
function ReportsPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const rowRefs = useRef({});

  // Данные
  const [parsedData, setParsedData] = useState([]);
  const [originalData, setOriginalData] = useState([]); // Для отмены
  const [loading, setLoading] = useState(true);

  // Состояния для UI
  const [editingId, setEditingId] = useState(null); // ID редактируемой строки (null = нет)
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);

  // Фильтры и Пагинация
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'doubles', 'no_sales'
  const [dashboardFilter, setDashboardFilter] = useState(null); // { type: 'status'|'location', value: '...' }
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { t } = useLanguage();

  // Обновление ячейки (только для редактируемой строки)
  const updateData = (rowIndex, columnId, value) => {
    const newData = [...parsedData];
    // Важно: rowIndex здесь относительный (от текущей страницы), 
    // но parsedData хранит всё.
    // React-table передает row.index, который обычно абсолютный в рамках data.
    // Проверим, row.index совпадает с реальным индексом в parsedData? 
    // Да, если мы передаем filteredData в useTable, то row.index будет индексом в filteredData.
    // ПОЭТОМУ: Чтобы не запутаться, мы будем обновлять parsedData по ID строки.
    // Но EditableCell вызывает updateData(row.index...), это стандарт react-table.
    // Исправим: будем искать элемент в parsedData по ID строки.
    
    // Получаем реальный ID отчета из filteredData (который передан в таблицу)
    const reportId = filteredData[rowIndex].id;
    
    const realIndex = parsedData.findIndex(r => r.id === reportId);
    if (realIndex !== -1) {
        newData[realIndex][columnId] = value;
        setParsedData(newData);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [reportsResponse, shiftsResponse] = await Promise.all([
          API.get('/reports'),
          API.get('/shifts')
        ]);
        
        if (reportsResponse.data && Array.isArray(reportsResponse.data)) {
          const parsed = reportsResponse.data.map(report => {
            const parsedReport = parseReportTextInternal(report.report_text, report.id);
            const location = getLocationFromShift(shiftsResponse.data, report);
            parsedReport.location = location;
            parsedReport.shift_id = report.shift_id;
            parsedReport.user_id = report.user_id;
            parsedReport.user_name = report.user_name;
            parsedReport.created_at = report.created_at;
            return parsedReport;
          });
          
          // Сортировка по дате (свежие сверху)
          parsed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          setParsedData(parsed);
          setOriginalData(JSON.parse(JSON.stringify(parsed)));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Статистика (вычисляется всегда по полным данным)
  const stats = useMemo(() => {
      return {
        total: parsedData.length,
        valid: parsedData.filter(p => p.isValid).length,
        invalid: parsedData.filter(p => !p.isValid).length,
        göktürk: parsedData.filter(p => p.location === 'Göktürk').length,
        yenibosna: parsedData.filter(p => p.location === 'Yenibosna').length,
        unknown: parsedData.filter(p => p.location === 'Unknown' || !p.location).length
      };
  }, [parsedData]);

  // Фильтрация данных
  const filteredData = useMemo(() => {
    let data = [...parsedData];

    // 1. Фильтр верхнего уровня (Кнопки "Все", "Дубли", "Нет продаж")
    if (filterMode === 'doubles') {
         // Логика дублей
         const groups = {};
         data.forEach(item => {
             if (!item.location || !item.tarih) return;
             const cleanDate = item.tarih.replace(/^0+/, '').trim();
             const key = `${item.location}_${cleanDate}`;
             if (!groups[key]) groups[key] = [];
             groups[key].push(item);
         });
         data = Object.values(groups).filter(g => g.length > 1).flat();
         data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (filterMode === 'no_sales') {
         data = data.filter(item => {
             const sales = parseInt(item['satış']);
             return item.isValid && (isNaN(sales) || sales === 0);
         });
    }

    // 2. Фильтр Дашборда (клик по карточкам)
    if (dashboardFilter) {
        if (dashboardFilter.type === 'status') {
            const isValid = dashboardFilter.value === 'valid';
            data = data.filter(item => item.isValid === isValid);
        } else if (dashboardFilter.type === 'location') {
            data = data.filter(item => {
                if (dashboardFilter.value === 'Unknown') return !item.location || item.location === 'Unknown';
                return item.location === dashboardFilter.value;
            });
        }
    }

    return data;
  }, [parsedData, filterMode, dashboardFilter]);

  // Пагинация
  const paginatedData = useMemo(() => {
      if (itemsPerPage === 'all') return filteredData;
      const start = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(filteredData.length / itemsPerPage);

  // Сброс страницы при смене фильтров
  useEffect(() => {
      setCurrentPage(1);
  }, [filterMode, dashboardFilter, itemsPerPage]);

  // --- ДЕЙСТВИЯ ---
  const handleEditRow = (id) => {
      setEditingId(id);
  };

  const handleCancelRow = (id) => {
      // Восстанавливаем данные этой строки из originalData
      const originalRow = originalData.find(r => r.id === id);
      if (originalRow) {
          setParsedData(prev => prev.map(r => r.id === id ? { ...originalRow } : r));
      }
      setEditingId(null);
  };

  const handleSaveRow = async (id) => {
      const currentReport = parsedData.find(r => r.id === id);
      const originalReport = originalData.find(r => r.id === id);
      
      if (!currentReport) return;

      // Вычисляем изменения
      const changedFields = {};
      Object.keys(currentReport).forEach(key => {
          if (currentReport[key] !== originalReport[key]) {
             changedFields[key] = { old: originalReport[key], new: currentReport[key] };
          }
      });

      // Если нет изменений, просто выходим
      if (Object.keys(changedFields).length === 0) {
          setEditingId(null);
          return;
      }

      try {
          const updatedText = reconstructReportText(currentReport);
          await API.put(`/reports/${id}`, {
              report_text: updatedText,
              change_reason: "Web Row Edit",
              changed_fields: changedFields
          });
          
          // Обновляем "оригинал" на клиенте, чтобы считать это новым состоянием
          setOriginalData(prev => prev.map(r => r.id === id ? { ...currentReport } : r));
          setEditingId(null);
      } catch (error) {
          console.error(error);
          alert("Ошибка сохранения");
      }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm(t('dash_confirm_finish') + "?")) return;
    try {
      await API.delete(`/reports/${reportId}`);
      setParsedData(prev => prev.filter(item => item.id !== reportId));
      setOriginalData(prev => prev.filter(item => item.id !== reportId));
    } catch (error) {
      alert("Error deleting");
    }
  };

  const showAuditHistory = async (reportId) => {
    try {
      setSelectedReportId(reportId);
      const response = await API.get(`/reports/${reportId}/audit`);
      setAuditHistory(response.data);
      setShowAuditModal(true);
    } catch (error) {
      alert("Error loading history");
    }
  };

  // Колонки таблицы
  const columns = React.useMemo(() => [
    { Header: t('col_id'), accessor: 'id', width: 50 },
    { 
      Header: t('col_valid'), 
      accessor: 'isValid',
      width: 40,
      Cell: ({ value }) => (
        <div className={`w-3 h-3 rounded-full mx-auto ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
      )
    },
    { 
      Header: t('col_date_created'), 
      accessor: 'created_at', 
      width: 100,
      Cell: ({ value }) => {
        if (!value) return "—";
        const d = new Date(value);
        return <span className="text-xs text-blue-300">{d.toLocaleDateString()}</span>;
      }
    },
    { 
      Header: t('col_location'), 
      accessor: 'location', 
      width: 60,
      Cell: ({ value }) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            value === 'Göktürk' ? 'bg-blue-900 text-blue-300' :
            value === 'Yenibosna' ? 'bg-green-900 text-green-300' : 'bg-gray-700'
        }`}>{value === 'Göktürk' ? 'GK' : value === 'Yenibosna' ? 'YB' : '?'}</span>
      )
    },
    { Header: t('col_date_report'), accessor: 'tarih', width: 80 },
    { Header: t('col_sales'), accessor: 'satış', width: 60 },
    { Header: t('col_dubai'), accessor: 'satış_dubai chocolate', width: 70 },
    { Header: t('col_bonche'), accessor: 'satış_Bonche', width: 60 },
    { Header: t('col_free'), accessor: 'Ücretsiz', width: 70 },
    { Header: t('col_replace'), accessor: 'Değiştirme', width: 60 },
  ], [t]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns, 
    data: paginatedData, // Используем пагинированные данные!
    defaultColumn: { Cell: EditableCell },
    updateData,
    // Мы передаем editingId не в useTable options (так не работает стандартно),
    // а используем его внутри Cell renderer, который имеет доступ к closure.
    // Но так как EditableCell вынесен наружу, мы передаем isEditing через prepareRow -> row.
    // Или проще: передать editingId в column.Cell renderer? Нет.
    // Лучший способ: передать editingId в options и использовать useTable hook extension или Context.
    // Но для простоты, мы изменим EditableCell, чтобы он принимал isEditing как проп.
  });

  if (loading) return <div className="p-8 text-white text-center">{t('loading')}</div>;

  // Компонент карточки-фильтра
  const StatCard = ({ title, value, onClick, isActive, color }) => (
      <button 
          onClick={onClick}
          className={`p-3 rounded border flex flex-col items-center justify-center min-w-[100px] transition-all
              ${isActive ? `bg-${color}-900/40 border-${color}-500 ring-1 ring-${color}-400` : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}
          `}
      >
          <span className={`text-xl font-bold text-${color}-400`}>{value}</span>
          <span className="text-[10px] uppercase text-gray-500 font-bold">{title}</span>
      </button>
  );

  return (
    <div className="p-4 text-white bg-gray-900 min-h-screen">
      <div className="flex flex-col gap-4 mb-6">
        <h2 className="text-xl font-bold">{t('rep_title')}</h2>
        
        {/* КНОПКИ ДАШБОРДА (ФИЛЬТРЫ) */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <StatCard 
                title={t('stats_total')} 
                value={stats.total} 
                color="white"
                isActive={!dashboardFilter && filterMode === 'all'}
                onClick={() => { setDashboardFilter(null); setFilterMode('all'); }}
            />
            <StatCard 
                title={t('stats_valid')} 
                value={stats.valid} 
                color="green" 
                isActive={dashboardFilter?.value === 'valid'}
                onClick={() => setDashboardFilter({ type: 'status', value: 'valid' })}
            />
            <StatCard 
                title={t('stats_invalid')} 
                value={stats.invalid} 
                color="red" 
                isActive={dashboardFilter?.value === 'invalid'}
                onClick={() => setDashboardFilter({ type: 'status', value: 'invalid' })}
            />
            <StatCard 
                title="Göktürk" 
                value={stats.göktürk} 
                color="blue" 
                isActive={dashboardFilter?.value === 'Göktürk'}
                onClick={() => setDashboardFilter({ type: 'location', value: 'Göktürk' })}
            />
            <StatCard 
                title="Yenibosna" 
                value={stats.yenibosna} 
                color="green" 
                isActive={dashboardFilter?.value === 'Yenibosna'}
                onClick={() => setDashboardFilter({ type: 'location', value: 'Yenibosna' })}
            />
            <StatCard 
                title={t('stats_unknown')} 
                value={stats.unknown} 
                color="gray" 
                isActive={dashboardFilter?.value === 'Unknown'}
                onClick={() => setDashboardFilter({ type: 'location', value: 'Unknown' })}
            />
        </div>
        
        {/* ВТОРОЙ РЯД ФИЛЬТРОВ */}
        <div className="flex gap-2 text-xs">
            <button 
                onClick={() => setFilterMode('doubles')}
                className={`px-3 py-1 rounded border ${filterMode === 'doubles' ? 'bg-orange-900 border-orange-500 text-orange-200' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            >
                {t('rep_filter_doubles')}
            </button>
            <button 
                onClick={() => setFilterMode('no_sales')}
                className={`px-3 py-1 rounded border ${filterMode === 'no_sales' ? 'bg-red-900 border-red-500 text-red-200' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            >
                {t('rep_filter_no_sales')}
            </button>
             {(filterMode !== 'all' || dashboardFilter) && (
                <button 
                    onClick={() => { setFilterMode('all'); setDashboardFilter(null); }}
                    className="px-3 py-1 rounded text-gray-400 hover:text-white underline"
                >
                    {t('filter_reset')}
                </button>
            )}
        </div>
      </div>

      <div className="bg-gray-800 rounded border border-gray-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
            <table {...getTableProps()} className="min-w-full text-xs text-left">
            <thead className="bg-gray-700 text-gray-300 uppercase font-semibold">
                {headerGroups.map(hg => (
                <tr {...hg.getHeaderGroupProps()}>
                    {hg.headers.map(col => (
                    <th {...col.getHeaderProps()} className="p-3 border-b border-gray-600">{col.render('Header')}</th>
                    ))}
                    <th className="p-3 border-b border-gray-600 text-center w-20">Действия</th>
                </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.length > 0 ? rows.map(row => {
                prepareRow(row);
                const isEditing = editingId === row.original.id;
                
                return (
                    <tr {...row.getRowProps()} className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${isEditing ? 'bg-blue-900/20' : ''}`}>
                    {row.cells.map(cell => (
                        <td {...cell.getCellProps()} className="p-2 border-r border-gray-700 last:border-0">
                             {/* Передаем isEditing пропсом вручную в рендер ячейки */}
                             {cell.render('Cell', { isEditing, updateData })}
                        </td>
                    ))}
                    <td className="p-2 text-center flex items-center justify-center gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={() => handleSaveRow(row.original.id)} className="bg-green-600 hover:bg-green-500 text-white p-1 rounded" title={t('btn_save_row')}>✓</button>
                                <button onClick={() => handleCancelRow(row.original.id)} className="bg-red-600 hover:bg-red-500 text-white p-1 rounded" title={t('btn_cancel_row')}>✕</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleEditRow(row.original.id)} className="text-gray-400 hover:text-white p-1" title={t('btn_edit_row')}>✏️</button>
                                <button onClick={() => showAuditHistory(row.original.id)} className="text-gray-400 hover:text-blue-300 p-1">🕒</button>
                                <button onClick={() => deleteReport(row.original.id)} className="text-gray-400 hover:text-red-500 p-1">🗑️</button>
                            </>
                        )}
                    </td>
                    </tr>
                );
                }) : (
                    <tr>
                        <td colSpan={columns.length + 1} className="p-8 text-center text-gray-500">
                            Нет данных для отображения
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>

        {/* ПАГИНАЦИЯ */}
        <div className="bg-gray-750 border-t border-gray-700 p-3 flex justify-between items-center text-xs text-gray-400">
            <div className="flex items-center gap-2">
                <span>{t('rows_per_page')}</span>
                <select 
                    value={itemsPerPage} 
                    onChange={e => setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="bg-gray-800 border border-gray-600 rounded px-1"
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">Все</option>
                </select>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
                >
                    &lt;
                </button>
                <span>{currentPage} {t('page_of')} {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"
                >
                    &gt;
                </button>
            </div>
            
            <div>Всего: {filteredData.length}</div>
        </div>
      </div>
      
      {/* МОДАЛКА ИСТОРИИ (Audit) - без изменений */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
           <div className="bg-gray-800 p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
               <div className="flex justify-between mb-4">
                   <h3 className="font-bold">{t('audit_title')}</h3>
                   <button onClick={() => setShowAuditModal(false)}>✕</button>
               </div>
               {/* Рендер истории (как был) */}
               <div className="space-y-2">
                   {auditHistory.map((item, i) => (
                       <div key={i} className="text-xs bg-gray-700 p-2 rounded">
                           <div className="font-bold">{item.action_type} - {new Date(item.created_at).toLocaleString()}</div>
                           <div>{item.user_name}</div>
                       </div>
                   ))}
               </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;