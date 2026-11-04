import { formatEthiopianDate } from '../../../shared/lib/ethiopianDate';
import { fullName } from '../lib/dashboardRules';
import Panel, { Empty } from './Panel';

const DECISIONS = { APPROVED: 'Approved', REVISION_REQUIRED: 'Sent back', REJECTED: 'Rejected' };
const SHOWN = 5;

/**
 * The latest decisions on these results, newest first. Comments come first, because they say what to do.
 */
const FeedbackList = ({ feedback, title = 'Recent feedback' }) => {
  const withComment = feedback.filter((item) => item.comment);
  const items = [...withComment, ...feedback.filter((item) => !item.comment)].slice(0, SHOWN);

  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <Empty>No decisions yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <p className="text-foreground">
                <span className="font-medium">{item.reportingPeriod.name}</span>: {DECISIONS[item.decision] ?? item.decision}
                {item.comment && <span className="text-foreground">. &ldquo;{item.comment}&rdquo;</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {[fullName(item.reviewer), item.reviewerOffice?.name].filter(Boolean).join(', ')}
                {item.reviewedAt ? ` · ${formatEthiopianDate(item.reviewedAt)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

export default FeedbackList;
