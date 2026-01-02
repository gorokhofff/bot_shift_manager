import { useEffect, useState } from 'react';
import API from '../api';

function Shifts() {
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    API.get('/shifts').then(res => setShifts(res.data));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white tracking-tight">Shifts History</h1>
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="p-4 font-bold tracking-wider">ID</th>
                <th className="p-4 font-bold tracking-wider">User</th>
                <th className="p-4 font-bold tracking-wider">Location</th>
                <th className="p-4 font-bold tracking-wider">Start</th>
                <th className="p-4 font-bold tracking-wider">End</th>
                <th className="p-4 font-bold tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {shifts.map(s => (
                <tr key={s.id} className="hover:bg-gray-700/20 transition-colors h-14 text-sm">
                  <td className="p-4 text-gray-500 font-mono">#{s.id}</td>
                  <td className="p-4 font-medium text-white">{s.user_name || `User ${s.user_id}`}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
                        s.location === 'Yenibosna' ? 'bg-green-900/30 text-green-400' :
                        s.location === 'Göktürk' ? 'bg-blue-900/30 text-blue-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {s.location}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">{new Date(s.start_time).toLocaleString()}</td>
                  <td className="p-4 text-gray-300">
                    {s.end_time ? new Date(s.end_time).toLocaleString() : <span className="text-green-400 animate-pulse">Active</span>}
                  </td>
                  <td className="p-4 font-medium">
                    {s.duration_hours ? `${s.duration_hours} h` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Shifts;