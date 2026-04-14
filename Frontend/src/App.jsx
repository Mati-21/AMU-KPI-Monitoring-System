import { BrowserRouter, Route, Routes } from 'react-router-dom';

import LandingPage from './Pages/Authentication/LandingPage';

import VicePresidentDashboard from './Pages/Vice President/VicePresidentDashboard';
import FaculityDashboard from './Pages/Faculity/FaculityDashboard';
import FaculityAssignKpi from './Pages/Faculity/AssignKpi';
import ChairDashboard from './Pages/Chairs/ChairDashboard';
import StaffDashboard from './Pages/Staff/StaffDashboard';
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

import Dashboard from './Pages/Strategic/Dashboard';
import UniversityKpis from './Pages/Strategic/UniversityKpis';
import Strategic from './Pages/Strategic/Strategic';
import Staff from './Pages/Staff/Staff';
import Chair from './Pages/Chairs/Chair';
import Faculity from './Pages/Faculity/Faculity';
import VicePresident from './Pages/Vice President/VicePresident';
import HigherInstitutions from './Pages/Higher_Institutions/HigherInstitutions';
import HigherInstitutionsDashboard from './Pages/Higher_Institutions/HigherOfficeDashboard';
import Reports from './Pages/Strategic/Reports';
import RegisteredKpis from './Pages/Strategic/RegisteredKpis';
import RegisteredKpisVP from './Pages/Vice President/RegisteredKpis';
import RegisteredKpisHI from './Pages/Higher_Institutions/RegisteredKpis';
import { AuthBootstrap, GuestOnly, RequireAuth } from './Components/Auth/RouteGuards';

function App() {
  return (
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
                  <Route index element={<StaffDashboard />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>

                {/* Department Chair */}
                <Route path="/department-chair" element={<Chair />}>
                  <Route index element={<ChairDashboard />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>

                {/* Faculty Admin */}
                <Route path="/faculty-admin" element={<Faculity />}>
                  <Route index element={<FaculityDashboard />} />
                  <Route path="assign-kpi" element={<FaculityAssignKpi />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>

                {/* Higher Institution */}
                <Route path="/higher-institution" element={<HigherInstitutions />}>
                  <Route index element={<HigherInstitutionsDashboard />} />
                  <Route path="registered-kpis" element={<RegisteredKpisHI />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>

                {/* Vice President */}
                <Route path="/vice-president" element={<VicePresident />}>
                  <Route index element={<VicePresidentDashboard />} />
                  <Route path="registered-kpis" element={<RegisteredKpisVP />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>

                {/* Strategic Office */}
                <Route path="/strategic-office" element={<Strategic />}>
                  <Route index element={<Dashboard />} />
                  <Route path="university-kpis" element={<UniversityKpis />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="registered-kpis" element={<RegisteredKpis />} />
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
  );
}

export default App;
