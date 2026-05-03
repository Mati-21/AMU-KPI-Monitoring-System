import { Outlet } from 'react-router-dom';
import Navbar from '../UI/Navbar';
import Sidebar from '../Dashboard/Sidebar';

const AuthenticatedShell = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AuthenticatedShell;
