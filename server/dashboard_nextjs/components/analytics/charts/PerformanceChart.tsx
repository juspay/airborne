import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsTimeSeriesData } from '../Analytics';

interface PerformanceChartProps {
  data: AnalyticsTimeSeriesData[];
  interval: 'HOUR' | 'DAY';
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, interval }) => {
  const formattedData = data.map(item => {
    const total_updates = item.download_success + item.download_failures;
    const success_rate = total_updates > 0 
      ? (item.download_success / total_updates) * 100 
      : 0;

    return {
      time_slot: interval === 'HOUR'
        ? new Date(item.time_slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(item.time_slot).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      success_rate: parseFloat(success_rate.toFixed(2))
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Success Rate</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time_slot" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="success_rate" 
              stroke="#2563eb" 
              name="Success Rate %" 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
