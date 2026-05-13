import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LandingPage from './Pages/Authentication/LandingPage';

import KpiAllocationPage from './Pages/KPI/KpiAllocationPage';
import DrivedKpiAllocationPage from './Pages/KPI/DrivedKpiAllocationPage';
import SignIn from './Pages/Authentication/LoginPage';
import NotFoundPage from './Pages/PageNotFound/PageNotFound';
import UserManagment from './Pages/Admin/User-Managment/UserManagment';
import KpiManagement from './Pages/Admin/KPI/Kpi';
import RoleManagement from './Pages/Admin/RoleManagement/RoleManagement';
import Configuration from './Pages/Admin/Configuration/Configuration';
import AlertsNotifications from './Pages/Admin/Notification/AlertsNotification';
import PermissionManagement from './Pages/Admin/Permissions/PermissonsManagement';
import SystemLogs from './Pages/Admin/SystemLogs/SystemLogs';
import Maintenance from './Pages/Common/Maintenance';
import UserProfile from './Pages/Profile/UserProfile';
import ContactAdmin from './Pages/Authentication/ContactAdmin';
import ContactMessages from './Pages/Admin/ContactMessages/ContactMessages';
import DirectMessageView from './Pages/Admin/ContactMessages/DirectMessageView';

import DashboardHome from './Pages/Common/DashboardHome';
import OfficeReport from './Pages/Strategic/OfficeReport';
import RegisteredKpis from './Pages/Strategic/RegisteredKpis';
import AssignedKpisPage from './Pages/KPI/AssignedKpisPage';
import KpiApprovalsPage from './Pages/KPI/KpiApprovalsPage';
import SubUnitPage from './Pages/SubUnit/SubUnitPage';
import { AuthBootstrap, GuestOnly, RequireAuth, RequirePermission } from './Components/Auth/RouteGuards';
import { NotificationProvider } from './Context/NotificationContext';
import AuthenticatedShell from './Components/Layout/AuthenticatedShell';
import permissionUtils from './lib/permissionUtils';
import { SocketProvider } from './Context/SocketContext';

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
                    <Route index element={<Navigate to="/dashboard" replace />} />
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
                            permissionUtils.permissionKey('view', 'Drived KPI Allocation'),
                            permissionUtils.permissionKey('create', 'Drived KPI Allocation'),
                            permissionUtils.permissionKey('assign', 'Drived KPI Allocation'),
                          ]}
                        />
                      }
                    >
                      <Route path="/drived-kpi-allocation" element={<DrivedKpiAllocationPage />} />
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

                    <Route element={<RequirePermission permission={permissionUtils.permissionKey('view', 'Alerts & Notifications')} />}>
                      <Route path="/alert-notification" element={<AlertsNotifications />} />
                    </Route>

                    <Route element={<RequirePermission permissions={[permissionUtils.permissionKey('view', 'System Logs')]} />}>
                      <Route path="/system-logs" element={<SystemLogs />} />
                    </Route>
                    <Route path="/contact-messages" element={<ContactMessages />} />
                    <Route path="/direct-messages" element={<DirectMessageView />} />

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
