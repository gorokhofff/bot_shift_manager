import { useEffect, useState } from 'react';
import API from '../api';
import { parseISO, getYear, getMonth } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

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
  
  // Подключаем переводы
  const { t, getMonthName } = useLanguage();

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, selectedLocation]);

  const fetchData = async () => {
    try {
      const usersRes = await API.get('/users');
      const shiftsRes = await API.get('/shifts');
      
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
    } catch (error) {
      console.error(error);
    }
  };

  const extractLocations = (shiftsData) => {
    const uniqueLocations = [...new Set(shiftsData.map(shift => shift.location))].filter(Boolean);
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
      
      summaryData[userId][day] = (summaryData[userId][day] || 0) + (shift.duration_hours || 0);
    });

    setSummary(summaryData);
  };

  const formatHours = (hours) => {
    if (!hours || hours === 0) return <span className="text-gray-600 text-xs">-</span>;
    
    const totalMinutes = Math.round(hours * 60);
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

  const getCellClass = (userId, day, hours) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    if (selectedYear > currentYear || 
        (selectedYear === currentYear && selectedMonth > currentMonth) ||
        (selectedYear === currentYear && selectedMonth === currentMonth && day >= currentDay)) {
      return "p-1 border border-gray-700 text-center align-middle w-9 h-9";
    }
    
    const userSchedule = employeeSchedules[userId] || {};
    const daySchedule = userSchedule[day];
    const isWorkday = daySchedule ? daySchedule.is_workday : true;
    
    if (isWorkday) {
      if (!hours || hours <= 0) {
        return "p-1 border border-gray-700 text-center align-middle w-9 h-9 bg-red-900/40 text-red-200";
      }
    } else {
      if (hours > 0) {
        return "p-1 border border-gray-700 text-center align-middle w-9 h-9 bg-blue-900/40 text-blue-200";
      }
    }
    
    return "p-1 border border-gray-700 text-center align-middle w-9 h-9";
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
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="p-4 w-full bg-gray-900 min-h-screen text-white">
      <div className="max-w-full mx-auto">
        <h1 className="text-2xl mb-6 font-bold text-center">{t('summ_title')}</h1>
        
        {/* Фильтры */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="flex flex-col">
            <label className="text-xs text-gray-400 mb-1">{t('sched_year')}</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="p-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            >
              {[2023, 2024, 2025].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-400 mb-1">{t('sched_month')}</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="p-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            >
              {Array.from({length: 12}, (_, i) => i).map((i) => (
                <option key={i} value={i}>{getMonthName(i)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-400 mb-1">{t('sched_location')}</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="p-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">{t('sched_all_locations')}</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Таблица */}
        <div className="overflow-x-auto rounded border border-gray-700 bg-gray-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-3 border-b border-r border-gray-600 cursor-pointer text-left min-w-[150px] sticky left-0 bg-gray-700 z-10" onClick={() => handleSort('name')}>
                  {t('summ_name')}{renderSortArrow('name')}
                </th>
                {daysInMonth.map(day => (
                  <th key={day} className="p-1 border-b border-r border-gray-600 text-center w-9 text-xs text-gray-400 font-normal">
                    {day}
                  </th>
                ))}
                <th className="p-2 border-b border-r border-gray-600 cursor-pointer text-center w-16 text-xs font-semibold" onClick={() => handleSort('firstHalf')}>
                  1–15{renderSortArrow('firstHalf')}
                </th>
                <th className="p-2 border-b border-r border-gray-600 cursor-pointer text-center w-16 text-xs font-semibold" onClick={() => handleSort('secondHalf')}>
                  16–31{renderSortArrow('secondHalf')}
                </th>
                <th className="p-2 border-b border-gray-600 cursor-pointer text-center w-16 text-xs font-bold text-blue-300" onClick={() => handleSort('monthlyTotal')}>
                  {t('summ_total')}{renderSortArrow('monthlyTotal')}
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
                  <tr key={user.id} className="hover:bg-gray-700/50 transition-colors group">
                    <td className="p-2 border-b border-r border-gray-700 font-medium whitespace-nowrap sticky left-0 bg-gray-800 group-hover:bg-gray-700/50 z-10">
                      {user.name}
                    </td>
                    {daysInMonth.map(day => {
                      const hours = userSummary[day] || 0;
                      return (
                        <td key={day} className={getCellClass(user.id, day, hours)}>
                          {formatHours(hours)}
                        </td>
                      );
                    })}
                    <td className="p-1 border-b border-r border-gray-700 text-center font-medium bg-gray-800/30">{formatHours(firstHalfSum)}</td>
                    <td className="p-1 border-b border-r border-gray-700 text-center font-medium bg-gray-800/30">{formatHours(secondHalfSum)}</td>
                    <td className="p-1 border-b border-gray-700 text-center font-bold text-blue-300 bg-gray-800/50">{formatHours(monthlyTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Легенда */}
        <div className="mt-6 flex flex-wrap gap-6 justify-center text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-900/40 border border-red-800 rounded flex items-center justify-center text-[10px] text-red-200 font-bold">8</div>
              <span>{t('summ_legend_red')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-900/40 border border-blue-800 rounded flex items-center justify-center text-[10px] text-blue-200 font-bold">8</div>
              <span>{t('summ_legend_blue')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-gray-700 rounded flex items-center justify-center text-[10px] text-gray-400 font-bold">8</div>
              <span>{t('summ_legend_norm')}</span>
            </div>
        </div>
      </div>
    </div>
  );
}

export default ShiftSummary;