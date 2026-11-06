/**
 * Where a notification takes the person when they open it, or null when there is nowhere useful to go.
 * Contracts differ by who is reading: the office that received one goes to its own contract, the office above to the review page.
 */
export const notificationLink = ({ notificationType, entityType, entityId }) => {
  switch (notificationType) {
    case 'CONTRACT_ASSIGNED':
      return '/my-contract';
    case 'CONTRACT_REJECTED':
    case 'CONTRACT_SIGNED':
      return entityId ? `/assign-kpi/${entityId}` : '/assign-kpi';
    case 'CHANGE_REQUESTED':
      return '/approvals';
    case 'CHANGE_REVIEWED':
      return '/my-contract';
    default:
  }

  switch (entityType) {
    case 'performance_report':
      return entityId ? `/reports/${entityId}` : '/performance';
    case 'reporting_period':
      return '/performance';
    case 'support_request':
      return '/support-requests';
    default:
      return null;
  }
};

export default notificationLink;
