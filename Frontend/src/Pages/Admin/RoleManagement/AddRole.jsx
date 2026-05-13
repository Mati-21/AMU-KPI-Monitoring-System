import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { Input } from '../../../Components/UI/Input';
import Button from '../../../Components/UI/Button';
import CustomSelect from '../../../Components/UI/CustomSelect';
import { api } from '../../../api/axios';
import permissionUtils from '../../../lib/permissionUtils';
import { 
  useRolesQuery, 
  useRoleCategoriesQuery,
  useCreateRoleMutation 
} from '../../../Hooks/Queries/useRoles';

const NO_CATEGORY_OPTION = 'No Category (Top Level)';

function AddRole({ setActiveTab, onSaved }) {
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const canCreateRole = permissionUtils.hasPermission(userPermissions, [
    permissionUtils.permissionKey('create', 'Role Management'),
    permissionUtils.permissionKey('manage', 'Roles'),
  ]);
  const canManageRoles = permissionUtils.hasPermission(userPermissions, permissionUtils.permissionKey('manage', 'Roles'));
  const delegatedOnlyMode = canCreateRole && !canManageRoles;
  const creatorRoleCategoryId = authUser?.roleCategoryId || '';
  const [checked, setChecked] = useState(false);
  const [checkedDistributable, setCheckedDistributable] = useState(true);
  const [roleForm, setRoleForm] = useState({
    roleCategoryId: delegatedOnlyMode ? creatorRoleCategoryId : '',
    roleName: '',
    description: '',
    parentRoleId: '',
    extraMeasure: false,
  });

  // Queries
  const { data: categories = [], isLoading: loadingCategories } = useRoleCategoriesQuery();
  const { data: roles = [], isLoading: loadingRoles } = useRolesQuery();

  // Mutations
  const createRoleMutation = useCreateRoleMutation();

  const loadingCatalog = loadingCategories || loadingRoles;
  const [error, setError] = useState('');



  const roleCategories = useMemo(() => categories.map((category) => ({ label: category.CategoryName, value: category.Id })), [categories]);

  const creatorCategoryLabel = useMemo(() => {
    if (!creatorRoleCategoryId) {
      return authUser?.roleCategoryName || 'No Category (Top Level)';
    }

    return (
      roleCategories.find((category) => String(category.value) === String(creatorRoleCategoryId))?.label ||
      authUser?.roleCategoryName ||
      'No Category'
    );
  }, [authUser?.roleCategoryName, creatorRoleCategoryId, roleCategories]);

  const parentRoleOptions = useMemo(() => roles.map((role) => ({ label: role.RoleName, value: role.Id })), [roles]);

  const selectedParentRoleLabel = useMemo(
    () => parentRoleOptions.find((item) => String(item.value) === String(roleForm.parentRoleId))?.label || '',
    [parentRoleOptions, roleForm.parentRoleId]
  );

  const currentRoleOption = useMemo(() => {
    if (!authUser?.roleId) return null;
    return roles.find((role) => String(role.Id) === String(authUser.roleId)) || null;
  }, [authUser?.roleId, roles]);

  const handleRoleSave = async () => {
    setError('');

    if (!roleForm.roleName.trim()) {
      setError('Role name is required.');
      return;
    }

    if (delegatedOnlyMode && !creatorRoleCategoryId) {
      setError('Your role category is not available. Please contact admin to set your role category before creating roles.');
      return;
    }

    if (delegatedOnlyMode && !authUser?.roleId) {
      setError('Delegated role creation requires your current role to be available. Please reload and try again.');
      return;
    }

    createRoleMutation.mutate({
      RoleCategoryId: delegatedOnlyMode ? creatorRoleCategoryId || null : roleForm.roleCategoryId || null,
      RoleName: roleForm.roleName.trim(),
      ParentRoleId: delegatedOnlyMode ? authUser?.roleId || null : roleForm.parentRoleId || null,
      Description: roleForm.description?.trim() || null,
      HasExtraMeasures: checked,
      IsDistributable: checkedDistributable,
    }, {
      onSuccess: () => {
        setRoleForm({
          roleCategoryId: delegatedOnlyMode ? creatorRoleCategoryId : '',
          roleName: '',
          description: '',
          parentRoleId: '',
          extraMeasure: false,
        });
        setChecked(false);
        setCheckedDistributable(true);
        onSaved?.();
        setActiveTab('list');
      },
      onError: (err) => {
        setError(err?.response?.data?.message || 'Failed to save role to database.');
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-8 max-w-md space-y-5">
      <h2 className="text-lg font-semibold">Add Role</h2>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {/* Role Category */}
      {delegatedOnlyMode ? (
        <div className="rounded-md border border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Role Category</p>
          <p className="mt-1">{creatorCategoryLabel}</p>
          <p className="mt-1 text-xs">New roles inherit your current role category.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">Role Category</label>
          <CustomSelect
            options={[NO_CATEGORY_OPTION, ...roleCategories.map((item) => item.label)]}
            value={roleCategories.find((item) => item.value === roleForm.roleCategoryId)?.label || NO_CATEGORY_OPTION}
            menuPlacement="top"
            onChange={(val) => {
              if (val === NO_CATEGORY_OPTION) {
                setRoleForm({ ...roleForm, roleCategoryId: '', parentRoleId: '' });
                return;
              }
              const match = roleCategories.find((item) => item.label === val);
              setRoleForm({ ...roleForm, roleCategoryId: match?.value || '', parentRoleId: '' });
            }}
            placeholder={loadingCatalog ? 'Loading categories...' : 'Select Role Category'}
          />
        </div>
      )}

      {/* Role Name */}
      <Input placeholder="Enter Role" value={roleForm.roleName} onChange={(e) => setRoleForm({ ...roleForm, roleName: e.target.value })} />

      {/* Description */}
      <Input
        placeholder="Enter Description"
        value={roleForm.description}
        onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
      />

      {/* Parent Role */}
      {delegatedOnlyMode ? (
        <div className="rounded-md border border-border bg-background/60 px-3 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Parent Role</p>
          <p className="mt-1">{currentRoleOption?.RoleName || 'Your current role'}</p>
          <p className="mt-1 text-xs">New roles will automatically be created under your role.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">Parent Role</label>
          <CustomSelect
            options={parentRoleOptions.map((item) => item.label)}
            value={selectedParentRoleLabel}
            menuPlacement="top"
            onChange={(val) => {
              const match = parentRoleOptions.find((item) => item.label === val);
              setRoleForm({ ...roleForm, parentRoleId: match?.value || '' });
            }}
            placeholder="Select Parent Role"
          />
        </div>
      )}

      {/* Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="w-5 h-5 text-green-500 border-gray-300 rounded "
        />
        <span className="text-xs">Extra Measure</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checkedDistributable}
          onChange={(e) => setCheckedDistributable(e.target.checked)}
          className="w-5 h-5 text-green-500 border-gray-300 rounded "
        />
        <span className="text-xs">Is Distributable</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleRoleSave} disabled={createRoleMutation.isPending || loadingCatalog}>
          {createRoleMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => setActiveTab('list')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default AddRole;
