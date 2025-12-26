import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import API from '../api';
import ReportsCalendar from './ReportsCalendar'; // Новый компонент календаря

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [reports, setReports] = useState([]);
  const [payrollReports, setPayrollReports] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, shiftsRes, reportsRes] = await Promise.all([
          API.get('/users'),
          API.get('/shifts'),
          API.get('/reports')
        ]);

        setUsers(usersRes.data);
        setShifts(shiftsRes.data);
        setReports(reportsRes.data);

        // Пытаемся загрузить отчеты ФОТ (если система уже мигрирована)
        try {
          const payrollRes = await API.get('/payroll/reports');
          setPayrollReports(payrollRes.data || []);
        } catch (error) {
          console.log('ФОТ система еще не мигрирована или недоступна');
          setPayrollReports([]);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    }
    fetchData();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const shiftsToday = shifts.filter(s => s.start_time && s.start_time.startsWith(today));
  const reportsToday = reports.filter(r => r.created_at && r.created_at.startsWith(today));

  // Статистика по ФОТ
  const draftPayrollReports = payrollReports.filter(r => r.status === 'draft').length;
  const finalizedPayrollReports = payrollReports.filter(r => r.status === 'finalized').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Карточки метрик */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl mb-4">Sistemdeki Kullanıcılar</h2>
          <p className="text-4xl font-bold">{users.length}</p>
          <Link to="/users" className="text-blue-400 hover:underline">Detaylar</Link>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl mb-4">Bugünkü Şiftler</h2>
          <p className="text-4xl font-bold">{shiftsToday.length}</p>
          <Link to="/shifts" className="text-blue-400 hover:underline">Detaylar</Link>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl mb-4">Bugünkü Raporlar</h2>
          <p className="text-4xl font-bold">{reportsToday.length}</p>
          <Link to="/reports" className="text-blue-400 hover:underline">Detaylar</Link>
        </div>

        {/* Карточка для ФОТ */}
        <div className="bg-gradient-to-br from-green-800 to-green-600 p-6 rounded-lg shadow-lg border-2 border-green-500">
          <h2 className="text-xl mb-4 flex items-center">
            💰 Отчеты ФОТ
          </h2>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-green-100">Черновики:</span>
            <span className="text-2xl font-bold text-yellow-300">{draftPayrollReports}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-green-100">Финализированы:</span>
            <span className="text-2xl font-bold text-green-300">{finalizedPayrollReports}</span>
          </div>
          <Link to="/payroll" className="text-green-200 hover:text-white hover:underline font-medium">
            Управление ФОТ →
          </Link>
        </div>
      </div>

      {/* Календарь отчетов вместо графика */}
      <div className="mb-8">
        <ReportsCalendar />
      </div>

      {/* Быстрые ссылки */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Hızlı Erişim</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/users" className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            👥 Kullanıcı Yönetimi
          </Link>
          <Link to="/shift-summary" className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            📊 Şift Özeti
          </Link>
          <Link to="/shifts" className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            ⏰ Şift Yönetimi
          </Link>
          <Link to="/reports" className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            📋 Raporlar (Простые)
          </Link>
          <Link to="/reports-parse" className="block p-4 bg-blue-700 rounded-lg hover:bg-blue-600 border-2 border-blue-500 transition-colors">
            🔧 Парсер Отчетов
          </Link>
          
          {/* Ссылка на ФОТ */}
          <Link to="/payroll" className="block p-4 bg-gradient-to-r from-green-700 to-green-600 rounded-lg hover:from-green-600 hover:to-green-500 border-2 border-green-500 transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <span className="font-semibold">💰 Система ФОТ</span>
              <span className="text-green-200 text-sm">NEW!</span>
            </div>
            <p className="text-sm text-green-100 mt-1">Расчет зарплат</p>
          </Link>
          
          <Link to="/rates" className="block p-4 bg-purple-700 rounded-lg hover:bg-purple-600 border-2 border-purple-500 transition-colors">
            📊 Управление тарифами
          </Link>
          
          <Link to="/adminDashboard" className="block p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            ⚙️ Админ Панель
          </Link>
        </div>
      </div>

      {/* Последние отчеты ФОТ (если есть) */}
      {payrollReports.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">📊 Последние отчеты ФОТ</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Заведение</th>
                    <th className="p-3 text-left">Период</th>
                    <th className="p-3 text-right">Выручка</th>
                    <th className="p-3 text-center">Статус</th>
                    <th className="p-3 text-left">Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollReports.slice(0, 5).map(report => {
                    const establishments = {1: "Yenibosna", 2: "Göktürk"};
                    
                    return (
                      <tr key={report.id} className="border-t border-gray-700 hover:bg-gray-750">
                        <td className="p-3 font-mono text-sm">#{report.id}</td>
                        <td className="p-3">{establishments[report.establishment_id] || 'Неизвестно'}</td>
                        <td className="p-3 text-sm">
                          {new Date(report.period_start).toLocaleDateString('ru-RU')} - 
                          {new Date(report.period_end).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {report.revenue ? 
                            new Intl.NumberFormat('tr-TR', {
                              style: 'currency',
                              currency: 'TRY',
                              minimumFractionDigits: 0
                            }).format(report.revenue) : 
                            '—'
                          }
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.status === 'finalized' 
                              ? 'bg-green-600 text-green-100' 
                              : 'bg-yellow-600 text-yellow-100'
                          }`}>
                            {report.status === 'finalized' ? 'Финализирован' : 'Черновик'}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-400">
                          {new Date(report.created_at).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {payrollReports.length > 5 && (
              <div className="p-4 border-t border-gray-700 text-center">
                <Link 
                  to="/payroll" 
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Посмотреть все отчеты ФОТ ({payrollReports.length}) →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Подсказка для первого использования */}
      {payrollReports.length === 0 && (
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-6 rounded-lg border border-blue-700">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                💡
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Новая возможность: Система ФОТ</h3>
              <p className="text-blue-100 mb-3">
                Теперь вы можете автоматически рассчитывать зарплаты сотрудников на основе 
                отработанных часов, продаж кальянов и настраиваемых тарифов.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-blue-700 px-3 py-1 rounded-full text-sm">✅ Автоматический расчет</span>
                <span className="bg-blue-700 px-3 py-1 rounded-full text-sm">✅ Мотивационные выплаты</span>
                <span className="bg-blue-700 px-3 py-1 rounded-full text-sm">✅ Учет авансов и вычетов</span>
                <span className="bg-blue-700 px-3 py-1 rounded-full text-sm">✅ История изменений</span>
              </div>
              <Link 
                to="/payroll" 
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                💰 Создать первый отчет ФОТ
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;