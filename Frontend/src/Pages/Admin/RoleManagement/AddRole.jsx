import { useEffect, useMemo, useState } from 'react';

import { Input } from '../../../Components/UI/Input';
import Button from '../../../Components/UI/Button';
import CustomSelect from '../../../Components/UI/CustomSelect';
import { api } from '../../../api/axios';

const NO_CATEGORY_OPTION = 'No Category (Top Level)';

function AddRole({ setActiveTab, onSaved }) {
  const [checked, setChecked] = useState(false);
  const [roleForm, setRoleForm] = useState({
    roleCategoryId: '',
    roleName: '',
    description: '',
    parentRoleId: '',
    extraMeasure: false,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      setLoadingCatalog(true);
      setError('');

      try {
        const [categoriesRes, rolesRes] = await Promise.all([api.get('/role-categories'), api.get('/roles')]);
        if (!mounted) return;
        setCategories(categoriesRes.data?.data || []);
        setRoles(rolesRes.data?.data || []);
      } catch (catalogErr) {
        if (!mounted) return;
        setError(catalogErr?.response?.data?.message || 'Failed to load role catalog from database.');
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    };

    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const roleCategories = useMemo(() => categories.map((category) => ({ label: category.CategoryName, value: category.Id })), [categories]);

  const parentRoleOptions = useMemo(
    () => roles.filter((role) => role.Id !== roleForm.parentRoleId).map((role) => ({ label: role.RoleName, value: role.Id })),
    [roles, roleForm.parentRoleId]
  );

  const handleRoleSave = async () => {
    setError('');

    if (!roleForm.roleName.trim()) {
      setError('Role name is required.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/roles', {
        RoleCategoryId: roleForm.roleCategoryId || null,
        RoleName: roleForm.roleName.trim(),
        ParentRoleId: roleForm.parentRoleId || null,
        Description: roleForm.description?.trim() || null,
        HasExtraMeasures: checked,
      });
    } catch (saveErr) {
      setError(saveErr?.response?.data?.message || 'Failed to save role to database.');
      setSaving(false);
      return;
    }

    setSaving(false);

    setRoleForm({
      roleCategoryId: '',
      roleName: '',
      description: '',
      parentRoleId: '',
      extraMeasure: false,
    });
    setChecked(false);
    onSaved?.();
    setActiveTab('list');
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-8 max-w-md space-y-5">
      <h2 className="text-lg font-semibold">Add Role</h2>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {/* Role Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-600">Role Category</label>
        <CustomSelect
          options={[NO_CATEGORY_OPTION, ...roleCategories.map((item) => item.label)]}
          value={roleCategories.find((item) => item.value === roleForm.roleCategoryId)?.label || NO_CATEGORY_OPTION}
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

      {/* Role Name */}
      <Input placeholder="Enter Role" value={roleForm.roleName} onChange={(e) => setRoleForm({ ...roleForm, roleName: e.target.value })} />

      {/* Description */}
      <Input
        placeholder="Enter Description"
        value={roleForm.description}
        onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
      />

      {/* Parent Role */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-600">Parent Role</label>
        <CustomSelect
          options={parentRoleOptions.map((item) => item.label)}
          value={parentRoleOptions.find((item) => item.value === roleForm.parentRoleId)?.label || ''}
          onChange={(val) => {
            const match = parentRoleOptions.find((item) => item.label === val);
            setRoleForm({ ...roleForm, parentRoleId: match?.value || '' });
          }}
          placeholder="Select Parent Role"
        />
      </div>

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

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleRoleSave} disabled={saving || loadingCatalog}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => setActiveTab('list')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default AddRole;
