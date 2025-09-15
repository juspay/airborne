import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AnalyticsTimeSeriesData } from "../Analytics";

interface TimeToAdoptionChartProps {
  data: AnalyticsTimeSeriesData[];
  interval: "HOUR" | "DAY";
}

export const TimeToAdoptionChart: React.FC<TimeToAdoptionChartProps> = ({ data, interval }) => {
  const formattedData = data.map((item) => {
    const total_updates = item.update_checks;
    const adoption_rate = total_updates > 0 ? (item.apply_success / total_updates) * 100 : 0;

    return {
      time_slot:
        interval === "HOUR"
          ? new Date(item.time_slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : new Date(item.time_slot).toLocaleDateString([], { month: "short", day: "numeric" }),
      adoption_rate: parseFloat(adoption_rate.toFixed(2)),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time to Adoption</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time_slot" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="adoption_rate" name="Adoption Rate %" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
