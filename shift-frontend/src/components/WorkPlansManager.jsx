import React, { useState, useEffect } from 'react';
import API from '../api';

const ROLES = [
  'кальянщик',
  'старший кальянщик', 
  'администратор',
  'уборщик',
  'студент',
  'бармен/зал'
];

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

function WorkPlansManager() {
  const [workPlans, setWorkPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Локальное состояние для редактирования
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadWorkPlans();
  }, [selectedYear, selectedMonth]);

  const loadWorkPlans = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/work-plans/${selectedYear}/${selectedMonth}`);
      
      // Конвертируем объект в массив с добавлением недостающих ролей
      const plansData = {};
      ROLES.forEach(role => {
        plansData[role] = response.data[role] || 160; // По умолчанию 160 часов
      });
      
      setWorkPlans(plansData);
      setEditData(plansData);
      setHasChanges(false);
    } catch (error) {
      console.error('Ошибка загрузки планов:', error);
      // Если планов нет, создаем дефолтные
      const defaultPlans = {};
      ROLES.forEach(role => {
        defaultPlans[role] = 160;
      });
      setWorkPlans(defaultPlans);
      setEditData(defaultPlans);
    } finally {
      setLoading(false);
    }
  };

  const updatePlan = (role, hours) => {
    const newEditData = { ...editData };
    newEditData[role] = parseFloat(hours) || 0;
    setEditData(newEditData);
    
    // Проверяем изменения
    const hasAnyChanges = ROLES.some(r => editData[r] !== workPlans[r]);
    setHasChanges(hasAnyChanges);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Сохраняем каждый план
      for (const role of ROLES) {
        if (editData[role] !== workPlans[role]) {
          await API.post('/work-plans', {
            role: role,
            year: selectedYear,
            month: selectedMonth,
            planned_hours: editData[role]
          });
        }
      }

      setWorkPlans({ ...editData });
      setHasChanges(false);
      setEditMode(false);
      alert('✅ Планы сохранены!');

    } catch (error) {
      console.error('❌ Ошибка сохранения планов:', error);
      alert(`❌ Ошибка сохранения: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleEditMode = () => {
    if (editMode && hasChanges) {
      const confirm = window.confirm('У вас есть несохраненные изменения. Выйти из режима редактирования?');
      if (!confirm) return;
    }

    if (editMode) {
      // Сбрасываем изменения
      setEditData({ ...workPlans });
      setHasChanges(false);
    }

    setEditMode(!editMode);
  };

  const copyFromPreviousMonth = async () => {
    let prevYear = selectedYear;
    let prevMonth = selectedMonth - 1;
    
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = selectedYear - 1;
    }

    try {
      const response = await API.get(`/work-plans/${prevYear}/${prevMonth}`);
      
      if (Object.keys(response.data).length > 0) {
        const newEditData = { ...editData };
        ROLES.forEach(role => {
          if (response.data[role]) {
            newEditData[role] = response.data[role];
          }
        });
        
        setEditData(newEditData);
        setHasChanges(true);
        alert(`✅ Планы скопированы из ${MONTHS[prevMonth - 1]} ${prevYear}`);
      } else {
        alert(`⚠️ Планы для ${MONTHS[prevMonth - 1]} ${prevYear} не найдены`);
      }
    } catch (error) {
      console.error('Ошибка копирования планов:', error);
      alert('❌ Ошибка копирования планов из предыдущего месяца');
    }
  };

  const setDefaultPlans = () => {
    const defaultHours = {
      'кальянщик': 160,
      'старший кальянщик': 180,
      'администратор': 170,
      'уборщик': 160,
      'студент': 120,
      'бармен/зал': 160
    };

    setEditData(defaultHours);
    setHasChanges(true);
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const getHoursPerDay = (role) => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const hours = editData[role] || 0;
    return (hours / daysInMonth).toFixed(1);
  };

  const getTotalHours = () => {
    return ROLES.reduce((sum, role) => sum + (editData[role] || 0), 0);
  };

  const getAverageHours = () => {
    const total = getTotalHours();
    return (total / ROLES.length).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">📅 Планы рабочего времени</h1>
          
          <div className="flex gap-3">
            {editMode && (
              <>
                <button
                  onClick={copyFromPreviousMonth}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  📋 Копировать из пред. месяца
                </button>
                
                <button
                  onClick={setDefaultPlans}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  🔄 Установить по умолчанию
                </button>
              </>
            )}
            
            <button
              onClick={toggleEditMode}
              className={`px-4 py-2 rounded-lg transition-colors ${
                editMode 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {editMode ? '❌ Отменить' : '✏️ Редактировать'}
            </button>

            {editMode && hasChanges && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors"
              >
                {saving ? '💾 Сохранение...' : '💾 Сохранить'}
              </button>
            )}
          </div>
        </div>

        {/* Селекторы периода */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Год</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                disabled={editMode}
                className="p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 disabled:bg-gray-600"
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
                disabled={editMode}
                className="p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500 disabled:bg-gray-600"
              >
                {MONTHS.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto">
              <label className="block text-sm font-medium mb-2">Дней в месяце</label>
              <div className="text-lg font-bold text-blue-400">
                {getDaysInMonth(selectedYear, selectedMonth)}
              </div>
            </div>
          </div>

          {editMode && (
            <div className="mt-4 p-3 bg-blue-900 border border-blue-600 rounded">
              <p className="text-blue-200 text-sm">
                💡 <strong>Режим редактирования:</strong> Измените планы часов для каждой роли. 
                Можете скопировать из предыдущего месяца или установить значения по умолчанию.
              </p>
            </div>
          )}
        </div>

        {/* Таблица планов */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">
              📋 Планы на {MONTHS[selectedMonth - 1]} {selectedYear}
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p>🔄 Загрузка планов...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">Роль</th>
                    <th className="p-3 text-center">План часов/месяц</th>
                    <th className="p-3 text-center">Часов в день</th>
                    <th className="p-3 text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role, index) => (
                    <tr key={role} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {role === 'кальянщик' ? '💨' :
                             role === 'старший кальянщик' ? '👑' :
                             role === 'администратор' ? '⚙️' :
                             role === 'уборщик' ? '🧹' :
                             role === 'студент' ? '🎓' :
                             role === 'бармен/зал' ? '🍹' : '👤'}
                          </span>
                          <span className="font-medium">{role}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            max="744"
                            step="0.5"
                            value={editData[role] || ''}
                            onChange={(e) => updatePlan(role, e.target.value)}
                            className="w-24 p-2 bg-gray-700 border border-gray-600 rounded text-center focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-lg font-bold text-blue-400">
                            {editData[role] || 0} ч
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center text-gray-300">
                        {getHoursPerDay(role)} ч/день
                      </td>
                      <td className="p-3 text-center">
                        {(editData[role] || 0) > 0 ? (
                          <span className="bg-green-600 px-2 py-1 rounded text-xs font-medium">
                            ✅ Установлен
                          </span>
                        ) : (
                          <span className="bg-red-600 px-2 py-1 rounded text-xs font-medium">
                            ❌ Не задан
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-700 border-t-2 border-gray-600">
                  <tr>
                    <td className="p-3 font-bold">ИТОГО:</td>
                    <td className="p-3 text-center font-bold text-xl text-green-400">
                      {getTotalHours()} ч
                    </td>
                    <td className="p-3 text-center font-bold text-gray-300">
                      {getAverageHours()} ч/день (среднее)
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Информационная панель */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 p-6 rounded-lg border border-blue-700">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                💡
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Как работают планы рабочего времени</h3>
              <ul className="text-blue-100 space-y-1 text-sm">
                <li>• <strong>План часов/месяц:</strong> сколько часов должен отработать сотрудник за месяц</li>
                <li>• <strong>Часов в день:</strong> среднее количество часов в день (план/дни в месяце)</li>
                <li>• <strong>Использование:</strong> планы используются при создании отчетов ФОТ для расчета зарплат</li>
                <li>• <strong>Копирование:</strong> можно скопировать планы из предыдущего месяца</li>
                <li>• <strong>По умолчанию:</strong> рекомендуемые значения для каждой роли</li>
              </ul>
              
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-800 p-3 rounded">
                  <div className="font-semibold">Кальянщики</div>
                  <div className="text-blue-200">160-180 ч/мес</div>
                </div>
                <div className="bg-blue-800 p-3 rounded">
                  <div className="font-semibold">Администраторы</div>
                  <div className="text-blue-200">170 ч/мес</div>
                </div>
                <div className="bg-blue-800 p-3 rounded">
                  <div className="font-semibold">Остальные</div>
                  <div className="text-blue-200">120-160 ч/мес</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkPlansManager;