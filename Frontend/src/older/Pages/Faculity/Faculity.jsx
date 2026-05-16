import { Outlet } from 'react-router-dom';
import Navbar from '../../Components/UI/Navbar';
import Sidebar from '../../Components/Dashboard/Sidebar';

function Faculity() {
  return (
    <div className="flex min-h-screen bg-background w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
}

export default Faculity;
