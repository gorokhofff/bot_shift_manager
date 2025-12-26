import { useEffect, useState } from 'react';
import API from '../api';
import React from 'react';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Порядок сортировки ролей
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
      
      // Сортировка: сначала по роли, потом по алфавиту
      const sortedUsers = activeUsers.sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] || 99;
        const roleB = ROLE_ORDER[b.role] || 99;
        
        if (roleA !== roleB) {
          return roleA - roleB;
        }
        
        return a.name.localeCompare(b.name, 'ru');
      });
      
      setUsers(sortedUsers);
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await API.get('/locations');
      setLocations(response.data);
    } catch (error) {
      console.error('Ошибка загрузки локаций:', error);
    }
  };

  const getFilteredUsers = async () => {
    if (!selectedLocation) return users;
    
    try {
      // Получаем пользователей, которые работали в выбранном заведении
      const response = await API.get(`/users-by-location/${selectedLocation}`);
      const locationUsers = response.data;
      
      // Применяем ту же сортировку
      return locationUsers.sort((a, b) => {
        const roleA = ROLE_ORDER[a.role] || 99;
        const roleB = ROLE_ORDER[b.role] || 99;
        
        if (roleA !== roleB) {
          return roleA - roleB;
        }
        
        return a.name.localeCompare(b.name, 'ru');
      });
    } catch (error) {
      console.error('Ошибка фильтрации пользователей по локации:', error);
      return users;
    }
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
      results.forEach(result => {
        allSchedules[result.userId] = result.data;
      });
      
      setSchedules(allSchedules);
      setHasChanges(false);
    } catch (error) {
      console.error('Ошибка загрузки расписаний:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAllSchedules = async () => {
    const filteredUsers = await getFilteredUsers();
    if (!confirm(`Создать базовые расписания для ${filteredUsers.length} сотрудников${selectedLocation ? ` в ${selectedLocation}` : ''}? (все дни будут рабочими)`)) {
      return;
    }
    
    setLoading(true);
    try {
      const promises = filteredUsers.map(user => 
        API.post('/employee-schedules/generate', {
          user_id: user.id,
          year: selectedYear,
          month: selectedMonth
        })
      );
      
      await Promise.all(promises);
      await fetchAllSchedules();
      alert(`✅ Базовые расписания созданы для ${filteredUsers.length} сотрудников`);
    } catch (error) {
      console.error('Ошибка создания расписаний:', error);
      alert('❌ Ошибка создания расписаний');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkday = (userId, day) => {
    const currentStatus = schedules[userId]?.[day]?.is_workday ?? true;
    
    setSchedules(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [day]: {
          ...prev[userId]?.[day],
          is_workday: !currentStatus
        }
      }
    }));
    
    setHasChanges(true);
  };

  const setWeekendForUser = (userId, isWeekend) => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const newSchedule = { ...schedules[userId] };
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth - 1, day);
      const dayOfWeek = date.getDay();
      const isCalendarWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isCalendarWeekend === isWeekend) {
        newSchedule[day] = {
          ...newSchedule[day],
          is_workday: !isWeekend
        };
      }
    }
    
    setSchedules(prev => ({
      ...prev,
      [userId]: newSchedule
    }));
    
    setHasChanges(true);
  };

  const setAllDaysForUser = (userId, isWorkday) => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const newSchedule = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
      newSchedule[day] = {
        is_workday: isWorkday
      };
    }
    
    setSchedules(prev => ({
      ...prev,
      [userId]: newSchedule
    }));
    
    setHasChanges(true);
  };

  const saveAllSchedules = async () => {
    setSaving(true);
    try {
      const allPromises = [];
      
      Object.keys(schedules).forEach(userId => {
        Object.keys(schedules[userId]).forEach(day => {
          allPromises.push(
            API.put(`/employee-schedules/${userId}/${selectedYear}/${selectedMonth}/${day}`, {
              is_workday: schedules[userId][day].is_workday,
              notes: schedules[userId][day].notes || ''
            })
          );
        });
      });
      
      await Promise.all(allPromises);
      setHasChanges(false);
      alert('✅ Все расписания сохранены');
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('❌ Ошибка сохранения расписаний');
    } finally {
      setSaving(false);
    }
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Группировка пользователей по ролям с учетом фильтра по локации
  const [filteredUsers, setFilteredUsers] = useState([]);
  
  useEffect(() => {
    const updateFilteredUsers = async () => {
      const filtered = await getFilteredUsers();
      setFilteredUsers(filtered);
    };
    
    if (users.length > 0) {
      updateFilteredUsers();
    }
  }, [users, selectedLocation]);

  const usersByRole = filteredUsers.reduce((acc, user) => {
    const role = user.role || 'Не указано';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

  const getRoleIcon = (role) => {
    const icons = {
      'администратор': '⚙️',
      'старший кальянщик': '👑',
      'кальянщик': '💨',
      'бармен/зал': '🍹',
      'уборщик': '🧹',
      'студент': '🎓'
    };
    return icons[role] || '👤';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-full mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">📅 Расписания сотрудников</h1>

        {/* Селекторы по центру */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Заведение</label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 min-w-[120px]"
                >
                  <option value="">Все заведения</option>
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Год</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500"
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
                  className="p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500"
                >
                  {MONTHS.map((month, index) => (
                    <option key={index + 1} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={generateAllSchedules}
                  disabled={loading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-600 transition-colors"
                >
                  🔄 Создать базовые
                </button>

                {hasChanges && (
                  <button
                    onClick={saveAllSchedules}
                    disabled={saving}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
                  >
                    {saving ? '💾 Сохранение...' : '💾 Сохранить все'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Уведомление об изменениях */}
        {hasChanges && (
          <div className="bg-yellow-900 border border-yellow-600 p-3 rounded-lg mb-4 text-center">
            ⚠️ <strong>Есть несохраненные изменения!</strong> Не забудьте нажать "Сохранить все"
          </div>
        )}

        {loading ? (
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <p>🔄 Загрузка расписаний...</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  📋 {MONTHS[selectedMonth - 1]} {selectedYear}
                  {selectedLocation && <span className="text-blue-400"> - {selectedLocation}</span>}
                </h2>
                <div className="text-sm text-gray-300">
                  💡 Кликните на день чтобы переключить рабочий/выходной. 
                  🟢 = рабочий, 🔴 = выходной
                  {selectedLocation && <span className="text-blue-300"> | Фильтр: {selectedLocation}</span>}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[70vh] relative">
              <table className="w-full text-sm">
                <thead className="bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 text-left border border-gray-600 min-w-[200px] bg-gray-700 sticky left-0 z-20">
                      Сотрудник
                    </th>
                    {daysArray.map(day => {
                      const date = new Date(selectedYear, selectedMonth - 1, day);
                      const dayOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()];
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      
                      return (
                        <th 
                          key={day} 
                          className={`p-1 border border-gray-600 text-center min-w-[40px] bg-gray-700 ${
                            isWeekend ? 'bg-gray-600' : ''
                          }`}
                        >
                          <div className="text-xs">{dayOfWeek}</div>
                          <div className="font-bold">{day}</div>
                        </th>
                      );
                    })}
                    <th className="p-2 border border-gray-600 text-center min-w-[120px] bg-gray-700">
                      Действия
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {Object.keys(usersByRole).map(role => (
                    <React.Fragment key={role}>
                      {/* Заголовок роли */}
                      <tr className="bg-gray-750">
                        <td 
                          className="p-3 font-semibold text-lg border border-gray-600 bg-gray-750 sticky left-0 z-10"
                        >
                          {getRoleIcon(role)} {role} ({usersByRole[role].length})
                        </td>
                        <td 
                          colSpan={daysArray.length + 1} 
                          className="p-3 font-semibold text-lg border border-gray-600 bg-gray-750"
                        >
                        </td>
                      </tr>
                      
                      {/* Сотрудники этой роли */}
                      {usersByRole[role].map(user => (
                        <tr key={user.id} className="hover:bg-gray-750">
                          <td className="p-2 border border-gray-600 font-medium bg-gray-800 sticky left-0 z-10">
                            {user.name}
                          </td>
                          
                          {daysArray.map(day => {
                            const isWorkday = schedules[user.id]?.[day]?.is_workday ?? true;
                            const date = new Date(selectedYear, selectedMonth - 1, day);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            
                            return (
                              <td key={day} className="p-0 border border-gray-600">
                                <button
                                  onClick={() => toggleWorkday(user.id, day)}
                                  className={`
                                    w-full h-full p-2 transition-all hover:scale-110
                                    ${isWorkday 
                                      ? 'bg-green-700 hover:bg-green-600 text-white' 
                                      : 'bg-red-700 hover:bg-red-600 text-white'
                                    }
                                    ${isWeekend ? 'opacity-75' : ''}
                                  `}
                                  title={`${day} ${MONTHS[selectedMonth - 1]} - ${isWorkday ? 'Рабочий' : 'Выходной'}`}
                                >
                                  {isWorkday ? '✅' : '❌'}
                                </button>
                              </td>
                            );
                          })}
                          
                          <td className="p-1 border border-gray-600">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => setWeekendForUser(user.id, true)}
                                className="text-xs bg-orange-600 hover:bg-orange-700 px-2 py-1 rounded"
                                title="Сделать выходными Сб/Вс"
                              >
                                📅 Сб/Вс
                              </button>
                              <button
                                onClick={() => setAllDaysForUser(user.id, true)}
                                className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
                                title="Все дни рабочие"
                              >
                                ✅ Все
                              </button>
                              <button
                                onClick={() => setAllDaysForUser(user.id, false)}
                                className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                                title="Все дни выходные"
                              >
                                ❌ Все
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Легенда */}
            <div className="p-4 border-t border-gray-700 bg-gray-750">
              <div className="flex flex-wrap gap-6 text-sm justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-700 rounded"></div>
                  <span>✅ Рабочий день</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-700 rounded"></div>
                  <span>❌ Выходной день</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-600 rounded"></div>
                  <span>Календарные выходные (Сб/Вс)</span>
                </div>
                <div className="text-gray-400">
                  💡 Кнопки справа: быстро установить выходные/рабочие дни
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeSchedules;