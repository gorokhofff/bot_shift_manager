import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isTokenExpired } from '../utils/jwt';

const RequireAuth = ({ allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole'); 
  const location = useLocation();

  // 1. Если токена нет ИЛИ он истек — выкидываем
  if (!token || isTokenExpired(token)) {
    // Чистим мусор, если токен был, но протух
    if (token) localStorage.clear();
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // 2. Проверка ролей (как и раньше)
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default RequireAuth;