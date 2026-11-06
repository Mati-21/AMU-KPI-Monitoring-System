import { Link } from 'react-router-dom';

import { actionLabel, formatDateTime } from '../../../../10-system/lib/auditFormat';
import { useMonitoringSecurity } from '../../../hooks/useMonitoring';
import { AMBER, RED, describeBrowser, formatDuration, formatNumber, levelColor, timeAgo } from '../../../lib/monitoringFormat';
import { fullName } from '../../../lib/dashboardRules';
import { DataState, Notice, Panel, Stat, Table, TrendChart } from './parts';

const hourLabel = (value) => `${String(new Date(value).getHours()).padStart(2, '0')}:00`;

const CertificateCard = ({ certificate, lifetimes }) => (
  <Panel title="Certificates and sessions" description="When things expire">
    <div className="space-y-4">
      {certificate.configured && certificate.daysLeft !== undefined ? (
        <Stat
          label={`TLS certificate · ${certificate.host}`}
          value={certificate.daysLeft < 0 ? 'Expired' : `${certificate.daysLeft} days left`}
          hint={`Expires ${formatDateTime(certificate.expiresAt)}${certificate.issuer ? ` · issued by ${certificate.issuer}` : ''}`}
          color={levelColor(-certificate.daysLeft, -14, -3)}
        />
      ) : certificate.configured ? (
        <Notice>Could not read the certificate for {certificate.host}: {certificate.error}</Notice>
      ) : (
        <Notice>No certificate is checked. Set MONITOR_TLS_HOST (for example kpi.amu.edu.et:443) to watch one.</Notice>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sign-in lasts" value={lifetimes.access} />
        <Stat label="Stay signed in" value={lifetimes.refresh} />
        <Stat label="Login step" value={lifetimes.loginStep} />
      </div>
    </div>
  </Panel>
);

/**
 * Who is trying to get in, who holds the most powerful sessions, and the administrative actions that matter.
 */
const SecuritySection = ({ enabled, live }) => {
  const { data, isLoading, error } = useMonitoringSecurity({ enabled, live });

  return (
    <DataState data={data} isLoading={isLoading} error={error}>
      {data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Failed sign-ins" description="Wrong passwords and wrong codes" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat label="Last 10 minutes" value={formatNumber(data.failedLogins.lastTenMinutes)} color={data.failedLogins.lastTenMinutes >= 20 ? RED : undefined} />
              <Stat label="Last hour" value={formatNumber(data.failedLogins.lastHour)} />
              <Stat label="Last 24 hours" value={formatNumber(data.failedLogins.lastDay)} />
              <Stat label="Locked out (24 h)" value={formatNumber(data.rateLimit.blockedLastDay)} hint={`${data.rateLimit.blockedLastHour} in the last hour`} color={data.rateLimit.blockedLastHour > 0 ? AMBER : undefined} />
            </div>
            <div className="mt-5">
              <TrendChart data={data.failedLogins.byHour.map((point) => ({ label: hourLabel(point.hour), failures: point.failures }))} series={[{ key: 'failures', label: 'Failed sign-ins per hour', color: RED }]} kind="bar" height={140} />
            </div>
          </Panel>

          <Panel title="Most failures from" description="Addresses with the most failed sign-ins in 24 hours">
            <Table
              rows={data.failedLogins.topAddresses}
              rowKey={(row) => row.ipAddress}
              empty="No failed sign-ins in the last 24 hours."
              columns={[
                { header: 'Address', render: (row) => <span className="font-mono">{row.ipAddress}</span> },
                { header: 'Failures', align: 'right', render: (row) => row.failures },
              ]}
            />
          </Panel>

          <Panel title="Open admin sessions" description="People with full Super Admin access who are signed in right now" className="lg:col-span-2">
            <Table
              rows={data.adminSessions}
              rowKey={(row) => row.id}
              empty="No admin is signed in."
              columns={[
                { header: 'Admin', render: (row) => (<><span className="font-medium">{row.name}</span> <span className="text-muted-foreground">@{row.username}</span></>) },
                { header: 'Address', render: (row) => <span className="font-mono">{row.ipAddress ?? '-'}</span> },
                { header: 'Browser', render: (row) => describeBrowser(row.userAgent) },
                { header: 'Session age', align: 'right', render: (row) => formatDuration((Date.now() - new Date(row.startedAt).getTime()) / 1000) },
                { header: 'Last active', align: 'right', render: (row) => timeAgo(row.lastUsedAt) },
              ]}
            />
          </Panel>

          <CertificateCard certificate={data.certificate} lifetimes={data.sessionLifetimes} />

          <Panel
            title="Critical actions"
            description="Changes to roles, settings, passwords and sessions, newest first"
            action={
              <Link to="/system-logs" className="text-xs font-medium text-blue-500 hover:underline">
                View all logs
              </Link>
            }
            className="lg:col-span-3"
          >
            <Table
              rows={data.criticalActions}
              rowKey={(row) => row.id}
              empty="Nothing critical has happened yet."
              columns={[
                { header: 'Action', render: (row) => <span className="font-medium">{actionLabel(row.action)}</span> },
                { header: 'By', render: (row) => (row.actor ? fullName(row.actor) : 'System') },
                { header: 'Address', render: (row) => <span className="font-mono">{row.ipAddress ?? '-'}</span> },
                { header: 'When', align: 'right', render: (row) => formatDateTime(row.createdAt) },
              ]}
            />
          </Panel>
        </div>
      )}
    </DataState>
  );
};

export default SecuritySection;
