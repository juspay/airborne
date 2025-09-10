import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsTimeSeriesData } from '../Analytics';

interface RollbackChartProps {
  data: AnalyticsTimeSeriesData[];
  interval: 'HOUR' | 'DAY';
}

export const RollbackChart: React.FC<RollbackChartProps> = ({ data, interval }) => {
  const formattedData = data.map(item => ({
    time_slot: interval === 'HOUR'
      ? new Date(item.time_slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(item.time_slot).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    rollbacks_initiated: item.rollbacks_initiated,
    rollbacks_completed: item.rollbacks_completed,
    rollback_failures: item.rollback_failures
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rollback Activity</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time_slot" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="rollbacks_initiated" name="Initiated" fill="#fbbf24" />
            <Bar dataKey="rollbacks_completed" name="Completed" fill="#4ade80" />
            <Bar dataKey="rollback_failures" name="Failed" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
