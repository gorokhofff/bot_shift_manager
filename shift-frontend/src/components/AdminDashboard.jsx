import React, { useState, useEffect } from 'react';
import API from '../api';

const AdminDashboard = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 0 });

  useEffect(() => {
    API.get('/tables').then(res => {
        setTables(res.data.sort());
        if(res.data.length > 0) setSelectedTable(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (selectedTable) fetchTableData();
  }, [selectedTable, pagination.page]);

  const fetchTableData = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/tables/${selectedTable}?page=${pagination.page}&page_size=${pagination.pageSize}&search=${searchTerm}`);
      setTableData(res.data.data || []);
      setPagination(prev => ({ ...prev, total: res.data.total || 0, pages: res.data.pages || 0 }));
      if (res.data.data?.length > 0) setColumns(Object.keys(res.data.data[0]));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleCellSave = async (rowIndex, columnName) => {
    const row = tableData[rowIndex];
    try {
        await API.put(`/tables/${selectedTable}`, { updates: [{ original: row, changes: { [columnName]: editValue } }] });
        setTableData(prev => {
            const newData = [...prev];
            newData[rowIndex] = { ...row, [columnName]: editValue };
            return newData;
        });
        setEditingCell(null);
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-3xl font-bold text-white tracking-tight">Database Admin</h1>
      </div>

      <div className="card-surface p-4 shrink-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
            <select 
                value={selectedTable} 
                onChange={e => setSelectedTable(e.target.value)}
                className="table-input h-12"
            >
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
        <div className="lg:col-span-8 flex gap-3">
             <input 
                type="text" 
                placeholder="Search records..." 
                className="table-input h-12 flex-1"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
             <button onClick={fetchTableData} className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Search</button>
        </div>
      </div>

      <div className="card-surface flex-1 overflow-hidden flex flex-col border border-gray-700">
         <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="sticky top-0 bg-gray-800 text-gray-400 text-xs uppercase z-10 shadow-sm">
                    <tr>
                        {columns.map(c => <th key={c} className="p-3 border-b border-gray-700 font-bold whitespace-nowrap">{c}</th>)}
                        <th className="p-3 border-b border-gray-700">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {loading ? (
                        <tr><td colSpan={columns.length + 1} className="p-10 text-center text-gray-500">Loading...</td></tr>
                    ) : tableData.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-gray-700/20 transition-colors">
                            {columns.map(col => {
                                const isEditing = editingCell === `${rIdx}-${col}`;
                                return (
                                    <td key={col} className="p-2 border-r border-gray-700/30 max-w-[200px] truncate" title={String(row[col])}>
                                        {isEditing ? (
                                            <input 
                                                autoFocus
                                                className="w-full bg-gray-900 text-white p-1 rounded border border-blue-500 outline-none"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => handleCellSave(rIdx, col)}
                                                onKeyDown={e => e.key === 'Enter' && handleCellSave(rIdx, col)}
                                            />
                                        ) : (
                                            <div onClick={() => { setEditingCell(`${rIdx}-${col}`); setEditValue(row[col]); }} className="cursor-pointer hover:text-blue-400 truncate">
                                                {row[col] === null ? <span className="text-gray-600 italic">null</span> : String(row[col])}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-center">
                                <button className="text-red-400 hover:text-red-300 p-1">Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
         {/* Pagination Footer */}
         <div className="p-3 border-t border-gray-700 bg-gray-800 flex justify-between items-center text-xs text-gray-400">
             <span>Page {pagination.page} of {pagination.pages}</span>
             <div className="flex gap-2">
                 <button disabled={pagination.page === 1} onClick={() => setPagination(p => ({...p, page: p.page - 1}))} className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">Prev</button>
                 <button disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({...p, page: p.page + 1}))} className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">Next</button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default AdminDashboard;