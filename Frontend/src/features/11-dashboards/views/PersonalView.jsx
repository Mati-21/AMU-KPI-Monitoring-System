import { Link } from 'react-router-dom';

import FeedbackList from '../components/FeedbackList';
import KpiBars from '../components/KpiBars';
import ScoreSummary from '../components/ScoreSummary';
import ScoreTrend from '../components/ScoreTrend';
import TodoPanel from '../components/TodoPanel';
import { fullName, todoFromDeadlines } from '../lib/dashboardRules';

/**
 * A person's own staff contract: their score, their KPIs weakest first, their trend, what is due and their head's
 * feedback. Nothing about their office or colleagues.
 */
const PersonalView = ({ dashboard, year }) => {
  if (!dashboard.contractId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-foreground">
        <p className="font-medium">You have no contract for {year.name} yet</p>
        <p className="mt-1 text-muted-foreground">
          The head of your office gives you one. Once it is assigned, you sign it under{' '}
          <Link to={`/my-contract?year=${year.id}`} className="font-medium text-primary hover:underline">
            My Contract
          </Link>
          .
        </p>
      </div>
    );
  }

  const myContract = `/my-contract?year=${year.id}`;
  const todo = todoFromDeadlines(dashboard.deadlines).map((item) => ({ ...item, to: myContract }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{fullName(dashboard.person)}</h2>
        <p className="text-sm text-muted-foreground">
          {dashboard.office.name} · your own contract
        </p>
      </div>
      <ScoreSummary score={dashboard.score} summary={dashboard.summary} bands={dashboard.bands} scoreLabel="My score" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScoreTrend trend={dashboard.trend} bands={dashboard.bands} title="My score through the year" />
        </div>
        <TodoPanel items={todo} />
      </div>
      <KpiBars kpis={dashboard.kpis} title="My KPIs, weakest first" />
      <FeedbackList feedback={dashboard.feedback} title="Feedback on my results" />
    </div>
  );
};

export default PersonalView;
