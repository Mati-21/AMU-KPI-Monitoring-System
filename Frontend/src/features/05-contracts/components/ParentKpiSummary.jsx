import { equalAmountFor, measureText, mostFor, statusLabel } from '../lib/contractRules';

const SHARED_AS = { EQUAL: 'Shared equally', FULL: 'Shared fully', CUSTOM: 'Shared by custom targets' };

const Fact = ({ label, children, tone = 'text-foreground' }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-sm font-semibold ${tone}`}>{children}</p>
  </div>
);

/**
 * What the office above holds for a KPI before it passes to an office below: its baseline, target and improvement,
 * how it is shared, and for a divided KPI how much is handed out, what is left and this office's share.
 */
const ParentKpiSummary = ({ kpi, parent, fromOffice, toOffice, share, shareMethod }) => {
  const amount = (value) => (value === null || value === undefined ? '-' : measureText(kpi, { value }));
  const { sharing } = parent;
  const divided = sharing?.shareable && shareMethod !== 'FULL';
  const remaining = divided ? Math.max(0, -sharing.difference) : null;
  // Equally, the office's part is worked out; by custom targets, it can get up to what remains
  const custom = shareMethod !== 'EQUAL';
  const ownShare = custom ? (divided ? mostFor(sharing, toOffice.id) : null) : equalAmountFor(sharing, toOffice.id) ?? share;
  const othersShares = divided ? sharing.offices.filter((line) => line.office.id !== toOffice.id && line.amount !== null) : [];
  const holding = sharing?.offices.filter((line) => line.assignmentId && line.office.id !== toOffice.id) ?? [];

  return (
    <section aria-label="What the office above holds" className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fromOffice.name} holds</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Baseline">{measureText(kpi, parent.baseline)}</Fact>
        <Fact label="Target">{measureText(kpi, parent.target)}</Fact>
        <Fact label="Improvement">{amount(parent.requiredImprovement)}</Fact>
        <Fact label="Frequency">{parent.reportingFrequency?.name ?? '-'}</Fact>
      </div>

      {shareMethod && (
        <p className="border-t border-border pt-3 text-xs text-foreground">
          <span className="font-semibold">{SHARED_AS[shareMethod]}</span>
          {sharing?.locked ? ', fixed since a contract holding it was sent' : ''}
          {shareMethod === 'EQUAL' && sharing.officesBelow.length > 0 && `: ${amount(sharing.parentAmount)} divided between ${sharing.officesBelow.length} offices below.`}
          {shareMethod === 'FULL' && `: every office below gets the whole improvement${sharing?.parentAmount ? ` of ${amount(sharing.parentAmount)}` : ''}.`}
          {shareMethod === 'CUSTOM' && ': the target is set for each office.'}
        </p>
      )}

      {divided ? (
        <>
          <div className={`grid grid-cols-2 gap-3 ${sharing.retained > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
            <Fact label="To Share">{amount(sharing.parentAmount)}</Fact>
            {sharing.retained > 0 && <Fact label={`Kept by ${fromOffice.name}`}>{amount(sharing.retained)}</Fact>}
            <Fact label="Shared So Far">{amount(sharing.distributed)}</Fact>
            <Fact label="Remaining to Meet It" tone={remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>
              {remaining > 0 ? amount(remaining) : sharing.difference > 0 ? `None, over by ${amount(sharing.difference)}` : 'None'}
            </Fact>
            <Fact label={custom ? `Most for ${toOffice.name}` : `Share for ${toOffice.name}`} tone={ownShare === null ? 'text-muted-foreground' : 'text-foreground'}>
              {ownShare === null ? 'Not set' : amount(ownShare)}
            </Fact>
          </div>
          {othersShares.length > 0 && (
            <p className="text-xs text-foreground">
              Shared with: {othersShares.map((line) => `${line.office.name} ${amount(line.amount)}${line.status ? ` (${statusLabel(line.status)})` : ' (planned, not counted until it is on their contract)'}`).join(', ')}.
            </p>
          )}
        </>
      ) : (
        <>
          {!sharing?.divisible && <p className="text-xs text-muted-foreground">This KPI cannot be divided between offices, so it is shared fully or with custom targets.</p>}
          {holding.length > 0 && <p className="text-xs text-foreground">Already on the contracts of: {holding.map((line) => `${line.office.name} (${statusLabel(line.status)})`).join(', ')}.</p>}
        </>
      )}
    </section>
  );
};

export default ParentKpiSummary;
