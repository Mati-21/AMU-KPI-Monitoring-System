/**
 * The acting user passed from controllers to services: identity, scoped access helpers
 * (populated by requirePermission) and request metadata for the audit trail.
 */
export const actorOf = (req) => ({
  accountId: req.user?.id,
  personId: req.user?.personId,
  access: req.access,
  ipAddress: req.ip,
  userAgent: req.get('user-agent') || null,
});

export default { actorOf };
