import React from 'react';
import { Card, CardContent, } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const trends = [
  { name: "Research Output", current: 82, previous: 75, trend: "up" },
  { name: "Student Satisfaction", current: 91, previous: 88, trend: "up" },
  { name: "Community Service", current: 65, previous: 70, trend: "down" },
  { name: "Academic Quality", current: 74, previous: 74, trend: "neutral" },
  { name: "Infrastructure", current: 58, previous: 52, trend: "up" },
  { name: "Staff Development", current: 80, previous: 77, trend: "up" },
];

const Trends = () => (
  React.createElement('div', { className: "space-y-6",}
    , React.createElement('div', null
      , React.createElement('h1', { className: "text-2xl font-bold text-foreground"  ,}, "Performance Trends" )
      , React.createElement('p', { className: "text-sm text-muted-foreground" ,}, "Track KPI performance over time"    )
    )
    , React.createElement('div', { className: "grid grid-cols-2 gap-4"  ,}
      , trends.map((t) => (
        React.createElement(Card, { key: t.name,}
          , React.createElement(CardContent, { className: "p-5",}
            , React.createElement('div', { className: "flex items-start justify-between mb-3"   ,}
              , React.createElement('p', { className: "font-semibold text-foreground" ,}, t.name)
              , t.trend === "up" ? React.createElement(TrendingUp, { className: "w-5 h-5 text-emerald-600"  ,} ) :
               t.trend === "down" ? React.createElement(TrendingDown, { className: "w-5 h-5 text-destructive"  ,} ) :
               React.createElement(Minus, { className: "w-5 h-5 text-muted-foreground"  ,} )
            )
            , React.createElement('div', { className: "flex items-end gap-3 mb-2"   ,}
              , React.createElement('span', { className: "text-3xl font-bold text-foreground"  ,}, t.current, "%")
              , React.createElement('span', { className: "text-sm text-muted-foreground mb-1"  ,}, "from " , t.previous, "%")
            )
            , React.createElement(Progress, { value: t.current, className: "h-2",} )
          )
        )
      ))
    )
  )
);

export default Trends;
