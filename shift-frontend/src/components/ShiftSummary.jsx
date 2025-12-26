import { useEffect, useState } from 'react';
import API from '../api';
import { parseISO, getYear, getMonth } from 'date-fns';

const monthNames = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

function ShiftSummary() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [summary, setSummary] = useState({});
  const [locations, setLocations] = useState([]);
  const [employeeSchedules, setEmployeeSchedules] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedLocation, setSelectedLocation] = useState('');

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, selectedLocation]);

  const fetchData = async () => {
    const usersRes = await API.get('/users');
    const shiftsRes = await API.get('/shifts');
    
    // Получаем индивидуальные расписания для всех сотрудников
    const schedulePromises = usersRes.data.map(user => 
      API.get(`/employee-schedules/${user.id}/${selectedYear}/${selectedMonth + 1}`)
        .catch(() => ({ data: {} }))
    );
    const schedulesRes = await Promise.all(schedulePromises);
    
    const allSchedules = {};
    usersRes.data.forEach((user, index) => {
      allSchedules[user.id] = schedulesRes[index].data;
    });
    
    setUsers(usersRes.data);
    setShifts(shiftsRes.data);
    setEmployeeSchedules(allSchedules);
    extractLocations(shiftsRes.data);
    calculateSummary(usersRes.data, shiftsRes.data);
  };

  const extractLocations = (shiftsData) => {
    const uniqueLocations = [...new Set(shiftsData.map(shift => shift.location))];
    setLocations(uniqueLocations);
  };

  const calculateSummary = (usersData, shiftsData) => {
    const summaryData = {};

    shiftsData.forEach(shift => {
      if (!shift.shift_date) return;
      const shiftDate = parseISO(shift.shift_date);
      if (getYear(shiftDate) !== selectedYear || getMonth(shiftDate) !== selectedMonth) return;
      if (selectedLocation && shift.location !== selectedLocation) return;
      
      const day = shiftDate.getDate();
      const userId = shift.user_id;
      
      if (!summaryData[userId]) {
        summaryData[userId] = {};
      }
      
      // Суммируем часы если уже есть запись на этот день
      summaryData[userId][day] = (summaryData[userId][day] || 0) + (shift.duration_hours || 0);
    });

    setSummary(summaryData);
  };

  // Функция для форматирования времени в ЧЧ:ММ с округлением до 15 минут (компактно)
  const formatHours = (hours) => {
    if (!hours || hours === 0) return <span className="text-gray-500 text-xs">-</span>;
    
    const totalMinutes = Math.round(hours * 60);
    // Округляем до кратного 15
    const roundedMinutes = Math.round(totalMinutes / 15) * 15;
    
    const displayHours = Math.floor(roundedMinutes / 60);
    const displayMins = roundedMinutes % 60;
    
    return (
      <div className="text-xs leading-none">
        <div className="font-semibold text-white">{displayHours.toString().padStart(2, '0')}</div>
        <div className="text-gray-400 text-[10px]">{displayMins.toString().padStart(2, '0')}</div>
      </div>
    );
  };

  // Функция для получения CSS класса ячейки на основе индивидуального расписания
  const getCellClass = (userId, day, hours) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Только для прошедших дней
    if (selectedYear > currentYear || 
        (selectedYear === currentYear && selectedMonth > currentMonth) ||
        (selectedYear === currentYear && selectedMonth === currentMonth && day >= currentDay)) {
      return "p-1 border border-gray-600 text-center align-middle w-9 h-8";
    }
    
    // Проверяем индивидуальное расписание сотрудника
    const userSchedule = employeeSchedules[userId] || {};
    const daySchedule = userSchedule[day];
    const isWorkday = daySchedule ? daySchedule.is_workday : true; // По умолчанию рабочий день
    
    if (isWorkday) {
      // Рабочий день: красный если не работал или отрицательные часы
      if (!hours || hours <= 0) {
        return "p-1 border border-gray-600 text-center align-middle w-9 h-8 bg-red-800 text-red-200";
      }
    } else {
      // Выходной день: оранжевый если работал
      if (hours > 0) {
        return "p-1 border border-gray-600 text-center align-middle w-9 h-8 bg-blue-800 text-orange-200";
      }
    }
    
    return "p-1 border border-gray-600 text-center align-middle w-9 h-8";
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = [...users].sort((a, b) => {
    const getSum = (user, rangeStart, rangeEnd) => {
      let sum = 0;
      for (let day = rangeStart; day <= rangeEnd; day++) {
        sum += summary[user.id]?.[day] || 0;
      }
      return sum;
    };

    if (sortConfig.key === 'name') {
      return sortConfig.direction === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    if (sortConfig.key === 'firstHalf') {
      return sortConfig.direction === 'asc'
        ? getSum(a, 1, 15) - getSum(b, 1, 15)
        : getSum(b, 1, 15) - getSum(a, 1, 15);
    }
    if (sortConfig.key === 'secondHalf') {
      return sortConfig.direction === 'asc'
        ? getSum(a, 16, 31) - getSum(b, 16, 31)
        : getSum(b, 16, 31) - getSum(a, 16, 31);
    }
    if (sortConfig.key === 'monthlyTotal') {
      return sortConfig.direction === 'asc'
        ? getSum(a, 1, 31) - getSum(b, 1, 31)
        : getSum(b, 1, 31) - getSum(a, 1, 31);
    }
    return 0;
  });

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const renderSortArrow = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="px-2 py-4 w-full flex justify-center bg-gray-900 min-h-screen">
      <div className="w-full max-w-full px-2">
        <h1 className="text-2xl mb-6 font-bold text-white text-center">Shift Summary</h1>
        <div className="flex flex-wrap justify-center items-center gap-3 mb-4 px-2">
          <div className="flex flex-col text-white">
            <label className="text-sm mb-1">Yıl</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="p-2 bg-gray-800 text-white rounded-md shadow text-sm"
            >
              {[2023, 2024, 2025].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col text-white">
            <label className="text-sm mb-1">Ay</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="p-2 bg-gray-800 text-white rounded-md shadow text-sm"
            >
              {monthNames.map((month, i) => (
                <option key={i} value={i}>{month}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col text-white">
            <label className="text-sm mb-1">Lokasyon</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="p-2 bg-gray-800 text-white rounded-md shadow text-sm"
            >
              <option value="">Tümü</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl shadow-xl border border-gray-700 bg-gray-800">
          <table className="w-full text-white" style={{ minWidth: 'max-content' }}>
            <thead className="bg-gray-700">
              <tr>
                <th className="p-2 border border-gray-600 cursor-pointer whitespace-nowrap text-left w-28 text-sm" onClick={() => handleSort('name')}>
                  Name{renderSortArrow('name')}
                </th>
                {daysInMonth.map(day => (
                  <th key={day} className="p-1 border border-gray-600 text-center text-xs w-9 h-8">{day}</th>
                ))}
                <th className="p-1 border border-gray-600 cursor-pointer whitespace-nowrap text-center w-12 text-xs" onClick={() => handleSort('firstHalf')}>
                  1–15{renderSortArrow('firstHalf')}
                </th>
                <th className="p-1 border border-gray-600 cursor-pointer whitespace-nowrap text-center w-12 text-xs" onClick={() => handleSort('secondHalf')}>
                  16–31{renderSortArrow('secondHalf')}
                </th>
                <th className="p-1 border border-gray-600 cursor-pointer whitespace-nowrap text-center w-14 text-xs" onClick={() => handleSort('monthlyTotal')}>
                  Итог{renderSortArrow('monthlyTotal')}
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedUsers.map(user => {
                const userSummary = summary[user.id] || {};
                const firstHalfSum = daysInMonth.slice(0, 15).reduce((sum, day) => sum + (userSummary[day] || 0), 0);
                const secondHalfSum = daysInMonth.slice(15).reduce((sum, day) => sum + (userSummary[day] || 0), 0);
                const monthlyTotal = firstHalfSum + secondHalfSum;

                if (monthlyTotal === 0) return null;

                return (
                  <tr key={user.id} className="odd:bg-gray-700">
                    <td className="p-2 border border-gray-600 font-semibold text-xs whitespace-nowrap">{user.name}</td>
                    {daysInMonth.map(day => {
                      const hours = userSummary[day] || 0;
                      return (
                        <td key={day} className={getCellClass(user.id, day, hours)}>
                          {formatHours(hours)}
                        </td>
                      );
                    })}
                    <td className="p-1 border border-gray-600 text-center font-semibold text-xs">{formatHours(firstHalfSum)}</td>
                    <td className="p-1 border border-gray-600 text-center font-semibold text-xs">{formatHours(secondHalfSum)}</td>
                    <td className="p-1 border border-gray-600 text-center font-bold text-xs">{formatHours(monthlyTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Легенда цветов */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3 text-white">📋 Легенда</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-3 p-3 bg-red-900 border border-red-700 rounded-lg">
              <div className="w-6 h-6 bg-red-800 border border-red-600 rounded flex items-center justify-center">
                <span className="text-red-200 text-xs font-bold">08<br/>15</span>
              </div>
              <div>
                <div className="font-semibold text-red-200">🔴 Красный</div>
                <div className="text-red-300 text-xs">Не отметился, а смена была по расписанию</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-900 border border-blue-700 rounded-lg">
              <div className="w-6 h-6 bg-blue-800 border border-blue-600 rounded flex items-center justify-center">
                <span className="text-blue-200 text-xs font-bold">08<br/>15</span>
              </div>
              <div>
                <div className="font-semibold text-blue-200">🔵 Синий</div>
                <div className="text-blue-300 text-xs">Отметился, а по расписанию выходной</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-700 border border-gray-600 rounded-lg">
              <div className="w-6 h-6 bg-gray-600 border border-gray-500 rounded flex items-center justify-center">
                <span className="text-gray-200 text-xs font-bold">08<br/>15</span>
              </div>
              <div>
                <div className="font-semibold text-gray-200">⚫ Бесцветный</div>
                <div className="text-gray-300 text-xs">Все ровно: работал по расписанию или отдыхал в выходной</div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-600">
            <p className="text-xs text-gray-400 text-center">
              💡 Подсветка действует только для прошедших дней. Будущие дни отображаются обычным цветом.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShiftSummary;