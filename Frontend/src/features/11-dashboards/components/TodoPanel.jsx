import { AlertCircle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

import Panel from './Panel';

const TONES = {
  critical: { icon: AlertCircle, className: 'text-red-600 dark:text-red-400' },
  warning: { icon: Clock, className: 'text-amber-600 dark:text-amber-400' },
  neutral: { icon: Inbox, className: 'text-muted-foreground' },
};

/**
 * What needs doing now. Each item carries an icon and words, so its colour never stands alone.
 * items: [{ tone, text, to? }]
 */
const TodoPanel = ({ items, title = 'To do' }) => (
  <Panel title={title}>
    {items.length === 0 ? (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
        Nothing needs doing right now.
      </p>
    ) : (
      <ul className="space-y-2.5">
        {items.map((item) => {
          const { icon: Icon, className } = TONES[item.tone] ?? TONES.neutral;
          const text = item.to ? (
            <Link to={item.to} className="font-medium text-primary underline-offset-2 hover:underline">
              {item.text}
            </Link>
          ) : (
            item.text
          );
          return (
            <li key={item.text} className="flex items-start gap-2 text-sm text-foreground">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-hidden="true" />
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    )}
  </Panel>
);

export default TodoPanel;
