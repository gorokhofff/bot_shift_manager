import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Users from './components/Users';
import Shifts from './components/Shifts';
import Reports from './components/Reports';
import ShiftSummary from './components/ShiftSummary';
import AdminDashboard from './components/AdminDashboard';
import ReportsPage from './components/ReportsPage'; 
import PayrollManagerV2 from './components/PayrollManagerV2'; 
import RatesManager from './components/RatesManager'; 
import WorkPlansManager from './components/WorkPlansManager'; 
import EmployeeSchedules from './components/EmployeeSchedules'; 
import Layout from './components/Layout';
import IdleMonitor from './components/IdleMonitor';
import RequireAuth from './components/RequireAuth'; // Импортируем защитника

function App() {
  return (
    <Router>
      <IdleMonitor />
      <Routes>
        {/* Публичный маршрут */}
        <Route path="/" element={<Login />} />

        {/* ЗАЩИЩЕННЫЕ МАРШРУТЫ */}
        {/* Сначала проверяем авторизацию, потом показываем Layout (меню) */}
        
        {/* ГРУППА 1: Доступно ВСЕМ (Admin и Manager) */}
        <Route element={<RequireAuth allowedRoles={['admin', 'manager']} />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employee-schedules" element={<EmployeeSchedules />} />
            <Route path="/payroll" element={<PayrollManagerV2 />} />
            <Route path="/shift-summary" element={<ShiftSummary />} />
          </Route>
        </Route>

        {/* ГРУППА 2: Доступно ТОЛЬКО АДМИНУ */}
        <Route element={<RequireAuth allowedRoles={['admin']} />}>
          <Route element={<Layout />}>
            <Route path="/users" element={<Users />} />
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports-parse" element={<ReportsPage />} />
            <Route path="/rates" element={<RatesManager />} />
            <Route path="/work-plans" element={<WorkPlansManager />} />
            <Route path="/adminDashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

      </Routes>
    </Router>
  );
}

export default App;