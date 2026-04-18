import AdminSidebar from '../../Components/Dashboard/AdminSidebar';
import Navbar from '../../Components/UI/Navbar';
import { Outlet } from 'react-router-dom';

const Admin = () => {
  return (
    <div className="flex min-h-screen bg-background w-full ">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <Outlet />
      </div>
    </div>
  );
};

export default Admin;
