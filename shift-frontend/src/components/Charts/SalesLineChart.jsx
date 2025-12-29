import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SalesLineChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">Нет данных для графика</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="day" stroke="#9CA3AF" />
        <YAxis stroke="#9CA3AF" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
          itemStyle={{ color: '#F3F4F6' }}
        />
        <Legend />
        
        {/* Кривая Yenibosna (Зеленая) */}
        <Line 
          type="monotone" 
          dataKey="Yenibosna" 
          stroke="#10B981" 
          strokeWidth={3}
          activeDot={{ r: 8 }} 
          name="Yenibosna"
        />
        
        {/* Кривая Göktürk (Синяя) */}
        <Line 
          type="monotone" 
          dataKey="Göktürk" 
          stroke="#3B82F6" 
          strokeWidth={3} 
          name="Göktürk"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SalesLineChart;