/**
 * dashboardUtils.js
 * Centralized logic for processing KPI assignments and performance results into dashboard metrics.
 */

export const toNumber = (value) => {
  // API returns '-' for unsubmitted quarters — treat it as null
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const safePercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 0;
  }
  // Remove 100% cap to allow showing over-achievement
  const num = Number(value);
  return Math.max(0, Math.round(num * 10) / 10);
};

export const average = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const valid = values.filter((v) => v !== null && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
};

export const sum = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((acc, v) => acc + (toNumber(v) || 0), 0);
};

export const trendFromQuarterScores = (scores) => {
  const ordered = ['q1', 'q2', 'q3', 'q4']
    .map((key) => toNumber(scores[key]))
    .filter((v) => v !== null);

  if (ordered.length < 2) return 'Stable';

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const delta = last - first;

  if (delta > 4) return 'Improving';
  if (delta < -4) return 'Declining';
  return 'Stable';
};

export const getThemeName = (kpiRecord, typeById) => {
  if (!kpiRecord?.KPITypeId) return 'Uncategorized';
  const leaf = typeById.get(kpiRecord.KPITypeId);
  const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
  const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;
  return theme?.KPIName || subTheme?.KPIName || leaf?.KPIName || 'Uncategorized';
};

export const buildDashboardData = (assignments, kpis, kpiTypes, roleNameByUserId, activeSubUnitNames = []) => {
  const kpiById = new Map((Array.isArray(kpis) ? kpis : []).map((k) => [k.Id, k]));
  const typeById = new Map((Array.isArray(kpiTypes) ? kpiTypes : []).map((t) => [t.Id, t]));

  const groups = new Map();
  const overallQuarterScores = { q1: [], q2: [], q3: [], q4: [] };
  const kpiTrendsDataRaw = new Map();

  // Initialize active sub-units
  (Array.isArray(activeSubUnitNames) ? activeSubUnitNames : []).forEach((name) => {
    const normalized = String(name || '').trim();
    if (!normalized || groups.has(normalized)) return;
    groups.set(normalized, {
      name: normalized,
      totalKpis: 0,
      kpiIds: new Set(),
      achieved: 0,
      inProgress: 0,
      delayed: 0,
      targets: [],
      actualSums: [],
      quarterPcts: { q1: [], q2: [], q3: [], q4: [] },
    });
  });

  (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    const kpiRecord = kpiById.get(assignment.KPIId) || assignment.KPI;
    const assignedUserId = String(assignment?.UserId || assignment?.User?.Id || '');
    const childRoleName = roleNameByUserId?.get(assignedUserId);
    const fallbackName = assignment?.User?.FirstName || getThemeName(kpiRecord, typeById);
    const groupName = childRoleName || fallbackName;

    const target = toNumber(assignment.AssignedTarget ?? kpiRecord?.Target) || 0;
    const baseline = toNumber(assignment.Baseline ?? kpiRecord?.Baseline) || 0;
    const totalNeeded = Math.max(0.1, target - baseline); // Avoid division by zero

    const q1 = toNumber(assignment.q1);
    const q2 = toNumber(assignment.q2);
    const q3 = toNumber(assignment.q3);
    const q4 = toNumber(assignment.q4);

    const qValues = [q1, q2, q3, q4].map(v => v === null ? 0 : v);
    const totalPerformance = sum(qValues);
    const hasSubmission = q1 !== null || q2 !== null || q3 !== null || q4 !== null;

    if (!groups.has(groupName)) {
      groups.set(groupName, {
        name: groupName,
        totalKpis: 0,
        kpiIds: new Set(),
        achieved: 0,
        inProgress: 0,
        delayed: 0,
        targets: [],
        actualSums: [],
        quarterPcts: { q1: [], q2: [], q3: [], q4: [] },
      });
    }

    const group = groups.get(groupName);
    group.kpiIds.add(String(assignment.KPIId));
    group.totalKpis = group.kpiIds.size;
    group.targets.push(target);
    group.actualSums.push(totalPerformance);

    // Calculate per-KPI performance percentage and store it
    // Calculate per-KPI performance percentage (incremental contribution)
    const p1 = (q1 / totalNeeded) * 100;
    const p2 = (q2 / totalNeeded) * 100;
    const p3 = (q3 / totalNeeded) * 100;
    const p4 = (q4 / totalNeeded) * 100;

    console.log(`[Calc] Group: ${groupName} | KPI: ${kpiRecord?.Description || 'Unknown'} (ID: ${assignment.Id || 'N/A'})`);
    if (q1 !== null) console.log(`  - Q1: Actual=${q1}, Target=${target}, Pct=${p1.toFixed(2)}%`);
    if (q2 !== null) console.log(`  - Q2: Actual=${q2}, Target=${target}, Pct=${p2.toFixed(2)}%`);

    if (q1 !== null) group.quarterPcts.q1.push(p1);
    if (q2 !== null) group.quarterPcts.q2.push(p2);
    if (q3 !== null) group.quarterPcts.q3.push(p3);
    if (q4 !== null) group.quarterPcts.q4.push(p4);

    // Track per-KPI trend data
    const kpiId = assignment.KPIId;

    // Prioritize the dedicated Name property for Derived KPIs
    let kpiLabel = assignment.Name || kpiRecord?.KPIType?.KPIName || kpiRecord?.Description || assignment.KPI?.Description;

    if (!kpiLabel || kpiLabel.length < 3) {
      kpiLabel = getThemeName(kpiRecord, typeById);
    }

    if (!kpiLabel) kpiLabel = `KPI ${String(kpiId).slice(0, 6)}`;

    if (!kpiTrendsDataRaw.has(kpiId)) {
      kpiTrendsDataRaw.set(kpiId, { name: kpiLabel, q1s: [], q2s: [], q3s: [], q4s: [], targets: [], baselines: [] });
    }
    const raw = kpiTrendsDataRaw.get(kpiId);
    raw.targets.push(target);
    raw.baselines.push(baseline);
    if (q1 !== null) raw.q1s.push(q1);
    if (q2 !== null) raw.q2s.push(q2);
    if (q3 !== null) raw.q3s.push(q3);
    if (q4 !== null) raw.q4s.push(q4);

    // A KPI is only "achieved" if total performance meets the target AND
    // all quarters with data have been approved (no pending evidence/results).
    const hasAnyPendingQuarter = !!(assignment.q1Pending || assignment.q2Pending || assignment.q3Pending || assignment.q4Pending);

    if (!hasSubmission) {
      group.inProgress += 1;
    } else if (totalNeeded > 0) {
      if (totalPerformance >= totalNeeded && !hasAnyPendingQuarter) {
        group.achieved += 1;
      } else {
        group.inProgress += 1;
      }
    } else {
      // If no target increment, assume >= 20 points (80%) is achieved
      if (totalPerformance >= 20 && !hasAnyPendingQuarter) group.achieved += 1;
      else group.inProgress += 1;
    }
  });

  const subUnits = Array.from(groups.values()).map((g, idx) => {
    const avgTarget = average(g.targets) || 100;

    const q1Pct = g.quarterPcts.q1.length > 0 ? safePercent(average(g.quarterPcts.q1)) : 0;
    const q2Pct = g.quarterPcts.q2.length > 0 ? safePercent(average(g.quarterPcts.q2)) : 0;
    const q3Pct = g.quarterPcts.q3.length > 0 ? safePercent(average(g.quarterPcts.q3)) : 0;
    const q4Pct = g.quarterPcts.q4.length > 0 ? safePercent(average(g.quarterPcts.q4)) : 0;

    if (g.quarterPcts.q1.length > 0 || g.quarterPcts.q2.length > 0) {
      console.log(`[Final Average] Group: ${g.name}`);
      if (g.quarterPcts.q1.length > 0) console.log(`  - Q1 Final: ${q1Pct} Points (Avg of ${g.quarterPcts.q1.length} KPIs)`);
      if (g.quarterPcts.q2.length > 0) console.log(`  - Q2 Final: ${q2Pct} Points (Avg of ${g.quarterPcts.q2.length} KPIs)`);
    }

    const score = safePercent(sum([q1Pct, q2Pct, q3Pct, q4Pct]));
    const colors = ['primary', 'green', 'blue', 'amber', 'purple', 'red'];

    return {
      name: g.name,
      totalKpis: g.totalKpis,
      achieved: g.achieved,
      inProgress: g.inProgress,
      delayed: g.delayed,
      trend: trendFromQuarterScores({ q1: q1Pct, q2: q2Pct, q3: q3Pct, q4: q4Pct }),
      color: colors[idx % colors.length],
      score,
      target: 100, // Normalized target is 100% of (Target - Baseline)
      q1: q1Pct,
      q2: q2Pct,
      q3: q3Pct,
      q4: q4Pct,
      q1Submitted: g.quarterPcts.q1.length > 0,
      q2Submitted: g.quarterPcts.q2.length > 0,
      q3Submitted: g.quarterPcts.q3.length > 0,
      q4Submitted: g.quarterPcts.q4.length > 0,
    };
  }).filter(s => s.totalKpis > 0).sort((a, b) => b.score - a.score);

  const assignedKpis = subUnits.reduce((acc, s) => acc + s.totalKpis, 0);
  const achievedKpis = subUnits.reduce((acc, s) => acc + s.achieved, 0);
  const inProgressKpis = subUnits.reduce((acc, s) => acc + s.inProgress, 0);
  const delayedKpis = subUnits.reduce((acc, s) => acc + s.delayed, 0);

  const avgScore = average(subUnits.map(s => s.score)) || 0;

  const yearlyTrend = [
    { year: 'Q1', score: average(subUnits.filter(s => s.q1Submitted).map(s => s.q1)) || 0 },
    { year: 'Q2', score: average(subUnits.filter(s => s.q2Submitted).map(s => s.q2)) || 0 },
    { year: 'Q3', score: average(subUnits.filter(s => s.q3Submitted).map(s => s.q3)) || 0 },
    { year: 'Q4', score: average(subUnits.filter(s => s.q4Submitted).map(s => s.q4)) || 0 },
  ];

  const usedNames = new Set();
  const kpiTrendsMap = new Map();
  kpiTrendsDataRaw.forEach((raw, kpiId) => {
    const avgTarget = average(raw.targets) || 100;
    const avgBaseline = average(raw.baselines) || 0;
    const totalNeededTrend = Math.max(0.1, avgTarget - avgBaseline);

    const avgQ1 = raw.q1s.length > 0 ? (raw.q1s.reduce((s, v) => s + v, 0) / raw.q1s.length) : null;
    const avgQ2 = raw.q2s.length > 0 ? (raw.q2s.reduce((s, v) => s + v, 0) / raw.q2s.length) : null;
    const avgQ3 = raw.q3s.length > 0 ? (raw.q3s.reduce((s, v) => s + v, 0) / raw.q3s.length) : null;
    const avgQ4 = raw.q4s.length > 0 ? (raw.q4s.reduce((s, v) => s + v, 0) / raw.q4s.length) : null;

    let uniqueName = raw.name;
    if (usedNames.has(uniqueName)) {
      uniqueName = `${uniqueName} (${String(kpiId).slice(0, 4)})`;
    }
    usedNames.add(uniqueName);

    // Cumulative progress toward (Target - Baseline)
    const q1Val = avgQ1 !== null ? safePercent((avgQ1 / totalNeededTrend) * 100) : 0;
    const q2Val = avgQ2 !== null ? safePercent((((avgQ1 || 0) + avgQ2) / totalNeededTrend) * 100) : q1Val;
    const q3Val = avgQ3 !== null ? safePercent((((avgQ1 || 0) + (avgQ2 || 0) + avgQ3) / totalNeededTrend) * 100) : q2Val;
    const q4Val = avgQ4 !== null ? safePercent((((avgQ1 || 0) + (avgQ2 || 0) + (avgQ3 || 0) + avgQ4) / totalNeededTrend) * 100) : q3Val;

    kpiTrendsMap.set(kpiId, {
      name: uniqueName,
      q1: q1Val,
      q2: q2Val,
      q3: q3Val,
      q4: q4Val,
    });
  });

  // 1. Cumulative Trend (Progress toward annual goal)
  const kpiTrends = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
    const obj = { year: q };
    kpiTrendsMap.forEach((v) => {
      obj[v.name] = v[`q${idx + 1}`] ?? 0;
    });
    return obj;
  });

  // 2. Individual Quarterly Performance (Non-cumulative)
  const kpiQuarterlyTrends = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, idx) => {
    const obj = { year: q, score: 0, anySubmitted: false };
    kpiTrendsMap.forEach((v, kpiId) => {
      const raw = kpiTrendsDataRaw.get(kpiId);
      const avgTarget = average(raw.targets) || 100;
      const avgBaseline = average(raw.baselines) || 0;
      const totalNeededQ = Math.max(0.1, avgTarget - avgBaseline);

      const qValues = raw[`q${idx + 1}s`] || [];
      if (qValues.length > 0) obj.anySubmitted = true;
      const qVal = qValues.length > 0 ? (qValues.reduce((s, val) => s + val, 0) / qValues.length) : 0;
      const pct = safePercent((qVal / totalNeededQ) * 100);
      obj[v.name] = pct;
      obj.score += pct / (kpiTrendsMap.size || 1);
    });
    return obj;
  });

  const kpiNames = Array.from(kpiTrendsMap.values()).map((v) => v.name);

  return {
    assignedKpis,
    achievedKpis,
    inProgressKpis,
    delayedKpis,
    avgScore: safePercent(avgScore),
    subUnits: subUnits,
    quarterlyData: subUnits.map(s => ({
      name: s.name,
      q1: s.q1, q2: s.q2, q3: s.q3, q4: s.q4,
      q1Submitted: s.q1Submitted,
      q2Submitted: s.q2Submitted,
      q3Submitted: s.q3Submitted,
      q4Submitted: s.q4Submitted,
    })),
    yearlyTrend: kpiTrends,
    kpiTrends,
    kpiQuarterlyTrends,
    kpiNames,
    statusDistribution: [
      { name: 'Achieved', value: safePercent(assignedKpis ? (achievedKpis / assignedKpis) * 100 : 0), color: 'hsl(142 71% 45%)' },
      { name: 'In Progress', value: safePercent(assignedKpis ? (inProgressKpis / assignedKpis) * 100 : 0), color: 'hsl(45 93% 47%)' },
      { name: 'Delayed', value: safePercent(assignedKpis ? (delayedKpis / assignedKpis) * 100 : 0), color: 'hsl(0 84% 60%)' },
    ],
    heatmap: subUnits.map(s => ({ pillar: s.name, q1: s.q1, q2: s.q2, q3: s.q3, q4: s.q4 })),
    topPerformers: subUnits.map(s => ({ name: s.name, unit: `${s.totalKpis} KPI(s)`, score: s.score })),
    achievementGap: subUnits.map(s => ({ name: s.name, target: s.target, actual: s.score })),
    quarterlyComparison: [
      { name: 'Q1', score: kpiQuarterlyTrends[0]?.score || 0, submitted: kpiQuarterlyTrends[0]?.anySubmitted || false },
      { name: 'Q2', score: kpiQuarterlyTrends[1]?.score || 0, submitted: kpiQuarterlyTrends[1]?.anySubmitted || false },
      { name: 'Q3', score: kpiQuarterlyTrends[2]?.score || 0, submitted: kpiQuarterlyTrends[2]?.anySubmitted || false },
      { name: 'Q4', score: kpiQuarterlyTrends[3]?.score || 0, submitted: kpiQuarterlyTrends[3]?.anySubmitted || false },
    ]
  };
};
