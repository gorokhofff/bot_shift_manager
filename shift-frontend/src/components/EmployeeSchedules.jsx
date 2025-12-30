import React, { useEffect, useState } from 'react';
import API from '../api';
import { useLanguage } from '../contexts/LanguageContext';

const ROLE_ORDER = {
  'администратор': 1,
  'старший кальянщик': 2,
  'кальянщик': 3,
  'бармен/зал': 4,
  'уборщик': 5,
  'студент': 6
};

function EmployeeSchedules() {
  const [users, setUsers] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Новые состояния для фильтров и настроек
  const [activeUserIds, setActiveUserIds] = useState([]); 
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roleSettings, setRoleSettings] = useState({});
  const [availableRoles, setAvailableRoles] = useState([]);

  const { t, getMonthName } = useLanguage();

  // Генерируем годы до 2100
  const years = Array.from({length: 2030 - 2023 + 1}, (_, i) => 2023 + i);

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  // Перезагрузка при смене фильтров
  useEffect(() => {
    if (users.length > 0) {
      fetchAllSchedules();
    }
  }, [users, selectedYear, selectedMonth, selectedLocation, showAllUsers, activeUserIds]); // Добавили зависимости

  // Загрузка данных локации при её выборе
  useEffect(() => {
    if (selectedLocation) {
        fetchLocationSpecificData(selectedLocation);
    } else {
        setActiveUserIds([]);
        setRoleSettings({});
        setShowSettings(false);
    }
  }, [selectedLocation]);

  const fetchUsers = async () => {
    try {
      const response = await API.get('/users');
      // Сразу фильтруем только активных
      const activeUsers = response.data.filter(user => user.status === 'active');
      
      const sortedUsers = activeUsers.sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] || 99;
        const roleB = ROLE_ORDER[b.role] || 99;
        return roleA !== roleB ? roleA - roleB : a.name.localeCompare(b.name, 'ru');
      });
      setUsers(sortedUsers);
      
      // Собираем роли для настроек
      const roles = [...new Set(sortedUsers.map(u => u.role))];
      setAvailableRoles(roles);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await API.get('/locations');
      setLocations(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchLocationSpecificData = async (loc) => {
    try {
        // 1. Кто работал здесь за 30 дней
        const activeRes = await API.get(`/users/by-location-activity?location=${loc}&days=30`);
        setActiveUserIds(activeRes.data);

        // 2. Настройки времени
        const settingsRes = await API.get(`/settings/role-schedules?location=${loc}`);
        const settingsMap = {};
        settingsRes.data.forEach(s => {
            settingsMap[s.role] = { start: s.default_start_time, end: s.default_end_time };
        });
        setRoleSettings(settingsMap);
    } catch (error) {
        console.error("Error fetching location data:", error);
    }
  };

  // Логика фильтрации (вместо отдельного API запроса getFilteredUsers)
  const getFilteredUsersLocal = () => {
      return users.filter(user => {
          // 1. Всегда только активные (уже отфильтрованы в fetchUsers)
          // 2. Если локация выбрана:
          if (selectedLocation) {
              if (showAllUsers) return true; // Показать всех активных, даже если не работали тут
              return activeUserIds.includes(user.id); // Иначе только тех, кто работал
          }
          return true;
      });
  };

  const fetchAllSchedules = async () => {
    setLoading(true);
    try {
      const currentFilteredUsers = getFilteredUsersLocal();
      const schedulePromises = currentFilteredUsers.map(user => 
        API.get(`/employee-schedules/${user.id}/${selectedYear}/${selectedMonth}`)
          .then(response => ({ userId: user.id, data: response.data }))
          .catch(() => ({ userId: user.id, data: {} }))
      );
      const results = await Promise.all(schedulePromises);
      const allSchedules = {};
      results.forEach(result => { allSchedules[result.userId] = result.data; });
      setSchedules(allSchedules);
      setHasChanges(false);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const generateAllSchedules = async () => {
    const currentFilteredUsers = getFilteredUsersLocal();
    if (!confirm(t('sched_create_basic') + "?")) return;
    setLoading(true);
    try {
      await Promise.all(currentFilteredUsers.map(user => 
        API.post('/employee-schedules/generate', { user_id: user.id, year: selectedYear, month: selectedMonth })
      ));
      await fetchAllSchedules();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const toggleWorkday = (userId, day) => {
    const currentStatus = schedules[userId]?.[day]?.is_workday ?? true;
    setSchedules(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [day]: { ...prev[userId]?.[day], is_workday: !currentStatus } }
    }));
    setHasChanges(true);
  };

  const saveAllSchedules = async () => {
    setSaving(true);
    try {
      const allPromises = [];
      Object.keys(schedules).forEach(userId => {
        Object.keys(schedules[userId]).forEach(day => {
          allPromises.push(API.put(`/employee-schedules/${userId}/${selectedYear}/${selectedMonth}/${day}`, {
            is_workday: schedules[userId][day].is_workday,
            notes: schedules[userId][day].notes || ''
          }));
        });
      });
      await Promise.all(allPromises);
      setHasChanges(false);
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  // --- ЛОГИКА НАСТРОЕК ВРЕМЕНИ ---
  const updateRoleSetting = (role, field, value) => {
    setRoleSettings(prev => ({
        ...prev,
        [role]: { ...prev[role], [field]: value }
    }));
  };

  const saveSettings = async () => {
    try {
        const payload = {
            settings: Object.entries(roleSettings).map(([role, times]) => ({
                location: selectedLocation,
                role: role,
                default_start_time: times.start || '12:00',
                default_end_time: times.end || '00:00'
            }))
        };
        await API.post('/settings/role-schedules', payload);
        alert(t('sched_msg_settings_saved'));
        setShowSettings(false);
    } catch (error) {
        alert(t('sched_msg_save_error') + ": " + error.message);
    }
  };
  // ------------------------------

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  const currentFilteredUsers = getFilteredUsersLocal();

  const usersByRole = currentFilteredUsers.reduce((acc, user) => {
    const role = user.role || 'Other';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-full mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">{t('sched_title')}</h1>

        {/* --- ПАНЕЛЬ УПРАВЛЕНИЯ --- */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-800 p-4 rounded-lg flex flex-wrap gap-4 items-end justify-center">
            {/* Локация */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">{t('sched_location')}</label>
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded min-w-[140px]">
                <option value="">{t('sched_all_locations')}</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Доп. кнопки для локации */}
            {selectedLocation && (
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => setShowAllUsers(!showAllUsers)}
                        className={`text-xs px-2 py-1 rounded border ${showAllUsers ? 'bg-blue-900 border-blue-700 text-white' : 'bg-gray-700 border-gray-600 text-gray-300'}`}
                    >
                        {showAllUsers ? t('sched_btn_show_all') : t('sched_btn_show_active_loc')}
                    </button>
                    <button 
                         onClick={() => setShowSettings(!showSettings)}
                         className={`text-xs px-2 py-1 rounded border ${showSettings ? 'bg-gray-600 border-gray-500' : 'bg-gray-700 border-gray-600 text-gray-300'}`}
                    >
                        {t('sched_btn_settings')}
                    </button>
                </div>
            )}

            {/* Год (Динамический до 2100) */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">{t('sched_year')}</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="p-2 bg-gray-700 border border-gray-600 rounded">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Месяц */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">{t('sched_month')}</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="p-2 bg-gray-700 border border-gray-600 rounded">
                {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i+1}>{getMonthName(i)}</option>)}
              </select>
            </div>

            {/* Кнопки действий */}
            <div className="flex gap-2">
              <button onClick={generateAllSchedules} disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm font-medium">
                {t('sched_create_basic')}
              </button>
              {hasChanges && (
                <button onClick={saveAllSchedules} disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium animate-pulse">
                  {t('sched_save_all')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- ПАНЕЛЬ НАСТРОЕК ВРЕМЕНИ (Если открыта) --- */}
        {selectedLocation && showSettings && (
            <div className="max-w-4xl mx-auto mb-6 bg-gray-800 border border-gray-600 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-4 text-gray-200 border-b border-gray-700 pb-2">
                    {t('sched_settings_title')} {selectedLocation}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {availableRoles.map(role => {
                        const current = roleSettings[role] || { start: '12:00', end: '00:00' };
                        return (
                            <div key={role} className="flex flex-col bg-gray-700/50 p-2 rounded border border-gray-600">
                                <span className="text-xs uppercase font-bold text-gray-400 mb-1">{role}</span>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="time" 
                                        value={current.start}
                                        onChange={e => updateRoleSetting(role, 'start', e.target.value)}
                                        className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-sm text-white w-full"
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input 
                                        type="time" 
                                        value={current.end}
                                        onChange={e => updateRoleSetting(role, 'end', e.target.value)}
                                        className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-sm text-white w-full"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={saveSettings}
                        className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-bold"
                    >
                        {t('sched_save_settings')}
                    </button>
                </div>
            </div>
        )}

        {/* --- ПРЕДУПРЕЖДЕНИЕ О НЕСОХРАНЕННЫХ ДАННЫХ --- */}
        {hasChanges && (
          <div className="max-w-fit mx-auto bg-yellow-900/80 border border-yellow-600 p-2 rounded mb-4 text-center text-yellow-100 text-sm shadow-lg">
            ⚠️ {t('sched_unsaved')}
          </div>
        )}

        {/* --- ТАБЛИЦА --- */}
        {!loading && (
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
             <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-2 text-left border border-gray-600 min-w-[200px] bg-gray-700 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                      {t('nav_employees')}
                    </th>
                    {daysArray.map(day => {
                      const date = new Date(selectedYear, selectedMonth - 1, day);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      // Локализация дней недели
                      const dayNamesRu = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
                      const dayNamesTr = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
                      // Определяем текущий язык через t, но проще взять из контекста или хардкодом проверить, 
                      // но раз у нас нет прямого доступа к lang коду, сделаем универсально:
                      // Используем toLocaleDateString
                      const dayName = date.toLocaleDateString(t('btn_save') === 'Kaydet' ? 'tr-TR' : 'ru-RU', {weekday: 'short'});

                      return (
                        <th key={day} className={`p-1 border border-gray-600 text-center min-w-[35px] ${isWeekend ? 'bg-gray-600/50' : ''}`}>
                          <div className="text-[10px] text-gray-400 uppercase">{dayName}</div>
                          <div>{day}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(usersByRole).map(role => (
                    <React.Fragment key={role}>
                      <tr className="bg-gray-750">
                        <td className="p-2 font-bold text-gray-300 border border-gray-600 sticky left-0 bg-gray-750 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                          {role}
                        </td>
                        <td colSpan={daysArray.length} className="bg-gray-900/30"></td>
                      </tr>
                      {usersByRole[role].map(user => (
                        <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                          <td className="p-2 border border-gray-600 font-medium sticky left-0 bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                              <div>{user.name}</div>
                              {/* Отображение времени если есть настройки */}
                              {selectedLocation && roleSettings[user.role] && (
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                      {roleSettings[user.role].start} - {roleSettings[user.role].end}
                                  </div>
                              )}
                          </td>
                          {daysArray.map(day => {
                            const isWorkday = schedules[user.id]?.[day]?.is_workday ?? true;
                            const isWeekend = new Date(selectedYear, selectedMonth - 1, day).getDay() % 6 === 0;
                            return (
                              <td key={day} className="p-0 border border-gray-600">
                                <button
                                  onClick={() => toggleWorkday(user.id, day)}
                                  className={`w-full h-10 transition-colors ${
                                    isWorkday 
                                      ? 'bg-green-700/70 hover:bg-green-600' 
                                      : 'bg-red-900/30 hover:bg-red-800/50'
                                  } ${isWeekend ? 'opacity-80' : ''}`}
                                ></button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
             </div>
             
             <div className="p-3 border-t border-gray-700 bg-gray-800 text-xs flex gap-4 text-gray-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-700 rounded"></div> {t('sched_working')}</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-900 rounded"></div> {t('sched_day_off')}</div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeSchedules;