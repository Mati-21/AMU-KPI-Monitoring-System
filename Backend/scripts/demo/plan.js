/**
 * The President's plan for each KPI: its baseline and target, and which offices directly below receive it.
 * For a percentage or ratio the baseline is [numerator, denominator]; for a stage or rating it is a level name.
 * to: [] means the President Office does it alone.
 */
export const PLAN = {
  'Graduation rate': { base: [750, 1000], target: 85, to: ['academic'] },
  'Student enrolment': { base: 12000, target: 14000, to: ['academic'] },
  'Student dropout rate': { base: [80, 1000], target: 5, to: ['academic'] },
  'Student to teacher ratio': { base: [12000, 480], target: 20, to: ['academic'] },
  'Courses with an updated curriculum': { base: 40, target: 100, to: ['academic'] },
  'Programme accreditation progress': { base: 'Applied', target: 'Accredited', to: ['academic'] },
  'Teaching quality rating': { base: 'Fair', target: 'Very good', to: ['academic'] },
  'Laboratory hours delivered': { base: 2400, target: 3600, to: ['academic'] },
  'Student complaints received': { base: 120, target: 60, to: ['academic'] },
  'Exit exam pass rate': { base: [600, 1000], target: 75, to: ['academic'] },
  'Courses offered through e-learning': { base: 24, target: 60, to: ['academic'] },
  'Students placed in internships': { base: 600, target: 900, to: ['academic'] },
  'Research publications': { base: 100, target: 160, to: ['research'] },
  'Research grant income': { base: 2000000, target: 5000000, to: ['research'] },
  'Patents filed': { base: 2, target: 6, to: ['research'] },
  'Research projects completed on time': { base: [30, 50], target: 80, to: ['research'] },
  'Industry partnerships signed': { base: 10, target: 20, to: ['research'] },
  'Flagship research project stage': { base: 'Planned', target: 'Completed', to: ['research'] },
  'Consultancy income': { base: 1200000, target: 2400000, to: ['research'] },
  'Research ethics compliance': { base: 'Not compliant', target: 'Compliant', to: ['research'] },
  'Community service projects': { base: 40, target: 80, to: ['research', 'academic'] },
  'Community members trained': { base: 1500, target: 3000, to: ['academic'] },
  'Income from services': { base: 600000, target: 1200000, to: ['academic'] },
  'Budget utilization rate': { base: [800, 1000], target: 95, to: ['research', 'academic'] },
  'Average procurement processing days': { base: 45, target: 30, to: [] },
  'Audit findings': { base: 12, target: 4, to: [] },
  'Digital service maturity': { base: 'Partly digital', target: 'Integrated', to: ['research', 'academic'] },
  'Staff trained': { base: 300, target: 600, to: ['research', 'academic'] },
  'Staff turnover rate': { base: [100, 1000], target: 6, to: [] },
  'Customer satisfaction': { base: 'Good', target: 'Very good', to: ['research', 'academic'] },
};

// The Academic Office receives 20 more community service projects to deliver. It shares them by hand: 9 to AMiT,
// 6 to AWiT, and keeps 5 for itself
export const ACADEMIC_CUSTOM = { kpi: 'Community service projects', shares: { amit: 9, awit: 6 }, keep: 5 };
