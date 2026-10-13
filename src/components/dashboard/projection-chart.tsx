"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { minorUnitsToDecimal } from "@/lib/money";

export type ProjectionPoint = { label: string; value: number };

export function ProjectionChart({
  points,
  currency,
}: {
  points: ProjectionPoint[];
  currency: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(value: number) => minorUnitsToDecimal(value)} width={80} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `${minorUnitsToDecimal(Number(value))} ${currency}`} />
          <Line type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}