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

const PERIOD_TYPES = [
  { value: '1-15', label: '1-15 число' },
  { value: '16-end', label: '16-последний день' },
  { value: 'per_hookah', label: 'За кальян' }
];

function RatesManager() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  
  // Форма создания/редактирования
  const [formData, setFormData] = useState({
    role: '',
    rate: '',
    period_type: '1-15',
    effective_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      setLoading(true);
      const response = await API.get('/rates');
      setRates(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки тарифов:', error);
      alert('Ошибка загрузки тарифов');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.role || !formData.rate || !formData.effective_date) {
      alert('Заполните все поля');
      return;
    }

    try {
      if (editingRate) {
        // Обновление существующего тарифа
        await API.put(`/rates/${editingRate.id}`, {
          rate: parseFloat(formData.rate),
          effective_date: formData.effective_date
        });
        alert('✅ Тариф обновлен!');
      } else {
        // Создание нового тарифа
        await API.post('/rates', {
          role: formData.role,
          rate: parseFloat(formData.rate),
          period_type: formData.period_type,
          effective_date: formData.effective_date
        });
        alert('✅ Тариф создан!');
      }

      // Сброс формы
      setFormData({
        role: '',
        rate: '',
        period_type: '1-15',
        effective_date: new Date().toISOString().split('T')[0]
      });
      setShowCreateForm(false);
      setEditingRate(null);
      
      // Перезагрузка данных
      await loadRates();

    } catch (error) {
      console.error('Ошибка сохранения тарифа:', error);
      alert(`❌ Ошибка сохранения: ${error.response?.data?.detail || error.message}`);
    }
  };

  const startEdit = (rate) => {
    setEditingRate(rate);
    setFormData({
      role: rate.role,
      rate: rate.rate.toString(),
      period_type: rate.period_type,
      effective_date: rate.effective_date
    });
    setShowCreateForm(true);
  };

  const cancelEdit = () => {
    setEditingRate(null);
    setFormData({
      role: '',
      rate: '',
      period_type: '1-15',
      effective_date: new Date().toISOString().split('T')[0]
    });
    setShowCreateForm(false);
  };

  const formatCurrency = (amount, periodType) => {
    if (periodType === 'per_hookah') {
      return `₺${amount}/кальян`;
    }
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  const getPeriodLabel = (periodType) => {
    const period = PERIOD_TYPES.find(p => p.value === periodType);
    return period ? period.label : periodType;
  };

  // Группируем тарифы по ролям для отображения
  const groupedRates = rates.reduce((acc, rate) => {
    if (!acc[rate.role]) {
      acc[rate.role] = [];
    }
    acc[rate.role].push(rate);
    return acc;
  }, {});

  // Сортируем тарифы внутри каждой роли по дате (новые сверху)
  Object.keys(groupedRates).forEach(role => {
    groupedRates[role].sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
  });

  const getCurrentRate = (role, periodType) => {
    const roleRates = groupedRates[role] || [];
    const currentDate = new Date().toISOString().split('T')[0];
    
    const validRates = roleRates.filter(rate => 
      rate.period_type === periodType && 
      rate.effective_date <= currentDate
    );
    
    return validRates.length > 0 ? validRates[0] : null;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">💰 Управление тарифами</h1>
          
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? '❌ Отмена' : '➕ Добавить тариф'}
          </button>
        </div>

        {/* Форма создания/редактирования */}
        {showCreateForm && (
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingRate ? `Редактирование тарифа #${editingRate.id}` : 'Создание нового тарифа'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Роль</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    disabled={editingRate} // Роль нельзя менять при редактировании
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-400 disabled:bg-gray-600"
                  >
                    <option value="">Выберите роль</option>
                    {ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Тип периода</label>
                  <select
                    value={formData.period_type}
                    onChange={(e) => setFormData({...formData, period_type: e.target.value})}
                    disabled={editingRate} // Тип периода нельзя менять при редактировании
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-400 disabled:bg-gray-600"
                  >
                    {PERIOD_TYPES.map(period => (
                      <option key={period.value} value={period.value}>{period.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Размер тарифа {formData.period_type === 'per_hookah' ? '(₽/кальян)' : '(₽)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e) => setFormData({...formData, rate: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-400"
                    placeholder="Введите размер тарифа"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Дата начала действия</label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingRate ? '💾 Обновить тариф' : '✅ Создать тариф'}
                </button>
                
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ❌ Отмена
                </button>
              </div>
            </form>

            {editingRate && (
              <div className="mt-4 p-3 bg-yellow-900 border border-yellow-600 rounded">
                <p className="text-yellow-200 text-sm">
                  💡 <strong>Совет:</strong> При редактировании тарифа создается новая запись с новой датой. 
                  Старые тарифы остаются для исторических данных.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Текущие действующие тарифы */}
        <div className="bg-gray-800 rounded-lg mb-6">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">📊 Текущие действующие тарифы</h2>
            <p className="text-gray-300 text-sm">Тарифы, которые используются для расчета новых отчетов ФОТ</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-3 text-left">Роль</th>
                  <th className="p-3 text-center">1-15 число</th>
                  <th className="p-3 text-center">16-последний день</th>
                  <th className="p-3 text-center">За кальян</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map(role => {
                  const rate1_15 = getCurrentRate(role, '1-15');
                  const rate16_end = getCurrentRate(role, '16-end');
                  const ratePerHookah = getCurrentRate(role, 'per_hookah');

                  return (
                    <tr key={role} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="p-3 font-medium">
                        <span className="bg-gray-600 px-2 py-1 rounded text-sm">
                          {role}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {rate1_15 ? (
                          <div>
                            <span className="text-green-400 font-bold">
                              {formatCurrency(rate1_15.rate, rate1_15.period_type)}
                            </span>
                            <p className="text-xs text-gray-400">
                              с {formatDate(rate1_15.effective_date)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {rate16_end ? (
                          <div>
                            <span className="text-green-400 font-bold">
                              {formatCurrency(rate16_end.rate, rate16_end.period_type)}
                            </span>
                            <p className="text-xs text-gray-400">
                              с {formatDate(rate16_end.effective_date)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {ratePerHookah ? (
                          <div>
                            <span className="text-blue-400 font-bold">
                              {formatCurrency(ratePerHookah.rate, ratePerHookah.period_type)}
                            </span>
                            <p className="text-xs text-gray-400">
                              с {formatDate(ratePerHookah.effective_date)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* История всех тарифов */}
        <div className="bg-gray-800 rounded-lg">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">📚 История всех тарифов</h2>
            <p className="text-gray-300 text-sm">Все созданные тарифы с историей изменений</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p>🔄 Загрузка тарифов...</p>
            </div>
          ) : Object.keys(groupedRates).length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p>📋 Тарифов пока нет</p>
              <p className="text-sm mt-2">Создайте первый тариф</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Роль</th>
                    <th className="p-3 text-center">Период</th>
                    <th className="p-3 text-right">Размер</th>
                    <th className="p-3 text-center">Действует с</th>
                    <th className="p-3 text-center">Статус</th>
                    <th className="p-3 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedRates).map(role => 
                    groupedRates[role].map(rate => {
                      const isActive = rate.effective_date <= new Date().toISOString().split('T')[0];
                      const isCurrent = getCurrentRate(role, rate.period_type)?.id === rate.id;

                      return (
                        <tr key={rate.id} className="border-t border-gray-700 hover:bg-gray-750">
                          <td className="p-3 font-mono text-sm">#{rate.id}</td>
                          <td className="p-3">
                            <span className="bg-gray-600 px-2 py-1 rounded text-sm">
                              {rate.role}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-blue-900 px-2 py-1 rounded text-sm">
                              {getPeriodLabel(rate.period_type)}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold">
                            {formatCurrency(rate.rate, rate.period_type)}
                          </td>
                          <td className="p-3 text-center">
                            {formatDate(rate.effective_date)}
                          </td>
                          <td className="p-3 text-center">
                            {isCurrent ? (
                              <span className="bg-green-600 px-2 py-1 rounded text-xs font-medium">
                                ✅ Текущий
                              </span>
                            ) : isActive ? (
                              <span className="bg-yellow-600 px-2 py-1 rounded text-xs font-medium">
                                📊 Активный
                              </span>
                            ) : (
                              <span className="bg-gray-600 px-2 py-1 rounded text-xs font-medium">
                                ⏳ Будущий
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => startEdit(rate)}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              ✏️ Редактировать
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
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
              <h3 className="text-lg font-semibold mb-2">Как работают тарифы</h3>
              <ul className="text-blue-100 space-y-1 text-sm">
                <li>• <strong>Кальянщики:</strong> получают фиксированную сумму за каждый проданный кальян</li>
                <li>• <strong>Остальные роли:</strong> получают фиксированную сумму за период (1-15 или 16-конец месяца)</li>
                <li>• <strong>Дата начала действия:</strong> с какой даты тариф становится активным</li>
                <li>• <strong>История:</strong> старые тарифы сохраняются для исторических отчетов</li>
                <li>• <strong>Текущий тариф:</strong> самый новый активный тариф для каждой роли и периода</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RatesManager;