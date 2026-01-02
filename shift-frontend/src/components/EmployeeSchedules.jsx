import React, { useEffect, useState } from 'react';
import API from '../api';
import { useLanguage } from '../contexts/LanguageContext';

const ROLE_ORDER = {
  'администратор': 1, 'старший кальянщик': 2, 'кальянщик': 3,
  'бармен/зал': 4, 'уборщик': 5, 'студент': 6
};

function EmployeeSchedules() {
  const { t } = useLanguage();
  
  const [availableRoles, setAvailableRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [actualShifts, setActualShifts] = useState({});
  const [monthlySettings, setMonthlySettings] = useState({});
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  
  const [activeUserIds, setActiveUserIds] = useState([]); 
  const [usersWithDataIds, setUsersWithDataIds] = useState([]); 
  const [hiddenUserIds, setHiddenUserIds] = useState([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFactOverlay, setShowFactOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roleSettings, setRoleSettings] = useState({});

  const [editingUser, setEditingUser] = useState(null);
  const [userTimeForm, setUserTimeForm] = useState({ start: '', end: '' });
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  const years = Array.from({length: 8}, (_, i) => 2023 + i);

  useEffect(() => {
    fetchRoles(); fetchUsers(); fetchLocations();
  }, []);

  useEffect(() => {
    setHiddenUserIds([]);
    fetchUsersWithData(); 
    fetchAllSchedulesMatrix();
    fetchMonthlySettings();
    if (showFactOverlay) fetchActualShifts();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    if (selectedLocation) fetchLocationSpecificData(selectedLocation);
    else { setActiveUserIds([]); setRoleSettings({}); setShowSettings(false); }
  }, [selectedLocation]);

  useEffect(() => { if (showFactOverlay) fetchActualShifts(); }, [showFactOverlay]);

  const fetchRoles = () => API.get('/roles').then(res => setAvailableRoles(res.data || []));
  
  const fetchUsers = async () => {
    try {
        const res = await API.get('/users');
        const sorted = res.data.filter(u => u.status === 'active').sort((a, b) => 
            (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99)
        );
        setUsers(sorted);
    } catch (e) { console.error(e); }
  };

  const fetchLocations = () => API.get('/locations').then(res => setLocations(res.data));

  const fetchUsersWithData = async () => {
      try {
          const res = await API.get(`/schedules/users-with-data?year=${selectedYear}&month=${selectedMonth}`);
          setUsersWithDataIds(res.data || []);
      } catch (e) { console.error(e); }
  };

  const fetchLocationSpecificData = async (loc) => {
    try {
        const activeRes = await API.get(`/users/by-location-activity?location=${loc}&days=30`);
        setActiveUserIds(activeRes.data);
        const settingsRes = await API.get(`/settings/role-schedules?location=${loc}`);
        const map = {};
        settingsRes.data.forEach(s => map[s.role] = { start: s.default_start_time, end: s.default_end_time });
        setRoleSettings(map);
    } catch (e) { console.error(e); }
  };

  const fetchMonthlySettings = async () => {
      try {
          const res = await API.get(`/schedules/monthly-settings/${selectedYear}/${selectedMonth}`);
          setMonthlySettings(res.data || {});
      } catch (e) { console.error(e); }
  };

  const fetchActualShifts = async () => {
      const locParam = selectedLocation ? `&location=${selectedLocation}` : '';
      const res = await API.get(`/schedules/actual-shifts?year=${selectedYear}&month=${selectedMonth}${locParam}`);
      setActualShifts(res.data);
  };

  const fetchAllSchedulesMatrix = async () => {
    setLoading(true);
    try {
        const res = await API.get(`/employee-schedules/matrix/${selectedYear}/${selectedMonth}`);
        setSchedules(res.data || {});
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleAddUser = async (userId) => {
      try {
          await API.post('/employee-schedules/generate', { user_id: userId, year: selectedYear, month: selectedMonth });
          setShowAddUserModal(false);
          setUsersWithDataIds(prev => [...prev, userId]);
          setHiddenUserIds(prev => prev.filter(id => id !== userId));
      } catch (e) { alert(e.message); }
  };

  const handleRemoveUser = async (userId) => {
      if(!window.confirm("Удалить сотрудника из этого месяца?")) return;
      try {
          await API.delete(`/employee-schedules/clear-month?user_id=${userId}&year=${selectedYear}&month=${selectedMonth}`);
          setHiddenUserIds(prev => [...prev, userId]);
          setUsersWithDataIds(prev => prev.filter(id => id !== userId));
          const newSched = {...schedules};
          delete newSched[userId];
          setSchedules(newSched);
      } catch (e) { alert(e.message); }
  };

  const handleUserClick = (user) => {
      const individual = monthlySettings[user.id];
      const roleDef = roleSettings[user.role];
      setUserTimeForm({
          start: individual?.start || roleDef?.start || '12:00',
          end: individual?.end || roleDef?.end || '00:00'
      });
      setEditingUser(user);
  };

  const saveUserTime = async () => {
      try {
          await API.post('/schedules/monthly-settings', {
              user_id: editingUser.id, year: selectedYear, month: selectedMonth,
              start_time: userTimeForm.start, end_time: userTimeForm.end
          });
          setMonthlySettings(prev => ({ ...prev, [editingUser.id]: { start: userTimeForm.start, end: userTimeForm.end } }));
          setEditingUser(null);
      } catch (e) { alert(e.message); }
  };

  const saveSettings = async () => {
    try {
        const payload = { settings: Object.entries(roleSettings).map(([role, times]) => ({ location: selectedLocation, role, default_start_time: times.start, default_end_time: times.end })) };
        await API.post('/settings/role-schedules', payload);
        alert(t('sched_msg_settings_saved'));
        setShowSettings(false);
    } catch (e) { alert(t('sched_msg_save_error')); }
  };

  const updateRoleSetting = (r, f, v) => setRoleSettings(p => ({...p, [r]: {...p[r], [f]: v}}));

  const saveAllSchedules = async () => {
    setSaving(true);
    const promises = [];
    Object.keys(schedules).forEach(uid => {
        Object.keys(schedules[uid]).forEach(day => {
            promises.push(API.put(`/employee-schedules/${uid}/${selectedYear}/${selectedMonth}/${day}`, {
                is_workday: schedules[uid][day].is_workday, notes: schedules[uid][day].notes || ''
            }));
        });
    });
    await Promise.all(promises);
    setHasChanges(false);
    setSaving(false);
  };

  const toggleWorkday = (uid, day) => {
      if (showFactOverlay) return;
      setSchedules(prev => ({
          ...prev, [uid]: { ...prev[uid], [day]: { ...prev[uid]?.[day], is_workday: !prev[uid]?.[day]?.is_workday } }
      }));
      setHasChanges(true);
  };

  const getFilteredUsersLocal = () => {
      return users.filter(u => {
          if (hiddenUserIds.includes(u.id)) return false;
          if (showAllUsers) return true;
          if (!selectedLocation) return true;
          return activeUserIds.includes(u.id) || usersWithDataIds.includes(u.id);
      });
  };

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const filteredUsers = getFilteredUsersLocal();
  const usersByRole = filteredUsers.reduce((acc, u) => {
      const r = u.role || 'Other';
      if (!acc[r]) acc[r] = [];
      acc[r].push(u);
      return acc;
  }, {});

  const timeToMin = (s) => { const [h,m] = s.split(':').map(Number); return h*60+m; };
  const getDur = (s, e) => { let sm = timeToMin(s), em = timeToMin(e); if (em < sm) em += 1440; return (em-sm)/60; };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-white tracking-tight">{t('sched_title')}</h1>
            <div className="flex gap-2">
                <button onClick={() => setShowFactOverlay(!showFactOverlay)} className={`h-12 px-6 rounded-xl font-bold border transition-all ${showFactOverlay ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                    {showFactOverlay ? t('sched_btn_overlay_active') : t('sched_btn_overlay')}
                </button>
            </div>
        </div>

        <div className="card-surface p-6">
            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] flex items-end gap-2">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('sched_location')}</label>
                        <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="table-input">
                            <option value="">{t('sched_all_locations')}</option>
                            {locations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    {selectedLocation && (
                        <button onClick={() => setShowAddUserModal(true)} className="h-12 w-12 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xl mb-[1px]" title="Добавить">+</button>
                    )}
                </div>
                <div className="w-32">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('sched_year')}</label>
                    <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} className="table-input">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="w-40">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('sched_month')}</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} className="table-input">
                        {/* ИСПРАВЛЕННЫЕ МЕСЯЦЫ: month_1 = Январь */}
                        {Array.from({length:12},(_,i)=>i+1).map(m => (
                            <option key={m} value={m}>{t(`month_${m}`)}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    {selectedLocation && (
                        <>
                            <button onClick={() => setShowAllUsers(!showAllUsers)} className={`h-12 px-4 rounded-lg border font-medium transition-colors ${showAllUsers ? 'bg-gray-700 border-gray-500 text-white' : 'border-gray-700 hover:bg-gray-700 text-gray-300'}`}>
                                {showAllUsers ? t('sched_btn_show_active_loc') : t('sched_btn_show_all')}
                            </button>
                            <button onClick={() => setShowSettings(!showSettings)} className="h-12 px-4 rounded-lg border border-gray-700 hover:bg-gray-700 text-gray-300 font-medium transition-colors">
                                {t('sched_btn_settings')}
                            </button>
                        </>
                    )}
                    {hasChanges && (
                        <button onClick={saveAllSchedules} disabled={saving} className="h-12 px-6 ml-auto bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg animate-pulse">
                            {t('sched_save_all')}
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* SETTINGS */}
        {selectedLocation && showSettings && (
            <div className="card-surface p-6 border-l-4 border-blue-600 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-lg text-white">{t('sched_settings_title')} <span className="text-blue-400">{selectedLocation}</span></h3>
                     <button onClick={saveSettings} className="h-10 px-6 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg">{t('sched_save_settings')}</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {availableRoles.map(roleObj => {
                        const role = roleObj.value;
                        const current = roleSettings[role] || { start: '12:00', end: '00:00' };
                        return (
                            <div key={roleObj.slug} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                                <span className="text-xs uppercase font-bold text-gray-400 mb-2 block">{role}</span>
                                <div className="flex items-center gap-2">
                                    <input type="time" value={current.start} onChange={e => updateRoleSetting(role, 'start', e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white w-full"/>
                                    <span className="text-gray-500">-</span>
                                    <input type="time" value={current.end} onChange={e => updateRoleSetting(role, 'end', e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white w-full"/>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* TABLE */}
        {!loading && filteredUsers.length === 0 ? (
            <div className="card-surface p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-gray-700">
                <div className="text-gray-500 text-lg mb-4">В этом месяце пока нет сотрудников в графике.</div>
                <div className="flex gap-4">
                    {selectedLocation && (
                        <button onClick={() => setShowAddUserModal(true)} className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors">+ Добавить сотрудника</button>
                    )}
                    {!showAllUsers && (
                        <button onClick={() => setShowAllUsers(true)} className="h-12 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors">Показать общий список</button>
                    )}
                </div>
            </div>
        ) : (
          !loading && (
          <div className="card-surface overflow-hidden border border-gray-700/50">
             <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 text-left bg-gray-800 border-b border-r border-gray-700 sticky left-0 z-20 min-w-[220px]">
                        <span className="text-gray-400 font-bold uppercase text-xs">{t('nav_employees')}</span>
                    </th>
                    {daysArray.map(d => {
                        const date = new Date(selectedYear, selectedMonth-1, d);
                        const isWeekend = date.getDay()===0 || date.getDay()===6;
                        return (
                            <th key={d} className={`p-1 border-b border-r border-gray-700 text-center min-w-[44px] ${isWeekend ? 'bg-gray-700/30' : 'bg-gray-800'}`}>
                                <div className="flex flex-col items-center justify-center py-1">
                                    <span className="text-[10px] text-gray-500 uppercase mb-1">{date.toLocaleDateString('ru-RU', {weekday:'short'})}</span>
                                    <span className="text-sm font-medium">{d}</span>
                                </div>
                            </th>
                        );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {availableRoles.map(roleObj => {
                      const roleName = roleObj.value;
                      const group = usersByRole[roleName];
                      if (!group || !group.length) return null;

                      return (
                        <React.Fragment key={roleObj.slug}>
                          <tr className="bg-gray-900/50">
                            <td className="px-4 py-2 font-bold text-gray-400 text-xs uppercase border-b border-r border-gray-700 sticky left-0 z-10 bg-gray-900">{roleName}</td>
                            <td colSpan={daysArray.length} className="border-b border-gray-700"></td>
                          </tr>
                          {group.map(u => {
                              const indSettings = monthlySettings[u.id];
                              const roleSettingsDef = roleSettings[roleName];
                              const planStart = indSettings?.start || roleSettingsDef?.start || '12:00';
                              const planEnd = indSettings?.end || roleSettingsDef?.end || '00:00';
                              const isIndividual = !!indSettings;
                              const planStartMin = timeToMin(planStart);
                              const planDuration = getDur(planStart, planEnd);

                              return (
                                <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                                  <td className="p-0 border-b border-r border-gray-700 sticky left-0 z-10 bg-[#161b22]">
                                      <div className="flex h-[56px] w-full items-center justify-between px-3 group">
                                          <div className="flex flex-col justify-center cursor-pointer flex-1 min-w-0" onClick={() => handleUserClick(u)}>
                                              <div className="font-medium text-gray-200 truncate flex items-center gap-2">
                                                  {u.name}
                                                  {isIndividual && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
                                              </div>
                                              <div className={`text-[10px] mt-0.5 font-mono ${isIndividual ? 'text-blue-400' : 'text-gray-500'}`}>{planStart}-{planEnd}</div>
                                          </div>
                                          {selectedLocation && (
                                              <button onClick={() => handleRemoveUser(u.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 transition-opacity" title="Удалить">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                          )}
                                      </div>
                                  </td>
                                  {daysArray.map(d => {
                                      const isWorkday = schedules[u.id]?.[d]?.is_workday ?? true;
                                      const isWeekend = new Date(selectedYear, selectedMonth-1, d).getDay() % 6 === 0;
                                      
                                      if (showFactOverlay) {
                                          const actual = actualShifts[u.id]?.[d];
                                          let cellClass = `p-0 border-b border-r border-gray-700 relative ${isWeekend ? 'bg-gray-900/30' : ''}`;
                                          let content = null;
                                          if (actual) {
                                              const actStartMin = timeToMin(actual.start);
                                              const isLate = isWorkday && (actStartMin > planStartMin + 15);
                                              const diff = Math.abs(actual.duration - planDuration);
                                              const isDev = isWorkday && (diff > 1.5);
                                              if (isLate) cellClass += " bg-red-900/40 border-l-2 border-red-500";
                                              else cellClass += " bg-purple-900/20";
                                              content = <div className="w-full h-full flex flex-col items-center justify-center p-1 text-[10px]"><span className="font-bold text-white">{actual.start}</span><span className={`font-mono ${isDev ? 'text-orange-400' : 'text-gray-500'}`}>{actual.duration.toFixed(1)}h</span></div>;
                                          } else if (isWorkday) {
                                              cellClass += " bg-red-900/10";
                                              content = <div className="flex items-center justify-center h-full text-red-500/30 text-xs">✖</div>;
                                          }
                                          return <td key={d} className={cellClass} style={{height: '55px'}}>{content}</td>;
                                      }

                                      return (
                                          <td key={d} className={`p-0 border-b border-r border-gray-700 ${isWeekend ? 'bg-gray-900/30' : ''}`}>
                                              <button onClick={() => toggleWorkday(u.id, d)} className={`w-full h-[55px] flex items-center justify-center outline-none focus:ring-2 focus:ring-blue-500 ${isWorkday ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-red-500/10 hover:bg-red-500/20'}`}>
                                                  <div className={`w-3 h-3 rounded-full ${isWorkday ? 'bg-green-500' : 'bg-red-500/50'}`}></div>
                                              </button>
                                          </td>
                                      );
                                  })}
                                </tr>
                              );
                          })}
                        </React.Fragment>
                      );
                  })}
                </tbody>
              </table>
             </div>
          </div>
          )
        )}

        {/* MODALS remain same ... */}
        {editingUser && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-1">{editingUser.name}</h3>
                    <p className="text-sm text-gray-400 mb-6">{t(`month_${selectedMonth}`)} {selectedYear}</p>
                    <div className="space-y-4">
                        <div><label className="block text-xs uppercase font-bold text-gray-500 mb-2">Начало</label><input type="time" className="table-input" value={userTimeForm.start} onChange={e => setUserTimeForm({...userTimeForm, start: e.target.value})}/></div>
                        <div><label className="block text-xs uppercase font-bold text-gray-500 mb-2">Конец</label><input type="time" className="table-input" value={userTimeForm.end} onChange={e => setUserTimeForm({...userTimeForm, end: e.target.value})}/></div>
                    </div>
                    <div className="flex gap-3 mt-8">
                        <button onClick={() => setEditingUser(null)} className="flex-1 h-12 rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors">Отмена</button>
                        <button onClick={saveUserTime} className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors">Сохранить</button>
                    </div>
                </div>
            </div>
        )}

        {showAddUserModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl h-[500px] flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4">Добавить сотрудника</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {users.filter(u => !activeUserIds.includes(u.id) && !usersWithDataIds.includes(u.id) && !hiddenUserIds.includes(u.id)).map(u => (
                            <div key={u.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors cursor-pointer" onClick={() => handleAddUser(u.id)}>
                                <div><div className="font-medium text-white">{u.name}</div><div className="text-xs text-gray-400">{u.role}</div></div>
                                <span className="text-green-400 font-bold text-xl">+</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowAddUserModal(false)} className="mt-4 h-12 w-full rounded-xl bg-gray-700 text-white font-medium hover:bg-gray-600">Закрыть</button>
                </div>
            </div>
        )}
    </div>
  );
}

export default EmployeeSchedules;