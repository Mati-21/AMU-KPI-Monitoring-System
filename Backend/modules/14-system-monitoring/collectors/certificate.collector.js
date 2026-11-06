import tls from 'tls';

/**
 * Days left on the server's TLS certificate. The app itself usually sits behind a web server that holds the
 * certificate, so it is only checked when MONITOR_TLS_HOST says where to look (for example "kpi.amu.edu.et:443").
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 4000;

let cached = null;

const readCertificate = (host, port) =>
  new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: TIMEOUT_MS }, () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      if (!certificate?.valid_to) return resolve({ configured: true, host, error: 'No certificate was presented' });
      const expiresAt = new Date(certificate.valid_to);
      return resolve({ configured: true, host, issuer: certificate.issuer?.O ?? certificate.issuer?.CN ?? null, expiresAt: expiresAt.toISOString(), daysLeft: Math.floor((expiresAt.getTime() - Date.now()) / DAY_MS) });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ configured: true, host, error: 'The server did not answer in time' });
    });
    socket.on('error', (error) => resolve({ configured: true, host, error: error.message }));
  });

export const getCertificate = async () => {
  const target = process.env.MONITOR_TLS_HOST?.trim();
  if (!target) return { configured: false };
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const [host, port = '443'] = target.split(':');
  const value = await readCertificate(host, Number(port));
  cached = { at: Date.now(), value };
  return value;
};

export default { getCertificate };
