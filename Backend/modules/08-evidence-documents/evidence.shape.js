/**
 * Module 08 — How a piece of evidence is read for a report or a sheet: the document, the verdict, and where it came
 * from when the office above passed it up from an office below.
 */

export const EVIDENCE_LINE_SELECT = {
  id: true,
  performanceValueId: true,
  verificationStatus: true,
  comment: true,
  verifiedAt: true,
  document: { select: { id: true, title: true, fileId: true, createdAt: true } },
  verifiedBy: { select: { id: true, firstName: true, lastName: true } },
  forwardedFrom: { select: { performanceValue: { select: { report: { select: { contract: { select: { office: { select: { id: true, name: true } } } } } } } } } },
  _count: { select: { forwardedCopies: true } },
};

/**
 * forwardedFrom: the office the evidence came from, or null when this office attached it itself.
 * isForwarded: this office passed the evidence up into the report of the office above.
 */
export const formatEvidenceLine = ({ forwardedFrom, _count, ...evidence }) => ({
  ...evidence,
  forwardedFrom: forwardedFrom ? { office: forwardedFrom.performanceValue.report.contract.office } : null,
  isForwarded: _count.forwardedCopies > 0,
});
