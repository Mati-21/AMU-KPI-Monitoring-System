import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import AddUser from './AddUser';
import UserList from './UserList';
import TabButton from '../../../Components/UI/TabButton';
import permissionUtils from '../../../lib/permissionUtils';

const UserManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const isSystemAdmin = permissionUtils.isSystemAdminRoleName(authUser?.roleName || authUser?.role);

  const canManageUsers = useMemo(
    () =>
      isSystemAdmin ||
      permissionUtils.hasPermission(userPermissions, [
        permissionUtils.permissionKey('create', 'User Management'),
        permissionUtils.permissionKey('edit', 'User Management'),
        permissionUtils.permissionKey('delete', 'User Management'),
        permissionUtils.permissionKey('manage', 'Users'),
      ]),
    [isSystemAdmin, userPermissions]
  );
  const canCreateChildAccounts = useMemo(
    () => isSystemAdmin || permissionUtils.hasPermission(userPermissions, permissionUtils.permissionKey('create', 'Child Office Accounts')),
    [isSystemAdmin, userPermissions]
  );
  const canViewList = useMemo(
    () =>
      canManageUsers ||
      canCreateChildAccounts ||
      permissionUtils.hasPermission(userPermissions, [
        permissionUtils.permissionKey('view', 'User Management'),
        permissionUtils.permissionKey('create', 'User Management'),
      ]),
    [canCreateChildAccounts, canManageUsers, userPermissions]
  );
  const canAddUsers = useMemo(
    () =>
      canManageUsers ||
      canCreateChildAccounts ||
      permissionUtils.hasPermission(userPermissions, permissionUtils.permissionKey('create', 'User Management')),
    [canCreateChildAccounts, canManageUsers, userPermissions]
  );

  const [activeTab, setActiveTab] = useState(() => {
    if (requestedTab === 'add') {
      return 'add';
    }

    return canViewList ? 'list' : 'add';
  });
  const [searchQuery, setSearchQuery] = useState('');

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);

    if (nextTab === 'add') {
      setSearchParams({ tab: 'add' }, { replace: true });
      return;
    }

    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (requestedTab === 'add' && canAddUsers) {
      setActiveTab('add');
      return;
    }

    if (requestedTab === 'list' && canViewList) {
      setActiveTab('list');
      return;
    }

    if (activeTab === 'list' && !canViewList && canAddUsers) {
      setActiveTab('add');
      return;
    }

    if (activeTab === 'add' && !canAddUsers && canViewList) {
      setActiveTab('list');
    }
  }, [activeTab, canAddUsers, canViewList, requestedTab]);

  return (
    <div className="flex-1 flex overflow-y-auto  bg-background">
      <div className="flex-1 flex flex-col">
        <main className="p-6">
          <h1 className="text-2xl font-bold mb-5">User Management</h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {canViewList ? <TabButton label="List of Users" value="list" activeValue={activeTab} onChange={handleTabChange} /> : null}
            {canAddUsers ? <TabButton label="Add" value="add" activeValue={activeTab} onChange={handleTabChange} /> : null}
          </div>

          {/* LIST */}
          {activeTab === 'list' && canViewList ? (
            <UserList setSearchQuery={setSearchQuery} searchQuery={searchQuery} setActiveTab={handleTabChange} />
          ) : null}

          {/* ADD */}
          {activeTab === 'add' && canAddUsers ? <AddUser setActiveTab={handleTabChange} /> : null}

          {!canViewList && !canAddUsers ? (
            <p className="rounded-md border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
              You do not have access to user management actions.
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default UserManagement;
