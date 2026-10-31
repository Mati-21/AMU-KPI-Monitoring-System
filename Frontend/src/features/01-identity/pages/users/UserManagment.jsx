import { useSearchParams } from 'react-router-dom';

import TabButton from '../../../../shared/components/ui/TabButton';
import { useCan } from '../../../03-access-control/hooks/useCan';
import AddUser from './AddUser';
import UserList from './UserList';

const UserManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const can = useCan();
  const canViewList = can('user:read');
  const canAddUsers = can('user:create');
  const requestedTab = searchParams.get('tab');
  const activeTab = requestedTab === 'add' && canAddUsers ? 'add' : canViewList ? 'list' : 'add';

  const changeTab = (next) => setSearchParams(next === 'add' ? { tab: 'add' } : {}, { replace: true });

  return (
    <div className="flex-1 flex overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col">
        <main className="p-6">
          <h1 className="text-2xl font-bold mb-5">User Management</h1>

          <div className="flex gap-2 mb-6">
            {canViewList && <TabButton label="List of Users" value="list" activeValue={activeTab} onChange={changeTab} />}
            {canAddUsers && <TabButton label="Add" value="add" activeValue={activeTab} onChange={changeTab} />}
          </div>

          {activeTab === 'list' && canViewList && <UserList onAdd={canAddUsers ? () => changeTab('add') : null} />}
          {activeTab === 'add' && canAddUsers && <AddUser onDone={() => changeTab(canViewList ? 'list' : 'add')} />}
        </main>
      </div>
    </div>
  );
};

export default UserManagement;
