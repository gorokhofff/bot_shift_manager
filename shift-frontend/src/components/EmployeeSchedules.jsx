import { useEffect, useState } from 'react';
import API from '../api';
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

// Порядок сортировки ролей (не переводим, так как ключи в БД)
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
  
  const { t, getMonthName } = useLanguage();

  useEffect(() => {
    fetchUsers();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchAllSchedules();
    }
  }, [users, selectedYear, selectedMonth, selectedLocation]);

  const fetchUsers = async () => {
    try {
      const response = await API.get('/users');
      const activeUsers = response.data.filter(user => user.status === 'active');
      const sortedUsers = activeUsers.sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] || 99;
        const roleB = ROLE_ORDER[b.role] || 99;
        return roleA !== roleB ? roleA - roleB : a.name.localeCompare(b.name, 'ru');
      });
      setUsers(sortedUsers);
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

  const getFilteredUsers = async () => {
    if (!selectedLocation) return users;
    try {
      const response = await API.get(`/users-by-location/${selectedLocation}`);
      return response.data.sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] || 99;
        const roleB = ROLE_ORDER[b.role] || 99;
        return roleA !== roleB ? roleA - roleB : a.name.localeCompare(b.name, 'ru');
      });
    } catch (error) { return users; }
  };

  const fetchAllSchedules = async () => {
    setLoading(true);
    try {
      const filteredUsers = await getFilteredUsers();
      const schedulePromises = filteredUsers.map(user => 
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
    const filteredUsers = await getFilteredUsers();
    if (!confirm(t('sched_create_basic') + "?")) return;
    setLoading(true);
    try {
      await Promise.all(filteredUsers.map(user => 
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
  
  // ... (setWeekendForUser и setAllDaysForUser можно оставить, убрав emoji из кнопок)

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

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  const [filteredUsers, setFilteredUsers] = useState([]);
  useEffect(() => {
    getFilteredUsers().then(setFilteredUsers);
  }, [users, selectedLocation]);

  const usersByRole = filteredUsers.reduce((acc, user) => {
    const role = user.role || 'Other';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-full mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">{t('sched_title')}</h1>

        <div className="flex justify-center mb-6">
          <div className="bg-gray-800 p-4 rounded-lg flex flex-wrap gap-6 items-end">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">{t('sched_location')}</label>
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded">
                <option value="">{t('sched_all_locations')}</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">{t('sched_year')}</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="p-2 bg-gray-700 border border-gray-600 rounded">
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-400">{t('sched_month')}</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="p-2 bg-gray-700 border border-gray-600 rounded">
                {Array.from({length:12},(_,i)=>i).map(i => <option key={i} value={i+1}>{getMonthName(i)}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={generateAllSchedules} disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm">
                {t('sched_create_basic')}
              </button>
              {hasChanges && (
                <button onClick={saveAllSchedules} disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
                  {t('sched_save_all')}
                </button>
              )}
            </div>
          </div>
        </div>

        {hasChanges && (
          <div className="bg-yellow-900/50 border border-yellow-700 p-2 rounded mb-4 text-center text-yellow-200 text-sm">
            {t('sched_unsaved')}
          </div>
        )}

        {!loading && (
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
             <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-2 text-left border border-gray-600 min-w-[200px] bg-gray-700 sticky left-0 z-20">
                      {t('nav_employees')}
                    </th>
                    {daysArray.map(day => {
                      const date = new Date(selectedYear, selectedMonth - 1, day);
                      const dayName = ['Vs','Pn','Vt','Sr','Čt','Pt','Sb'][date.getDay()]; // Можно перевести и дни
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      return (
                        <th key={day} className={`p-1 border border-gray-600 text-center min-w-[35px] ${isWeekend ? 'bg-gray-600' : ''}`}>
                          <div className="text-[10px] text-gray-400">{dayName}</div>
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
                        <td className="p-2 font-bold text-gray-300 border border-gray-600 sticky left-0 bg-gray-750 z-10">
                          {role}
                        </td>
                        <td colSpan={daysArray.length}></td>
                      </tr>
                      {usersByRole[role].map(user => (
                        <tr key={user.id} className="hover:bg-gray-700/50">
                          <td className="p-2 border border-gray-600 font-medium sticky left-0 bg-gray-800 z-10">{user.name}</td>
                          {daysArray.map(day => {
                            const isWorkday = schedules[user.id]?.[day]?.is_workday ?? true;
                            const isWeekend = new Date(selectedYear, selectedMonth - 1, day).getDay() % 6 === 0;
                            return (
                              <td key={day} className="p-0 border border-gray-600">
                                <button
                                  onClick={() => toggleWorkday(user.id, day)}
                                  className={`w-full h-8 transition-colors ${
                                    isWorkday 
                                      ? 'bg-green-700/80 hover:bg-green-600' 
                                      : 'bg-red-900/50 hover:bg-red-800'
                                  } ${isWeekend ? 'opacity-70' : ''}`}
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