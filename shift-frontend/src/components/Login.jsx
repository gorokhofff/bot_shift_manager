import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await API.post('/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('userRole', response.data.role);
      localStorage.setItem('userName', response.data.name);

      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0F1115] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
           <h1 className="text-3xl font-bold text-white tracking-tight">ShiftManager</h1>
           <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700/50 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-900/10 border-l-2 border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-14 px-4 bg-gray-900 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-base"
                placeholder="Enter username"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 px-4 bg-gray-900 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-base"
                placeholder="••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-base transition-colors focus:ring-4 focus:ring-blue-900 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;