import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTable } from "react-table";
import { useSearchParams } from 'react-router-dom';
import API from "../api";
import { useLanguage } from '../contexts/LanguageContext';

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ПАРСИНГ) ---

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

  // Хелпер для очистки значения от мусора (___)
  const cleanValue = (val) => val ? val.replace(/[_]+/g, '').trim() : '';

  try {
    let fieldsFound = 0;
    const mainFields = ['tarih', 'satış', 'Ücretsiz', 'Değiştirme', 'koz', 'Elek', 'nargile', 'lule', 'kalaud', 'baca', 'Maşa', 'Sipsi'];
    
    mainFields.forEach(field => {
      try {
        // Поддержка разных тире и двоеточий
        const regex = new RegExp(`${field}\\s*[-—–:]\\s*([^\\n\\(]+)`, 'i');
        const match = text.match(regex);
        if (match && match[1]) { 
            result[field] = cleanValue(match[1]); 
            fieldsFound++; 
        }
      } catch (err) {}
    });

    // Dubai Chocolate
    const dubaiMatch = text.match(/dubai chocolate\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (dubaiMatch) result['satış_dubai chocolate'] = dubaiMatch[1];

    // Bonche
    const boncheMatch = text.match(/Bonche\s*[-—–:]\s*[_\\s]*(\d+)/i);
    if (boncheMatch) result['satış_Bonche'] = boncheMatch[1];
    
    // Бесплатные (G, K, M)
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

// --- КОМПОНЕНТ ЯЧЕЙКИ ---

const EditableCell = ({ value: initialValue, row, column, updateData, editMode }) => {
  const [value, setValue] = useState(initialValue);
  const [originalValue] = useState(initialValue);

  const onChange = e => {
    setValue(e.target.value);
    updateData(row.index, column.id, e.target.value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const isChanged = value !== originalValue;

  if (!editMode) {
    return (
      <span className={`${isChanged ? 'text-yellow-400 font-medium' : ''}`}>
        {value || "—"}
      </span>
    );
  }

  return (
    <input
      value={value || ""}
      onChange={onChange}
      className={`bg-gray-900 text-white p-1 w-full text-xs border ${
        isChanged ? 'border-yellow-500' : 'border-gray-600'
      } rounded focus:border-blue-500 focus:outline-none transition-colors`}
      disabled={!row.original.isValid}
      placeholder={!row.original.isValid ? '—' : ''}
    />
  );
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---

function ReportsPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const rowRefs = useRef({});

  const [parsedData, setParsedData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0, göktürk: 0, yenibosna: 0, unknown: 0 });
  const [filterMode, setFilterMode] = useState('all'); 
  
  const { t } = useLanguage();

  const updateData = (rowIndex, columnId, value) => {
    if (!editMode) return;
    if (filterMode !== 'all') {
        alert("Редактирование доступно только в режиме 'Все отчеты' (во избежание путаницы индексов)");
        return;
    }
    const newData = [...parsedData];
    newData[rowIndex][columnId] = value;
    setParsedData(newData);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [reportsResponse, shiftsResponse, usersResponse] = await Promise.all([
          API.get('/reports'),
          API.get('/shifts'),
          API.get('/users')
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
          
          setParsedData(parsed);
          setOriginalData(JSON.parse(JSON.stringify(parsed)));
          
          setStats({
            total: parsed.length,
            valid: parsed.filter(p => p.isValid).length,
            invalid: parsed.filter(p => !p.isValid).length,
            göktürk: parsed.filter(p => p.location === 'Göktürk').length,
            yenibosna: parsed.filter(p => p.location === 'Yenibosna').length,
            unknown: parsed.filter(p => p.location === 'Неизвестно' || p.location === 'Unknown').length
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Эффект скролла
  useEffect(() => {
    if (highlightId && !loading && parsedData.length > 0) {
      setFilterMode('all'); 
      const id = parseInt(highlightId);
      if (rowRefs.current[id]) {
        setTimeout(() => {
             rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [highlightId, loading, parsedData.length]);

  useEffect(() => {
    setHasChanges(JSON.stringify(parsedData) !== JSON.stringify(originalData));
  }, [parsedData, originalData]);

  // --- ЛОГИКА ФИЛЬТРАЦИИ И СОРТИРОВКИ ---
  const filteredData = useMemo(() => {
      // 1. Сначала сортируем весь массив по дате создания (свежие сверху)
      // Это нужно для режима 'all' и 'no_sales'
      let baseData = [...parsedData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (filterMode === 'all') return baseData;

      if (filterMode === 'doubles') {
          // Группировка
          const groups = {};
          
          parsedData.forEach(item => {
              if (!item.location || !item.tarih || item.location === 'Unknown') return;
              // Нормализуем дату: убираем нули, чтобы 05 и 5 были одним и тем же
              const cleanDate = item.tarih.replace(/^0+/, '').trim();
              const key = `${item.location}_${cleanDate}`;
              
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
          });

          // Фильтруем группы, где > 1 элемента
          const doubleGroups = Object.values(groups).filter(g => g.length > 1);

          // Сортируем группы: наверху та группа, у которой "самый свежий" отчет новее
          doubleGroups.sort((groupA, groupB) => {
              // Находим максимальную дату создания в группе А и Б
              const maxDateA = Math.max(...groupA.map(i => new Date(i.created_at).getTime()));
              const maxDateB = Math.max(...groupB.map(i => new Date(i.created_at).getTime()));
              return maxDateB - maxDateA;
          });

          // Внутри каждой группы тоже сортируем по убыванию даты создания (чтобы свежий дубликат был первым)
          doubleGroups.forEach(group => {
              group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          });

          // Разворачиваем группы в один список (flat)
          return doubleGroups.flat();
      }

      if (filterMode === 'no_sales') {
          return baseData.filter(item => {
              if (!item.isValid) return false; 
              const sales = parseInt(item['satış']);
              return isNaN(sales) || sales === 0;
          });
      }

      return baseData;
  }, [parsedData, filterMode]);

  const toggleEditMode = () => {
    if (filterMode !== 'all') {
        alert("Переключитесь на 'Все отчеты' для редактирования");
        return;
    }
    if (editMode && hasChanges) {
      if (!window.confirm(t('rep_unsaved') + "?")) return;
    }
    if (editMode) {
      setParsedData(JSON.parse(JSON.stringify(originalData)));
    }
    setEditMode(!editMode);
  };

  const saveChanges = async () => {
    if (!hasChanges) return;
    setSaving(true);
    
    try {
      const changedReports = [];
      parsedData.forEach((current, index) => {
        const original = originalData[index];
        if (JSON.stringify(current) !== JSON.stringify(original)) {
          const changedFields = {};
          Object.keys(current).forEach(key => {
            if (current[key] !== original[key] && !['id', 'isValid', 'errorMessage', 'originalText', 'location', 'shift_id', 'user_id', 'created_at', 'user_name'].includes(key)) {
              changedFields[key] = { old: original[key], new: current[key] };
            }
          });
          changedReports.push({ current, reportId: current.id, changedFields });
        }
      });

      let successful = 0;
      for (const { current, reportId, changedFields } of changedReports) {
        if (!current.isValid) continue;
        try {
          const updatedText = reconstructReportText(current);
          await API.put(`/reports/${reportId}`, {
            report_text: updatedText,
            change_reason: "Web Edit",
            changed_fields: changedFields
          });
          successful++;
        } catch (error) {
          console.error(`Error saving report ${reportId}:`, error);
        }
      }
      
      if (successful > 0) {
        setOriginalData(JSON.parse(JSON.stringify(parsedData)));
        setEditMode(false);
        alert(`${t('stats_valid')}: ${successful}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот отчет? Это действие нельзя отменить.")) {
      return;
    }
    try {
      await API.delete(`/reports/${reportId}`);
      setParsedData(prev => prev.filter(item => item.id !== reportId));
      setOriginalData(prev => prev.filter(item => item.id !== reportId));
      setStats(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (error) {
      console.error(error);
      alert("Ошибка при удалении");
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

  const columns = React.useMemo(() => [
    { Header: t('col_id'), accessor: 'id', width: 50 },
    { 
      Header: t('col_valid'), 
      accessor: 'isValid',
      width: 30,
      Cell: ({ value }) => (
        <div className={`w-3 h-3 rounded-full mx-auto ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
      )
    },
    { 
      Header: t('col_author'), 
      accessor: 'user_name', 
      width: 100,
      Cell: ({ value, row }) => (
        <span className="text-yellow-200 text-xs">{value || `ID:${row.original.user_id}`}</span>
      )
    },
    { 
      Header: t('col_date_created'), 
      accessor: 'created_at', 
      width: 120,
      Cell: ({ value }) => {
        if (!value) return "—";
        try {
          const date = new Date(value);
          return (
            <div className="text-xs">
              <div className="text-blue-300">{date.toLocaleDateString()}</div>
              <div className="text-gray-500">{date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
          );
        } catch (e) { return value; }
      }
    },
    { 
      Header: t('col_location'), 
      accessor: 'location', 
      width: 80,
      Cell: ({ value }) => (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
          value === 'Göktürk' ? 'border-blue-500 text-blue-400' :
          value === 'Yenibosna' ? 'border-green-500 text-green-400' :
          'border-gray-600 text-gray-400'
        }`}>
          {value === 'Göktürk' ? 'GK' : value === 'Yenibosna' ? 'YB' : '?'}
        </span>
      )
    },
    { Header: t('col_date_report'), accessor: 'tarih', width: 80 },
    { Header: t('col_sales'), accessor: 'satış', width: 60 },
    { Header: t('col_dubai'), accessor: 'satış_dubai chocolate', width: 70 },
    { Header: t('col_bonche'), accessor: 'satış_Bonche', width: 60 },
    { Header: t('col_free'), accessor: 'Ücretsiz', width: 70 },
    { Header: t('col_replace'), accessor: 'Değiştirme', width: 60 },
    { Header: "Koz", accessor: 'koz', width: 40 },
    { Header: "Elek", accessor: 'Elek', width: 40 },
    { Header: "Nargile", accessor: 'nargile', width: 50 },
    { Header: "Kalaud", accessor: 'kalaud', width: 50 },
    { Header: "Sipsi", accessor: 'Sipsi', width: 40 }
  ], [t]);

  const defaultColumn = React.useMemo(() => ({ Cell: EditableCell }), []);
  
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns, data: filteredData, defaultColumn, updateData, editMode
  });

  if (loading) return <div className="p-8 text-white text-center">{t('loading')}</div>;

  return (
    <div className="p-4 text-white bg-gray-900 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold">{t('rep_title')}</h2>
        
        {/* КНОПКИ ФИЛЬТРАЦИИ */}
        <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
            <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                {t('rep_filter_all')} ({parsedData.length})
            </button>
            <button
                onClick={() => setFilterMode('doubles')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${filterMode === 'doubles' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                {t('rep_filter_doubles')}
            </button>
            <button
                onClick={() => setFilterMode('no_sales')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${filterMode === 'no_sales' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
                {t('rep_filter_no_sales')}
            </button>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-yellow-500 text-xs font-bold uppercase tracking-wide animate-pulse">{t('rep_unsaved')}</span>}
          
          <button onClick={toggleEditMode} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${editMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {editMode ? t('rep_cancel_btn') : t('rep_edit_mode')}
          </button>
          
          {editMode && (
            <button onClick={saveChanges} disabled={!hasChanges || saving} className={`px-4 py-2 rounded text-sm font-medium transition-colors ${hasChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
              {saving ? t('rep_saving') : t('rep_save_btn')}
            </button>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        {[
          { label: t('stats_total'), val: stats.total, color: 'text-white' },
          { label: t('stats_valid'), val: stats.valid, color: 'text-green-400' },
          { label: t('stats_invalid'), val: stats.invalid, color: 'text-red-400' },
          { label: 'Göktürk', val: stats.göktürk, color: 'text-blue-400' },
          { label: 'Yenibosna', val: stats.yenibosna, color: 'text-green-400' },
          { label: t('stats_unknown'), val: stats.unknown, color: 'text-gray-400' }
        ].map((item, idx) => (
          <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-700 text-center">
            <div className={`text-xl font-bold ${item.color}`}>{item.val}</div>
            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-gray-700">
        <table {...getTableProps()} className="min-w-full bg-gray-800 text-xs">
          <thead className="bg-gray-700">
            {headerGroups.map(hg => (
              <tr {...hg.getHeaderGroupProps()}>
                {hg.headers.map(col => (
                  <th {...col.getHeaderProps()} className="p-2 border-b border-gray-600 text-left font-semibold text-gray-300">{col.render('Header')}</th>
                ))}
                <th className="p-2 border-b border-gray-600 text-center w-10"></th>
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.length > 0 ? rows.map(row => {
              prepareRow(row);
              const isHighlighted = highlightId && row.original.id === parseInt(highlightId);
              return (
                <tr 
                    {...row.getRowProps()} 
                    ref={(el) => (rowRefs.current[row.original.id] = el)}
                    className={`
                        border-b border-gray-700 hover:bg-gray-750 transition-colors duration-500
                        ${!row.original.isValid ? 'bg-red-900/10' : ''}
                        ${isHighlighted ? 'bg-blue-600/30 animate-pulse ring-2 ring-blue-500 inset-0 z-10' : ''} 
                    `}
                >
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()} className="p-2 border-r border-gray-700 last:border-r-0">
                      {cell.render('Cell', { editMode, updateData })}
                    </td>
                  ))}
                  <td className="p-2 text-center flex items-center justify-center gap-2">
                    <button 
                        onClick={() => showAuditHistory(row.original.id)} 
                        className="text-gray-400 hover:text-blue-400 transition-colors p-1" 
                        title={t('col_history')}
                    >
                      🕒
                    </button>
                    <button 
                        onClick={() => deleteReport(row.original.id)} 
                        className="text-gray-400 hover:text-red-500 transition-colors p-1" 
                        title={t('btn_delete')}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            }) : (
                <tr>
                    <td colSpan={columns.length + 1} className="p-8 text-center text-gray-500">
                        {filterMode === 'doubles' ? t('rep_doubles_found') + ": 0" : "Данных нет"}
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAuditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-gray-600 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-lg font-bold">{t('audit_title')} #{selectedReportId}</h3>
              <button onClick={() => setShowAuditModal(false)} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>
             {auditHistory.length > 0 ? (
              <div className="space-y-4">
                {auditHistory.map((entry, index) => (
                  <div key={index} className="bg-gray-700/50 p-4 rounded border border-gray-600">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-900 text-blue-200 px-2 py-0.5 rounded text-xs font-bold">V{entry.version}</span>
                        <span className="text-sm font-medium">{entry.user_name || 'Admin'}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    
                    <div className="text-sm space-y-1 text-gray-300">
                      <div><span className="text-gray-500">{t('audit_action')}:</span> {entry.action_type}</div>
                      {entry.change_reason && <div><span className="text-gray-500">{t('audit_reason')}:</span> {entry.change_reason}</div>}
                      
                      {entry.changed_fields && (
                        <div className="mt-3 bg-gray-900 p-3 rounded text-xs font-mono overflow-x-auto border border-gray-700">
                          {JSON.stringify(JSON.parse(entry.changed_fields), null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">{t('audit_empty')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;