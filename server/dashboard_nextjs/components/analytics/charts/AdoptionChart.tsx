import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AnalyticsTimeSeriesData } from "../Analytics";

interface AdoptionChartProps {
  data: AnalyticsTimeSeriesData[];
  interval: "HOUR" | "DAY";
}

export const AdoptionChart: React.FC<AdoptionChartProps> = ({ data, interval }) => {
  const formattedData = data.map((item) => ({
    ...item,
    time_slot:
      interval === "HOUR"
        ? new Date(item.time_slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date(item.time_slot).toLocaleDateString([], { month: "short", day: "numeric" }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Adoption Over Time</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time_slot" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="download_success" name="Downloads" fill="#4ade80" stackId="a" />
            <Bar dataKey="apply_success" name="Applied" fill="#2563eb" stackId="b" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
