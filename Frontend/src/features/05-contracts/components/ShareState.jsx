/**
 * Whether what was assigned reaches the amount to share. Going over is allowed, so it is a note and not a problem.
 */
const ShareState = ({ difference }) => {
  if (difference < 0) return <span className="text-xs font-medium text-red-600 dark:text-red-400">Short by {-difference}</span>;
  if (difference > 0) return <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Over by {difference}</span>;
  return <span className="text-xs font-medium text-green-700 dark:text-green-400">Fully assigned</span>;
};

export default ShareState;
