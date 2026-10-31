import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LandingPage from '../features/00-landing/pages/LandingPage';

import KpiAllocationPage from '../features/05-contracts/pages/KpiAllocationPage';
import SignIn from '../features/01-identity/pages/LoginPage';
import NotFoundPage from '../shared/pages/PageNotFound';
import UserManagment from '../features/01-identity/pages/users/UserManagment';
import KpiManagement from '../features/04-kpi-catalog/pages/Kpi';
import RoleManagement from '../features/03-access-control/pages/roles/RoleManagement';
import Configuration from '../features/10-system/pages/configuration/Configuration';
import AlertsNotifications from '../features/09-notifications/pages/AlertsNotification';
import PermissionManagement from '../features/03-access-control/pages/permissions/PermissonsManagement';
import SystemLogs from '../features/10-system/pages/SystemLogs';
import Maintenance from '../features/10-system/pages/Maintenance';
import UserProfile from '../features/01-identity/pages/UserProfile';
import ContactAdmin from '../features/01-identity/pages/ContactAdmin';
import ContactMessages from '../features/12-messaging/pages/ContactMessages';
import DirectMessageView from '../features/12-messaging/pages/DirectMessageView';

import DashboardHome from '../features/11-dashboards/pages/DashboardHome';
import OfficeReport from '../features/07-performance/pages/OfficeReport';
import RegisteredKpis from '../features/04-kpi-catalog/pages/RegisteredKpis';
import AssignedKpisPage from '../features/07-performance/pages/AssignedKpisPage';
import KpiApprovalsPage from '../features/07-performance/pages/KpiApprovalsPage';
import SubUnitPage from '../features/02-offices/pages/SubUnitPage';
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

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'Sub Unit'),
                            permissionUtils.permissionKey('create', 'Sub Unit'),
                            permissionUtils.permissionKey('create', 'Child Office Accounts'),
                          ]}
                        />
                      }
                    >
                      <Route path="/sub-unit" element={<SubUnitPage />} />
                    </Route>

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

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'KPI Management'),
                            permissionUtils.permissionKey('create', 'KPI Management'),
                            permissionUtils.permissionKey('edit', 'KPI Management'),
                          ]}
                        />
                      }
                    >
                      <Route path="/kpi" element={<KpiManagement />} />
                    </Route>

                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'Personal Profile')} />}>
                      <Route path="/profile" element={<UserProfile />} />
                    </Route>

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'Personal Profile'),
                            permissionUtils.permissionKey('view', 'User Management'),
                            permissionUtils.permissionKey('manage', 'Users'),
                            permissionUtils.permissionKey('edit', 'User Management'),
                          ]}
                        />
                      }
                    >
                      <Route path="/profile/:userId" element={<UserProfile />} />
                    </Route>

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'User Management'),
                            permissionUtils.permissionKey('manage', 'Users'),
                            permissionUtils.permissionKey('create', 'Child Office Accounts'),
                          ]}
                        />
                      }
                    >
                      <Route path="/user-management" element={<UserManagment />} />
                    </Route>

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'Role Management'),
                            permissionUtils.permissionKey('create', 'Role Management'),
                            permissionUtils.permissionKey('manage', 'Roles'),
                            permissionUtils.permissionKey('manage', 'Permissions'),
                          ]}
                        />
                      }
                    >
                      <Route path="/role-management" element={<RoleManagement />} />
                    </Route>

                    <Route
                      element={
                        <RequirePermission
                          permissions={[
                            permissionUtils.permissionKey('view', 'Role Management'),
                            permissionUtils.permissionKey('create', 'Role Management'),
                            permissionUtils.permissionKey('manage', 'Permissions'),
                            permissionUtils.permissionKey('manage', 'Roles'),
                          ]}
                        />
                      }
                    >
                      <Route path="/permission" element={<PermissionManagement />} />
                    </Route>

                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'Configuration')} />}>
                      <Route path="/configuration" element={<Configuration />} />
                    </Route>

                    <Route path="/alert-notification" element={<AlertsNotifications />} />

                    <Route element={<RequirePermission permissions={[permissionUtils.permissionKey('view', 'System Logs')]} />}>
                      <Route path="/system-logs" element={<SystemLogs />} />
                    </Route>
                    <Route path="/contact-messages" element={<ContactMessages />} />
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
