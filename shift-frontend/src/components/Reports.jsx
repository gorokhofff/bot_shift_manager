import { useEffect, useState } from 'react';
import API from '../api';

function Reports() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    API.get('/reports').then(res => setReports(res.data));
  }, []);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl mb-6">Raporlar</h1>
      <table className="w-full bg-gray-800 rounded">
        <thead>
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Şift ID</th>
            <th className="p-2">Metin</th>
            <th className="p-2">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id}>
              <td className="p-2">{r.id}</td>
              <td className="p-2">{r.shift_id}</td>
              <td className="p-2">{r.report_text.slice(0, 50)}...</td>
              <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Reports;
