import React, { useState, useEffect, useRef } from 'react';
import API from '../api';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// Локации для фильтра
const ESTABLISHMENTS = [
  { id: 'all', name: 'Все заведения' },
  { id: 'Yenibosna', name: 'Yenibosna' },
  { id: 'Göktürk', name: 'Göktürk' }
];

const SimpleScheduler = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [users, setUsers] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Новое состояние для фильтра
  const [selectedLocation, setSelectedLocation] = useState('Yenibosna');

  // Для Shift+Click
  const lastClickedRef = useRef(null); // { userId, day, value }

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/schedules/${year}/${month}`);
      setUsers(res.data.users);
      setSchedules(res.data.schedules);
    } catch (e) {
      console.error(e);
      alert("Ошибка загрузки графика");
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = async (userId, day, e) => {
    // Текущее состояние ячейки (если нет в базе - считаем false/выходной)
    const currentVal = schedules[userId]?.[day] ?? false; 
    const newVal = !currentVal; // Переключаем

    // --- ЛОГИКА SHIFT + CLICK ---
    if (e.shiftKey && lastClickedRef.current && lastClickedRef.current.userId === userId) {
      const startDay = Math.min(lastClickedRef.current.day, day);
      const endDay = Math.max(lastClickedRef.current.day, day);
      const targetVal = lastClickedRef.current.value; // Тянем то значение, которое было в первом клике

      // Формируем список обновлений
      const updates = [];
      const newSchedules = { ...schedules };
      if (!newSchedules[userId]) newSchedules[userId] = {};

      for (let d = startDay; d <= endDay; d++) {
        // Оптимистичное обновление
        newSchedules[userId][d] = targetVal;
        updates.push({
          user_id: userId,
          year,
          month,
          day: d,
          is_workday: targetVal
        });
      }
      
      setSchedules(newSchedules);

      // Отправляем Bulk запрос
      try {
        await API.post('/schedules/bulk-update', { updates });
      } catch (err) {
        console.error(err);
        alert("Ошибка массового обновления");
        loadData();
      }
      
      // Сбрасываем (или оставляем, чтобы можно было продолжить цепочку?)
      // Лучше обновить реф на текущий день
      lastClickedRef.current = { userId, day, value: targetVal };
      return;
    }

    // --- ОБЫЧНЫЙ КЛИК ---
    
    // 1. Оптимистичное обновление
    setSchedules(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [day]: newVal
      }
    }));

    // 2. Сохраняем в реф для будущего Shift-клика
    lastClickedRef.current = { userId, day, value: newVal };

    // 3. Отправляем запрос
    try {
      await API.post('/schedules/toggle', {
        user_id: userId,
        year,
        month,
        day,
        is_workday: newVal
      });
    } catch (err) {
      console.error(err);
      alert("Ошибка сохранения");
      loadData();
    }
  };

  const copyPrevious = async () => {
    if(!window.confirm("Это перезапишет текущий график данными из прошлого месяца. Продолжить?")) return;
    try {
      await API.post('/schedules/copy-prev', { target_year: year, target_month: month });
      loadData();
      alert("✅ Скопировано!");
    } catch (e) {
      alert("Ошибка копирования");
    }
  };

  const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const daysInCurrentMonth = getDaysInMonth(year, month);

  // Фильтрация пользователей
  const filteredUsers = users.filter(u => {
    if (selectedLocation === 'all') return true;
    // Если у пользователя 'all' или 'unknown', показываем везде или нигде? 
    // Покажем везде, если не определено
    if (u.location === 'all' || !u.location) return true;
    // Иначе строгое совпадение
    return u.location === selectedLocation;
  });

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            📅 График работы (План)
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Зажмите <strong>Shift</strong>, чтобы выбрать несколько дней сразу
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          {/* Выбор заведения */}
          <div className="bg-gray-800 p-1 rounded-lg border border-gray-600 flex">
            {ESTABLISHMENTS.map(est => (
              <button
                key={est.id}
                onClick={() => setSelectedLocation(est.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  selectedLocation === est.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {est.name}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-gray-700 mx-2 hidden md:block"></div>

          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-gray-700 p-2 rounded border border-gray-600">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-gray-700 p-2 rounded border border-gray-600">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <button onClick={copyPrevious} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded shadow text-sm font-medium">
            📋 Копировать прошлый
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-xl border border-gray-700">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-900">
              <th className="p-3 text-left min-w-[200px] sticky left-0 bg-gray-900 z-20 border-b border-gray-700 border-r">
                Сотрудник
              </th>
              {DAYS.slice(0, daysInCurrentMonth).map(d => {
                const date = new Date(year, month - 1, d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Сб, Вс
                return (
                  <th key={d} className={`p-1 w-9 text-center text-xs border-b border-gray-700 border-r border-gray-800 ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                    <div className="font-bold">{d}</div>
                    <div className="font-light text-[10px]">
                      {['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][date.getDay()]}
                    </div>
                  </th>
                );
              })}
              <th className="p-2 text-center border-b border-gray-700 min-w-[60px]">Всего</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => {
              const userSched = schedules[user.id] || {};
              const workDaysCount = Object.values(userSched).filter(v => v).length;

              return (
                <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-750 transition-colors">
                  <td className="p-3 sticky left-0 bg-gray-800 z-10 border-r border-gray-700">
                    <div className="font-medium text-white">{user.name}</div>
                    <div className="text-xs text-gray-400 flex justify-between">
                      <span>{user.role}</span>
                      {/* Можно отобразить локацию для отладки, если нужно */}
                      {/* <span className="text-[10px] bg-gray-700 px-1 rounded">{user.location}</span> */}
                    </div>
                  </td>
                  {DAYS.slice(0, daysInCurrentMonth).map(d => {
                    const isWork = userSched[d]; 
                    return (
                      <td key={d} className="p-0 text-center border-r border-gray-700 relative">
                        <div
                          onClick={(e) => handleCellClick(user.id, d, e)}
                          className={`w-full h-10 flex items-center justify-center cursor-pointer transition-all select-none ${
                            isWork 
                              ? 'bg-green-600 hover:bg-green-500 text-white shadow-inner' 
                              : 'hover:bg-gray-600 text-transparent'
                          }`}
                          title={`День ${d}: ${isWork ? "Рабочий" : "Выходной"}`}
                        >
                          {isWork ? '✓' : ''}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center font-bold text-blue-400 bg-gray-800/50">
                    {workDaysCount}
                  </td>
                </tr>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={daysInCurrentMonth + 2} className="p-8 text-center text-gray-500">
                  Нет сотрудников для выбранного заведения
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SimpleScheduler;