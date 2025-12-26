import { useEffect, useState } from 'react';
import API from '../api';

function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    API.get('/users').then(res => setUsers(res.data));
  }, []);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl mb-6">Kullanıcılar</h1>
      <table className="w-full bg-gray-800 rounded">
        <thead>
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">İsim</th>
            <th className="p-2">Telegram ID</th>
            <th className="p-2">Durum</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="p-2">{u.id}</td>
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.telegram_id}</td>
              <td className="p-2">{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Users; // <-- ОБЯЗАТЕЛЬНО
