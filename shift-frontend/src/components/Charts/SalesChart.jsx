import { useEffect, useState } from 'react';
import API from '../../api';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function SalesChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const res = await API.get('/shifts'); // или /reports
      const shifts = res.data;

      const formattedData = shifts.map(shift => ({
        day: shift.shift_date, // или парсинг даты
        hours: shift.duration_hours,
      }));

      setData(formattedData);
    }
    fetchData();
  }, []);

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl mb-4 text-white">Haftalık Çalışma Saatleri</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke="#ccc" />
          <XAxis dataKey="day" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip />
          <Line type="monotone" dataKey="hours" stroke="#4f46e5" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SalesChart;
