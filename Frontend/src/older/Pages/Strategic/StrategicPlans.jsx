import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const plans = [
  { id: 1, title: "5-Year Strategic Plan 2024-2029", status: "Active", progress: 22, goals: 8 },
  { id: 2, title: "Research Excellence Initiative", status: "Active", progress: 45, goals: 5 },
  { id: 3, title: "Digital Transformation Roadmap", status: "Draft", progress: 10, goals: 6 },
  { id: 4, title: "Community Engagement Strategy", status: "Active", progress: 60, goals: 4 },
];

const StrategicPlans = () => (
  React.createElement('div', { className: "space-y-6",}
    , React.createElement('div', null
      , React.createElement('h1', { className: "text-2xl font-bold text-foreground"  ,}, "Strategic Plans" )
      , React.createElement('p', { className: "text-sm text-muted-foreground" ,}, "Manage and track strategic plans and initiatives"      )
    )
    , React.createElement('div', { className: "grid grid-cols-2 gap-4"  ,}
      , plans.map((p) => (
        React.createElement(Card, { key: p.id, className: "hover:shadow-md transition-shadow" ,}
          , React.createElement(CardHeader, { className: "pb-3",}
            , React.createElement('div', { className: "flex items-start justify-between"  ,}
              , React.createElement(CardTitle, { className: "text-base",}, p.title)
              , React.createElement(Badge, { variant: p.status === "Active" ? "default" : "secondary",}, p.status)
            )
          )
          , React.createElement(CardContent, { className: "space-y-3",}
            , React.createElement('div', { className: "flex justify-between text-sm"  ,}
              , React.createElement('span', { className: "text-muted-foreground",}, p.goals, " Strategic Goals"  )
              , React.createElement('span', { className: "font-medium text-foreground" ,}, p.progress, "%")
            )
            , React.createElement(Progress, { value: p.progress, className: "h-2",} )
          )
        )
      ))
    )
  )
);

export default StrategicPlans;
