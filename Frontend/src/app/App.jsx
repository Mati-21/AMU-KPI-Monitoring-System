import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LandingPage from '../features/00-landing/pages/LandingPage';

import KpiAllocationPage from '../features/05-contracts/pages/KpiAllocationPage';
import SignIn from '../features/01-identity/pages/LoginPage';
import NotFoundPage from '../shared/pages/PageNotFound';
import UserManagment from '../features/01-identity/pages/users/UserManagment';
import UserDetail from '../features/01-identity/pages/users/UserDetail';
import KpiManagement from '../features/04-kpi-catalog/pages/Kpi';
import RoleManagement from '../features/03-access-control/pages/roles/RoleManagement';
import Configuration from '../features/10-system/pages/configuration/Configuration';
import AlertsNotifications from '../features/09-notifications/pages/AlertsNotification';
import PermissionManagement from '../features/03-access-control/pages/permissions/PermissonsManagement';
import SystemLogs from '../features/10-system/pages/SystemLogs';
import Maintenance from '../features/10-system/pages/Maintenance';
import UserProfile from '../features/01-identity/pages/UserProfile';
import ContactAdmin from '../features/12-support/pages/ContactAdmin';
import SupportRequests from '../features/12-support/pages/SupportRequests';
import DirectMessageView from '../features/13-messaging/pages/DirectMessageView';

import DashboardHome from '../features/11-dashboards/pages/DashboardHome';
import OfficeReport from '../features/07-performance/pages/OfficeReport';
import PlanningPage from '../features/06-reporting-periods/pages/PlanningPage';
import RegisteredKpis from '../features/04-kpi-catalog/pages/RegisteredKpis';
import AssignedKpisPage from '../features/07-performance/pages/AssignedKpisPage';
import KpiApprovalsPage from '../features/07-performance/pages/KpiApprovalsPage';
import OfficesPage from '../features/02-offices/pages/OfficesPage';
import { AuthBootstrap, GuestOnly, RequireAuth, RequirePermission } from '../features/01-identity/components/RouteGuards';
import { NotificationProvider } from '../features/09-notifications/context/NotificationContext';
import AuthenticatedShell from '../shared/components/layout/AuthenticatedShell';
import permissionUtils from '../features/03-access-control/lib/permissionUtils';
import { SocketProvider } from '../shared/context/SocketContext';

function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <AuthBootstrap>
          <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
            <div className="flex-1 flex min-h-0 bg-background">
              <Routes>
                {/* Public Pages */}
                <Route path="/" element={<LandingPage />} />
                <Route element={<GuestOnly />}>
                  <Route path="/signin" element={<SignIn />} />
                  <Route path="/login" element={<Navigate to="/signin" replace />} />
                  <Route path="/contact-admin" element={<ContactAdmin />} />
                </Route>
                <Route path="/maintenance" element={<Maintenance />} />

                {/* Protected Routes */}
                <Route element={<RequireAuth />}>
                  <Route
                    element={
                      <SocketProvider>
                        <AuthenticatedShell />
                      </SocketProvider>
                    }
                  >
                    {/* Dashboard is accessible to all authenticated users — role-based variants are handled inside DashboardHome */}
                    <Route path="/dashboard" element={<DashboardHome />} />

                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'Assigned KPI')} />}>
                      <Route path="/assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>

                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'KPI Approvals')} />}>
                      <Route path="/kpi-approvals" element={<KpiApprovalsPage />} />
                    </Route>

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'KPI Allocation'),
                            permissionUtils.permissionKey('create', 'KPI Allocation'),
                            permissionUtils.permissionKey('assign', 'KPI Allocation'),
                            permissionUtils.permissionKey('delete', 'KPI Allocation'),
                          ]}
                        />
                      }
                    >
                      <Route path="/assign-kpi" element={<KpiAllocationPage />} />
                    </Route>

                    <Route path="/offices" element={<OfficesPage />} />
                    <Route path="/sub-unit" element={<Navigate to="/offices" replace />} />

                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'Registered KPIs')} />}>
                      <Route path="/registered-kpis" element={<RegisteredKpis />} />
                    </Route>

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'KPI Reporting'),
                            permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
                            permissionUtils.permissionKey('view', 'Other Role Reports'),
                          ]}
                        />
                      }
                    >
                      <Route path="/report" element={<OfficeReport />} />
                      <Route path="/reports" element={<Navigate to="/report" replace />} />
                    </Route>

                    <Route element={<RequirePermission permissions={['kpi:create', 'kpi:update', 'kpi:manage']} />}>
                      <Route path="/kpi" element={<KpiManagement />} />
                    </Route>

                    <Route element={<RequirePermission permissions={['kpi:manage', 'period:manage']} />}>
                      <Route path="/planning" element={<PlanningPage />} />
                    </Route>

                    <Route path="/profile" element={<UserProfile />} />

                    <Route element={<RequirePermission permission="user:read" />}>
                      <Route path="/users/:personId" element={<UserDetail />} />
                    </Route>

                    <Route element={<RequirePermission permissions={['user:read', 'user:create']} />}>
                      <Route path="/user-management" element={<UserManagment />} />
                    </Route>

                    <Route element={<RequirePermission permission="role:read" />}>
                      <Route path="/role-management" element={<RoleManagement />} />
                      <Route path="/permission" element={<PermissionManagement />} />
                    </Route>

                    <Route element={<RequirePermission permission="settings:manage" />}>
                      <Route path="/configuration" element={<Configuration />} />
                    </Route>

                    <Route path="/alert-notification" element={<AlertsNotifications />} />

                    <Route element={<RequirePermission permission="audit:read" />}>
                      <Route path="/system-logs" element={<SystemLogs />} />
                    </Route>
                    <Route element={<RequirePermission permission="support:manage" />}>
                      <Route path="/support-requests" element={<SupportRequests />} />
                    </Route>
                    <Route path="/contact-messages" element={<Navigate to="/support-requests" replace />} />
                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'Direct Messages')} />}>
                      <Route path="/direct-messages" element={<DirectMessageView />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </div>
        </AuthBootstrap>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
