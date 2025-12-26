import { useEffect, useState } from 'react';
import API from '../api';

function Shifts() {
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    API.get('/shifts').then(res => setShifts(res.data));
  }, []);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl mb-6">Şiftler</h1>
      <table className="w-full bg-gray-800 rounded">
        <thead>
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Kullanıcı</th>
            <th className="p-2">Başlangıç</th>
            <th className="p-2">Bitiş</th>
            <th className="p-2">Şube</th>
            <th className="p-2">Süre (Saat)</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map(s => (
            <tr key={s.id}>
              <td className="p-2">{s.id}</td>
              <td className="p-2">{s.user_name || `ID: ${s.user_id}`}  {/* Показываем имя пользователя вместо ID */}</td>
              <td className="p-2">{new Date(s.start_time).toLocaleString()}</td>
              <td className="p-2">{s.end_time ? new Date(s.end_time).toLocaleString() : 'Devam ediyor'}</td>
              <td className="p-2">{s.location}</td>
              <td className="p-2">{s.duration_hours ? `${s.duration_hours} saat` : '-'}  {/* Отображение длительности */}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Shifts;
