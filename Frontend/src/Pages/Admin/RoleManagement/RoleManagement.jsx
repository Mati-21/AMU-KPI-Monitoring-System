import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Search, SlidersHorizontal, Edit, Trash2 } from 'lucide-react';
import Button from '../../../Components/UI/Button';

import SearchInput from '../../../Components/UI/SearchInput';
import { Input } from '../../../Components/UI/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../Components/UI/dialog';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '../../../Components/UI/Table';

import AddRole from './AddRole';
import AddCategory from './AddCategory';
import TabButton from '../../../Components/UI/TabButton';
import { api } from '../../../api/axios';
import { useSearchParams } from 'react-router-dom';
import permissionUtils from '../../../lib/permissionUtils';

const NO_CATEGORY_OPTION = 'No Category (Top Level)';

const RoleManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const canCreateRole = permissionUtils.hasPermission(userPermissions, [
    permissionUtils.permissionKey('create', 'Role Management'),
    permissionUtils.permissionKey('manage', 'Roles'),
  ]);
  const canManageRoleCategories = permissionUtils.hasPermission(userPermissions, [
    permissionUtils.permissionKey('manage', 'Roles'),
    permissionUtils.permissionKey('manage', 'Permissions'),
  ]);
  const [activeTab, setActiveTab] = useState(requestedTab || 'list');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'list') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [roles, setRoles] = useState([]);
  const [roleCategories, setRoleCategories] = useState([]);

  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [deletingRole, setDeletingRole] = useState(null);

  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [editRoleForm, setEditRoleForm] = useState({
    roleName: '',
    description: '',
    roleCategoryId: '',
    parentRoleId: '',
    extraMeasure: false,
    isDistributable: true,
  });
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    if (activeTab !== 'list') return;

    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setPageError('');

      try {
        const [rolesRes, categoriesRes] = await Promise.all([api.get('/roles', { params: { t: Date.now() } }), api.get('/role-categories')]);
        if (!mounted) return;
        setRoles(rolesRes.data?.data || []);
        setRoleCategories(categoriesRes.data?.data || []);
      } catch (loadErr) {
        if (!mounted) return;
        setPageError(loadErr?.response?.data?.message || 'Failed to load role management data from database.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [refreshKey, activeTab]);

  const roleRows = useMemo(
    () =>
      roles.map((role) => ({
        id: role.Id,
        roleName: role.RoleName,
        description: role.Description || '',
        roleCategory: role?.RoleCategory?.CategoryName || '',
        roleCategoryId: role?.RoleCategory?.Id || role.RoleCategoryId || '',
        parentRole: role?.ParentRole?.RoleName || '',
        parentRoleId: role.ParentRoleId || '',
        extraMeasure: Boolean(role.HasExtraMeasures),
        isDistributable: Boolean(role.IsDistributable),
      })),
    [roles]
  );

  const categoryRows = useMemo(
    () =>
      roleCategories.map((category) => ({
        id: category.Id,
        name: category.CategoryName,
        description: category.Description || '',
      })),
    [roleCategories]
  );

  const filtered = useMemo(
    () =>
      roleRows.filter(
        (r) =>
          r.roleName.toLowerCase().includes(search.toLowerCase()) ||
          r.roleCategory.toLowerCase().includes(search.toLowerCase()) ||
          r.parentRole.toLowerCase().includes(search.toLowerCase())
      ),
    [roleRows, search]
  );

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRoles = filtered.slice(startIndex, startIndex + itemsPerPage);

  const tabs = [
    { key: 'list', label: 'List of Roles' },
    ...(canCreateRole ? [{ key: 'addRole', label: 'Add Role' }] : []),
    ...(canManageRoleCategories ? [{ key: 'addCategory', label: 'Add Role Category' }] : []),
  ];

  useEffect(() => {
    if (activeTab === 'addRole' && !canCreateRole) {
      setActiveTab('list');
    }

    if (activeTab === 'addCategory' && !canManageRoleCategories) {
      setActiveTab('list');
    }
  }, [activeTab, canCreateRole, canManageRoleCategories]);

  const handleEditCategory = (category) => {
    setModalError('');
    setEditingCategory(category);
    setEditForm({
      name: category.name,
      description: category.description || '',
    });
  };

  const submitEditCategory = async () => {
    if (!editingCategory) return;

    if (!editForm.name.trim()) {
      setModalError('Role category name is required.');
      return;
    }

    setModalSaving(true);
    setModalError('');

    try {
      await api.put(`/role-categories/${editingCategory.id}`, {
        CategoryName: editForm.name.trim(),
        Description: editForm.description?.trim() || null,
      });
      setEditingCategory(null);
      setRefreshKey((prev) => prev + 1);
    } catch (saveErr) {
      setModalError(saveErr?.response?.data?.message || 'Failed to update role category.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteCategory = (category) => {
    setModalError('');
    setDeletingCategory(category);
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;

    setModalSaving(true);
    setModalError('');

    try {
      await api.delete(`/role-categories/${deletingCategory.id}`);
      setDeletingCategory(null);
      setRefreshKey((prev) => prev + 1);
    } catch (deleteErr) {
      setModalError(deleteErr?.response?.data?.message || 'Failed to delete role category.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleEditRole = (role) => {
    setModalError('');
    setEditingRole(role);
    setEditRoleForm({
      roleName: role.roleName || '',
      description: role.description || '',
      roleCategoryId: role.roleCategoryId || '',
      parentRoleId: role.parentRoleId || '',
      extraMeasure: Boolean(role.extraMeasure),
      isDistributable: Boolean(role.isDistributable),
    });
  };

  const submitEditRole = async () => {
    if (!editingRole) return;

    if (!editRoleForm.roleName.trim()) {
      setModalError('Role name is required.');
      return;
    }

    if (editRoleForm.parentRoleId && editRoleForm.parentRoleId === editingRole.id) {
      setModalError('Role cannot be its own parent.');
      return;
    }

    setModalSaving(true);
    setModalError('');

    try {
      await api.put(`/roles/${editingRole.id}`, {
        RoleCategoryId: editRoleForm.roleCategoryId || null,
        RoleName: editRoleForm.roleName.trim(),
        ParentRoleId: editRoleForm.parentRoleId || null,
        Description: editRoleForm.description?.trim() || null,
        HasExtraMeasures: Boolean(editRoleForm.extraMeasure),
        IsDistributable: Boolean(editRoleForm.isDistributable),
      });

      setEditingRole(null);
      setRefreshKey((prev) => prev + 1);
    } catch (saveErr) {
      setModalError(saveErr?.response?.data?.message || 'Failed to update role.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteRole = (role) => {
    setModalError('');
    setDeletingRole(role);
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;

    setModalSaving(true);
    setModalError('');

    try {
      await api.delete(`/roles/${deletingRole.id}`);
      setDeletingRole(null);
      setRefreshKey((prev) => prev + 1);
    } catch (deleteErr) {
      setModalError(deleteErr?.response?.data?.message || 'Failed to delete role.');
    } finally {
      setModalSaving(false);
    }
  };

  const editParentRoleOptions = roleRows.filter((role) => role.id !== editingRole?.id);

  return (
    <div className="flex overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 space-y-6">
          <h1 className="text-2xl font-bold text-foreground">Role Management</h1>

          <div className="flex gap-2">
            {tabs.map((tab) => (
              <TabButton key={tab.key} label={tab.label} value={tab.key} activeValue={activeTab} onChange={handleTabChange} />
            ))}
          </div>

          {activeTab === 'list' && (
            <div className="space-y-4">
              {pageError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</p> : null}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">All Roles {filtered.length}</p>

                <div className="flex items-center gap-3">
                  <div className="w-80">
                    <SearchInput value={search} onChange={setSearch} placeholder="Search roles..." />
                  </div>

                  <button className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-muted shadow-soft">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Filters</span>
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold text-foreground">Registered Roles</h2>
                <p className="mt-1 text-xs text-muted-foreground">All roles currently registered in the system.</p>

                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Role Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Role Category</TableHead>
                        <TableHead>Parent Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5}>Loading roles...</TableCell>
                        </TableRow>
                      ) : paginatedRoles.length ? (
                        paginatedRoles.map((role) => (
                          <TableRow key={role.id}>
                            <TableCell>{role.roleName}</TableCell>
                            <TableCell>{role.description || 'No description'}</TableCell>
                            <TableCell>{role.roleCategory || 'No Category'}</TableCell>
                            <TableCell>{role.parentRole || 'None'}</TableCell>

                            <TableCell>
                              <div className="flex gap-2">
                                <button onClick={() => handleEditRole(role)} className="rounded p-1 hover:bg-muted" title="Edit role">
                                  <Edit className="h-4 w-4" />
                                </button>

                                <button
                                  onClick={() => handleDeleteRole(role)}
                                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                                  title="Delete role"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5}>No roles found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <TablePagination currentPage={currentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
              </div>

              {canManageRoleCategories ? (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h2 className="text-base font-semibold text-foreground">Registered Role Category</h2>
                  <p className="mt-1 text-xs text-muted-foreground">All role categories currently registered in the system.</p>

                  <div className="mt-4 overflow-hidden rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Role Category Name</TableHead>
                          <TableHead>Their Description</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={3}>Loading role categories...</TableCell>
                          </TableRow>
                        ) : categoryRows.length ? (
                          categoryRows.map((category) => (
                            <TableRow key={category.id}>
                              <TableCell className="font-medium">{category.name}</TableCell>
                              <TableCell>{category.description || 'No description'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <button onClick={() => handleEditCategory(category)} className="rounded p-1 hover:bg-muted" title="Edit category">
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(category)}
                                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                                    title="Delete category"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3}>No role categories found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'addRole' && canCreateRole ? (
            <AddRole setActiveTab={handleTabChange} onSaved={() => setRefreshKey((prev) => prev + 1)} />
          ) : null}

          {activeTab === 'addCategory' && canManageRoleCategories ? (
            <AddCategory setActiveTab={handleTabChange} onSaved={() => setRefreshKey((prev) => prev + 1)} />
          ) : null}

          <Dialog open={Boolean(editingCategory)} onOpenChange={(open) => !open && setEditingCategory(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Role Category</DialogTitle>
                <DialogDescription>Update the role category name and description.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {modalError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p> : null}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Role Category Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Role category name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Category description"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCategory(null)}>
                  Cancel
                </Button>
                <Button onClick={submitEditCategory} disabled={modalSaving}>
                  {modalSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(editingRole)} onOpenChange={(open) => !open && setEditingRole(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Role</DialogTitle>
                <DialogDescription>Update the role details below.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {modalError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p> : null}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Role Category</label>
                  <select
                    value={editRoleForm.roleCategoryId || NO_CATEGORY_OPTION}
                    onChange={(e) =>
                      setEditRoleForm((prev) => ({
                        ...prev,
                        roleCategoryId: e.target.value === NO_CATEGORY_OPTION ? '' : e.target.value,
                        parentRoleId: '',
                      }))
                    }
                    className="flex h-10 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value={NO_CATEGORY_OPTION}>{NO_CATEGORY_OPTION}</option>
                    {categoryRows.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Role Name</label>
                  <Input
                    value={editRoleForm.roleName}
                    onChange={(e) => setEditRoleForm((prev) => ({ ...prev, roleName: e.target.value }))}
                    placeholder="Role name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Input
                    value={editRoleForm.description}
                    onChange={(e) => setEditRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Role description"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Parent Role</label>
                  <select
                    value={editRoleForm.parentRoleId}
                    onChange={(e) => setEditRoleForm((prev) => ({ ...prev, parentRoleId: e.target.value }))}
                    className="flex h-10 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select parent role</option>
                    {editParentRoleOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.roleName}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={editRoleForm.extraMeasure}
                    onChange={(e) => setEditRoleForm((prev) => ({ ...prev, extraMeasure: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  Extra Measure
                </label>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={editRoleForm.isDistributable}
                    onChange={(e) => setEditRoleForm((prev) => ({ ...prev, isDistributable: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  Is Distributable
                </label>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRole(null)}>
                  Cancel
                </Button>
                <Button onClick={submitEditRole} disabled={modalSaving}>
                  {modalSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(deletingCategory)} onOpenChange={(open) => !open && setDeletingCategory(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Role Category</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <span className="font-semibold">{deletingCategory?.name}</span>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              {modalError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p> : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletingCategory(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDeleteCategory} disabled={modalSaving}>
                  {modalSaving ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(deletingRole)} onOpenChange={(open) => !open && setDeletingRole(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Role</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <span className="font-semibold">{deletingRole?.roleName}</span>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              {modalError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p> : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDeletingRole(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDeleteRole} disabled={modalSaving}>
                  {modalSaving ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default RoleManagement;
