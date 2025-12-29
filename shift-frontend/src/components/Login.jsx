import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Отправляем форму (application/x-www-form-urlencoded)
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await API.post('/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Сохраняем данные
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('userRole', response.data.role); // 'admin' или 'manager'
      localStorage.setItem('userName', response.data.name);

      // Перенаправляем на дашборд
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Неверный логин или пароль');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96 border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Shift Manager 🔐</h1>
        {error && <div className="bg-red-900/50 text-red-200 p-2 rounded mb-4 text-sm text-center">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm">Логин</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 mt-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
              placeholder="Введите логин"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 mt-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
              placeholder="••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded font-medium transition-colors"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;