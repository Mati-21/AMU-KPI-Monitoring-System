import { useState } from 'react';

import EvidenceDialog from './EvidenceDialog';
import PerformanceSection from './PerformanceSection';

/**
 * A contract's results for the year, one table per reporting frequency, with the evidence window for a result.
 * Used for an office's contract and for a person's staff contract alike.
 */
const PerformanceSheet = ({ sheet }) => {
  const [evidenceFor, setEvidenceFor] = useState(null);

  // Read from the latest sheet, so the window shows evidence just attached
  const evidenceRow = evidenceFor && sheet.sections.flatMap((section) => section.rows).find((row) => row.assignmentId === evidenceFor.assignmentId);
  const evidenceCell = evidenceRow?.cells[evidenceFor.period.id];

  return (
    <>
      {sheet.sections.map((section) => (
        <PerformanceSection key={section.frequency.id} section={section} contract={sheet.contract} onEvidence={(row, period) => setEvidenceFor({ assignmentId: row.assignmentId, period })} />
      ))}
      {sheet.sections.length === 0 && <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">This contract has no accepted KPIs yet.</p>}

      {evidenceCell && (
        <EvidenceDialog
          report={{ can: { attachEvidence: evidenceFor.period.can.attachEvidence, verifyEvidence: false }, contract: { officeId: sheet.contract.office.id } }}
          line={{ kpi: evidenceRow.kpi, direct: { id: evidenceCell.valueId }, evidence: evidenceCell.evidence }}
          onClose={() => setEvidenceFor(null)}
        />
      )}
    </>
  );
};

export default PerformanceSheet;
