import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';

const config = {
  title: 'Strategic Performance Dashboard',
  subtitle: 'University Executive Oversight • Institutional Effectiveness',
  yearOptions: ['2023-2024', '2022-2023', '2021-2022'],

  stats: [
    {
      label: 'Achievement Rate',
      value: '82.4%',
      color: 'green',
      progress: 82.4,
      subtitle: '+2.4% from last quarter',
    },
    {
      label: 'Total KPIs',
      value: '148',
      color: 'primary',
      subtitle: 'Across all strategic cycles',
    },
    {
      label: 'Achieved KPIs',
      value: '92',
      color: 'green',
      progress: 62,
    },
    {
      label: 'Delayed',
      value: '14',
      color: 'red',
      progress: 14,
    },
  ],

  subUnitLabel: 'Vice Presidents',

  subUnits: [
    {
      name: 'Academic Vice President',
      totalKpis: 54,
      trend: 'Improving',
      achieved: 39,
      inProgress: 10,
      delayed: 5,
      color: 'primary',
    },
    {
      name: 'Research Vice President',
      totalKpis: 42,
      trend: 'Improving',
      achieved: 28,
      inProgress: 10,
      delayed: 4,
      color: 'green',
    },
    {
      name: 'Administrative Vice President',
      totalKpis: 52,
      trend: 'Declining',
      achieved: 30,
      inProgress: 14,
      delayed: 8,
      color: 'red',
    },
  ],

  quarterlyData: [
    { name: 'Academic VP', q1: 0, q2: 0, q3: 0, q4: 0 },
    { name: 'Research VP', q1: 65, q2: 70, q3: 75, q4: 80 },
    { name: 'Admin VP', q1: 68, q2: 72, q3: 70, q4: 74 },
  ],

  yearlyTrend: [
    { year: '2019', score: 62 },
    { year: '2020', score: 65 },
    { year: '2021', score: 70 },
    { year: '2022', score: 74 },
    { year: '2023', score: 78 },
    { year: '2024', score: 82 },
  ],

  statusDistribution: [
    { name: 'Achieved', value: 42, color: 'hsl(142 71% 45%)' },
    { name: 'In Progress', value: 28, color: 'hsl(45 93% 47%)' },
    { name: 'Delayed', value: 15, color: 'hsl(0 84% 60%)' },
    { name: 'Critical', value: 15, color: 'hsl(0 0% 45%)' },
  ],

  heatmap: [
    { pillar: 'Academic VP', q1: 0, q2: 0, q3: 0, q4: 0 },
    { pillar: 'Research VP', q1: 58, q2: 64, q3: 72, q4: 76 },
    { pillar: 'Admin VP', q1: 82, q2: 85, q3: 81, q4: 78 },
  ],

  topPerformers: [
    { name: 'Academic VP', unit: 'Faculty Management', score: 0 },
    { name: 'Research VP', unit: 'Innovation & Research', score: 85 },
    { name: 'Admin VP', unit: 'Operations', score: 78 },
  ],

  achievementGap: [
    { name: 'Academic VP', target: 90, actual: 0 },
    { name: 'Research VP', target: 85, actual: 76 },
    { name: 'Admin VP', target: 88, actual: 74 },
  ],
};

const StrategicDashboard = () => {
  return <PerformanceDashboard config={config} />;
};

export default StrategicDashboard;
