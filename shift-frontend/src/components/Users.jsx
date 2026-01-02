import { useEffect, useState } from 'react';
import API from '../api';

function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    API.get('/users').then(res => setUsers(res.data));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white tracking-tight">Users</h1>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="p-4 font-bold tracking-wider">Name</th>
              <th className="p-4 font-bold tracking-wider hidden sm:table-cell">Telegram ID</th>
              <th className="p-4 font-bold tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-700/30 transition-colors h-16">
                <td className="p-4">
                  <div className="font-medium text-white text-base">{u.name}</div>
                  <div className="text-xs text-gray-500 sm:hidden mt-1">ID: {u.telegram_id}</div>
                </td>
                <td className="p-4 text-gray-300 font-mono text-sm hidden sm:table-cell">
                  {u.telegram_id}
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    u.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Users;