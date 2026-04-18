import { BrowserRouter, Route, Routes } from 'react-router-dom';

import LandingPage from './Pages/Authentication/LandingPage';

import FaculityAssignKpi from './Pages/Faculity/AssignKpi';
import SignIn from './Pages/Authentication/LoginPage';
import NotFoundPage from './Pages/PageNotFound/PageNotFound';
import UserManagment from './Pages/Admin/User-Managment/UserManagment';
import Admin from './Pages/Admin/Admin';
import AdminDashboard from './Pages/Admin/AdminDashboard/AdminDashboard';
import KpiManagement from './Pages/Admin/KPI/Kpi';
import RoleManagement from './Pages/Admin/RoleManagement/RoleManagement';
import Configuration from './Pages/Admin/Configuration/Configuration';
import AlertsNotifications from './Pages/Admin/Notification/AlertsNotification';
import PermissionManagement from './Pages/Admin/Permissions/PermissonsManagement';
import UserProfile from './Pages/Profile/UserProfile';

import FaculityDashboard from './Pages/Faculity/FaculityDashboard';
import Strategic from './Pages/Strategic/Strategic';
import Staff from './Pages/Staff/Staff';
import Chair from './Pages/Chairs/Chair';
import Faculity from './Pages/Faculity/Faculity';
import VicePresident from './Pages/Vice President/VicePresident';
import HigherInstitutions from './Pages/Higher_Institutions/HigherInstitutions';
import Reports from './Pages/Strategic/Reports';
import RegisteredKpis from './Pages/Strategic/RegisteredKpis';
import RegisteredKpisVP from './Pages/Vice President/RegisteredKpis';
import RegisteredKpisHI from './Pages/Higher_Institutions/RegisteredKpis';
import AssignedKpisPage from './Pages/KPI/AssignedKpisPage';
import SubUnitPage from './Pages/SubUnit/SubUnitPage';
import { AuthBootstrap, GuestOnly, RequireAuth, RequireModulePermission } from './Components/Auth/RouteGuards';
import { NotificationProvider } from './Context/NotificationContext';

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
                </Route>

                {/* Protected Routes */}
                <Route element={<RequireAuth />}>
                  {/* Staff */}
                  <Route path="/staff" element={<Staff />}>
                    <Route index element={<FaculityDashboard />} />
                    <Route element={<RequireModulePermission moduleName="Performance" action="view" />}>
                      <Route path="assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Assigned KPI" action="view" />}>
                      <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Sub Unit" action="view" />}>
                      <Route path="sub-unit" element={<SubUnitPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Registered KPIs" action="view" />}>
                      <Route path="registered-kpis" element={<RegisteredKpis />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Reporting" action="view" />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Management" action="view" />}>
                      <Route path="kpi" element={<KpiManagement />} />
                    </Route>
                    <Route path="profile" element={<UserProfile />} />
                  </Route>

                  {/* Department Chair */}
                  <Route path="/department-chair" element={<Chair />}>
                    <Route index element={<FaculityDashboard />} />
                    <Route element={<RequireModulePermission moduleName="Performance" action="view" />}>
                      <Route path="assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Assigned KPI" action="view" />}>
                      <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Sub Unit" action="view" />}>
                      <Route path="sub-unit" element={<SubUnitPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Registered KPIs" action="view" />}>
                      <Route path="registered-kpis" element={<RegisteredKpis />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Reporting" action="view" />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Management" action="view" />}>
                      <Route path="kpi" element={<KpiManagement />} />
                    </Route>
                    <Route path="profile" element={<UserProfile />} />
                  </Route>

                  {/* Faculty Admin */}
                  <Route path="/faculty-admin" element={<Faculity />}>
                    <Route index element={<FaculityDashboard />} />
                    <Route element={<RequireModulePermission moduleName="Performance" action="view" />}>
                      <Route path="assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Assigned KPI" action="view" />}>
                      <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Sub Unit" action="view" />}>
                      <Route path="sub-unit" element={<SubUnitPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Registered KPIs" action="view" />}>
                      <Route path="registered-kpis" element={<RegisteredKpis />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Reporting" action="view" />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Management" action="view" />}>
                      <Route path="kpi" element={<KpiManagement />} />
                    </Route>
                    <Route path="profile" element={<UserProfile />} />
                  </Route>

                  {/* Higher Institution */}
                  <Route path="/higher-institution" element={<HigherInstitutions />}>
                    <Route index element={<FaculityDashboard />} />
                    <Route element={<RequireModulePermission moduleName="Performance" action="view" />}>
                      <Route path="assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Assigned KPI" action="view" />}>
                      <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Sub Unit" action="view" />}>
                      <Route path="sub-unit" element={<SubUnitPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Registered KPIs" action="view" />}>
                      <Route path="registered-kpis" element={<RegisteredKpisHI />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Reporting" action="view" />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Management" action="view" />}>
                      <Route path="kpi" element={<KpiManagement />} />
                    </Route>
                    <Route path="profile" element={<UserProfile />} />
                  </Route>

                  {/* Vice President */}
                  <Route path="/vice-president" element={<VicePresident />}>
                    <Route index element={<FaculityDashboard />} />
                    <Route element={<RequireModulePermission moduleName="Performance" action="view" />}>
                      <Route path="assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Sub Unit" action="view" />}>
                      <Route path="sub-unit" element={<SubUnitPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Assigned KPI" action="view" />}>
                      <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Registered KPIs" action="view" />}>
                      <Route path="registered-kpis" element={<RegisteredKpisVP />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Reporting" action="view" />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Management" action="view" />}>
                      <Route path="kpi" element={<KpiManagement />} />
                    </Route>
                    <Route path="profile" element={<UserProfile />} />
                  </Route>

                  {/* Strategic Office */}
                  <Route path="/strategic-office" element={<Strategic />}>
                    <Route index element={<FaculityDashboard />} />
                    <Route element={<RequireModulePermission moduleName="Performance" action="view" />}>
                      <Route path="assigned-kpis" element={<AssignedKpisPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Assigned KPI" action="view" />}>
                      <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Sub Unit" action="view" />}>
                      <Route path="sub-unit" element={<SubUnitPage />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="Registered KPIs" action="view" />}>
                      <Route path="registered-kpis" element={<RegisteredKpis />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Reporting" action="view" />}>
                      <Route path="reports" element={<Reports />} />
                    </Route>
                    <Route element={<RequireModulePermission moduleName="KPI Management" action="view" />}>
                      <Route path="kpi" element={<KpiManagement />} />
                    </Route>
                    <Route path="profile" element={<UserProfile />} />
                  </Route>

                  {/* Shared Profile Views */}
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/profile/:userId" element={<UserProfile />} />

                  {/* Admin */}
                  <Route path="/admin" element={<Admin />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="user-management" element={<UserManagment />} />
                    <Route path="role-management" element={<RoleManagement />} />
                    <Route path="kpi" element={<KpiManagement />} />
                    <Route path="configuration" element={<Configuration />} />
                    <Route path="alert-notification" element={<AlertsNotifications />} />
                    <Route path="permission" element={<PermissionManagement />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="profile/:userId" element={<UserProfile />} />
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
