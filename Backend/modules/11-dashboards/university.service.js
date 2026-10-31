import { prisma } from '../../config/database.js';
import { notFound } from '../../utils/httpError.js';
import { OFFICE_REF, assertCanView, loadContracts, loadYearHistory, publicLine, publicView, resolveView, toOfficeRow, toSnapshot } from './dashboard.data.js';
import { compareOffices, groupByObjective, summarize } from './dashboard.rules.js';

/**
 * Module 11 — University dashboard (SRS 12.1). The university's figures are the top office's contract: its KPIs were
 * rolled up from every office below when the reports were approved. Office scores are compared side by side and never
 * averaged, because each contract is scored on its own weights.
 */

const byOfficeType = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const { officeType } = row.office;
    if (!groups.has(officeType.id)) groups.set(officeType.id, { officeType, offices: [] });
    groups.get(officeType.id).offices.push(row);
  }
  return [...groups.values()]
    .sort((a, b) => (a.officeType.levelOrder ?? Infinity) - (b.officeType.levelOrder ?? Infinity))
    .map((group) => ({ ...group, offices: compareOffices(group.offices) }));
};

export const getUniversityDashboard = async (query, actor) => {
  const root = await prisma.office.findFirst({ where: { parentOfficeId: null }, ...OFFICE_REF });
  if (!root) throw notFound('The university office has not been set up');
  await assertCanView(actor, root.id);

  const view = await resolveView(query);
  const contracts = await loadContracts(view.fiscalYear.id);
  const snapshots = new Map(contracts.map((contract) => [contract.officeId, toSnapshot(contract, view.fiscalYear, view.period)]));
  const offices = await prisma.office.findMany({
    where: { parentOfficeId: { not: null }, OR: [{ isActive: true }, { id: { in: [...snapshots.keys()] } }] },
    ...OFFICE_REF,
  });

  const own = snapshots.get(root.id) ?? null;
  return {
    ...publicView(view),
    office: root,
    contractStatus: own?.contract.status ?? null,
    score: own?.score ?? null,
    summary: own?.summary ?? summarize([]),
    kpis: (own?.lines ?? []).map(publicLine),
    trend: own?.trend ?? [],
    history: await loadYearHistory(root.id),
    byStrategicObjective: groupByObjective(own?.lines ?? []),
    byOfficeType: byOfficeType(offices.map((office) => toOfficeRow(office, snapshots.get(office.id)))),
  };
};

export default { getUniversityDashboard };
