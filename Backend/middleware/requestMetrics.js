import { recordRequest } from '../modules/14-system-monitoring/collectors/traffic.collector.js';

/**
 * Times every API request for System Monitoring. The dashboard's own polling is left out, or it would be most of
 * what it reports.
 */
const SKIPPED = /^\/api\/v1\/monitoring(\/|$)/;

export const requestMetrics = (req, res, next) => {
  if (SKIPPED.test(req.originalUrl)) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // The matched pattern ("/persons/:id"), so a thousand different ids count as one endpoint. Express forgets the
    // router's base path when a request ends in an error, so it is put back from the address.
    const base = req.baseUrl || (req.originalUrl.startsWith('/api/v1') ? '/api/v1' : '');
    const route = req.route ? `${req.method} ${base}${req.route.path}` : `${req.method} (no matching route)`;
    recordRequest({ route, status: res.statusCode, ms });
  });
  return next();
};

export default requestMetrics;
