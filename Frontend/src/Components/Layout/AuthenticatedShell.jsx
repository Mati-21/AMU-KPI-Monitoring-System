import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../UI/Navbar';
import Sidebar from '../Dashboard/Sidebar';

const AuthenticatedShell = () => {
  const location = useLocation();
  const isDirectMessage = location.pathname === '/direct-messages';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {!isDirectMessage && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className={`min-h-0 flex-1 overflow-y-scroll ${isDirectMessage ? 'mt-0' : 'mt-4'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AuthenticatedShell;
