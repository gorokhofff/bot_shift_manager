import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Users from './components/Users';
import Shifts from './components/Shifts';
import Reports from './components/Reports';
import ShiftSummary from './components/ShiftSummary';
import AdminDashboard from './components/AdminDashboard';
import ReportsPage from './components/ReportsPage'; // Страница с аудитом отчетов
import PayrollManagerV2 from './components/PayrollManagerV2'; // НОВАЯ система ФОТ v2
import RatesManager from './components/RatesManager'; // Управление тарифами
import WorkPlansManager from './components/WorkPlansManager'; // НОВЫЙ компонент для планов
import EmployeeSchedules from './components/EmployeeSchedules'; // НОВЫЙ компонент для расписаний сотрудников

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/shift-summary" element={<ShiftSummary />} />
        <Route path="/users" element={<Users />} />
        <Route path="/shifts" element={<Shifts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports-parse" element={<ReportsPage />} /> {/* Страница с парсером и аудитом */}
        <Route path="/payroll" element={<PayrollManagerV2 />} /> {/* НОВАЯ система ФОТ v2 */}
        <Route path="/rates" element={<RatesManager />} /> {/* Управление тарифами */}
        <Route path="/work-plans" element={<WorkPlansManager />} /> {/* НОВЫЕ планы рабочего времени */}
        <Route path="/employee-schedules" element={<EmployeeSchedules />} /> {/* НОВЫЕ расписания сотрудников */}
        <Route path="/adminDashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;