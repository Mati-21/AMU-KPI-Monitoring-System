import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

/**
 * A simple start page until Module 11 connects the dashboards to the new backend.
 */
const DashboardHome = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.fullName}</h1>
        <p className="text-sm text-muted-foreground">Your dashboard will appear here once the performance dashboards are connected.</p>
        <Link to="/profile" className="inline-block text-sm font-medium text-primary hover:underline underline-offset-4">
          Go to my profile
        </Link>
      </div>
    </div>
  );
};

export default DashboardHome;
