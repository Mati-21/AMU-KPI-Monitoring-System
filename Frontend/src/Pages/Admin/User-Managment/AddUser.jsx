import { useEffect, useMemo, useState } from 'react';
import { Building2, Mail, Shield, User, UserPlus } from 'lucide-react';

import { Input } from '../../../Components/UI/Input';
import CustomSelect from '../../../Components/UI/CustomSelect';
import Button from '../../../Components/UI/Button';
import { api } from '../../../api/axios';

const officeLevels = ['Strategic Office', 'Vice President', 'Higher Institution', 'Faculty', 'Chair Office', 'Staff'];
const NO_CATEGORY_OPTION = 'No Category (Top Level)';

const emptyForm = {
  roleCategory: '',
  role: '',
  officeLevel: 'Staff',
  firstName: '',
  fatherName: '',
  grandFatherName: '',
  email: '',
  phone: '',
  username: '',
  password: '',
  department: '',
  institution: 'Arba Minch University',
  location: '',
  personalEmail: '',
};

function AddUser({ setActiveTab }) {
  const [formData, setFormData] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError('');

      try {
        const [categoriesRes, rolesRes] = await Promise.all([
          api.get('/role-categories', { params: { t: Date.now() } }),
          api.get('/roles', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;
        setCategories(categoriesRes.data?.data || []);
        setRoles(rolesRes.data?.data || []);
      } catch (catalogErr) {
        if (!mounted) return;
        setCatalogError(catalogErr?.response?.data?.message || 'Failed to load role catalog from database.');
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    };

    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const roleCategories = useMemo(() => {
    const categoryNames = categories.map((category) => category.CategoryName).filter(Boolean);
    const hasUncategorizedRoles = roles.some((role) => !role?.RoleCategory?.CategoryName);
    return hasUncategorizedRoles ? [...categoryNames, NO_CATEGORY_OPTION] : categoryNames;
  }, [categories, roles]);

  const availableRoles = useMemo(() => {
    if (!formData.roleCategory) return [];
    return roles
      .filter((role) => {
        const categoryName = role?.RoleCategory?.CategoryName || NO_CATEGORY_OPTION;
        return categoryName === formData.roleCategory;
      })
      .map((role) => role.RoleName);
  }, [formData.roleCategory, roles]);

  const selectedRoleRecord = useMemo(
    () =>
      roles.find((role) => {
        const categoryName = role?.RoleCategory?.CategoryName || NO_CATEGORY_OPTION;
        return role.RoleName === formData.role && categoryName === formData.roleCategory;
      }),
    [roles, formData.role, formData.roleCategory]
  );

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value, ...(field === 'roleCategory' ? { role: '' } : {}) }));
  };

  const handleSave = async () => {
    setError('');
    setMessage('');

    if (
      !formData.firstName ||
      !formData.fatherName ||
      !formData.email ||
      !formData.username ||
      !formData.phone ||
      !formData.password ||
      !formData.role ||
      !formData.roleCategory
    ) {
      setError('Please fill in all required fields including password.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!selectedRoleRecord?.Id) {
      setError('Selected role is not available in the database. Please refresh and try again.');
      return;
    }

    setSaving(true);

    try {
      const registerPayload = {
        FirstName: formData.firstName,
        FatherName: formData.fatherName,
        GrandFatherName: formData.grandFatherName || '-',
        Email: formData.email,
        UserName: formData.username,
        Phone: formData.phone,
        password: formData.password,
      };

      const registerRes = await api.post('/auth/register', registerPayload);
      const createdDbUser = registerRes.data?.user;

      await api.post('/user-roles', {
        UserId: createdDbUser?.Id,
        RoleId: selectedRoleRecord.Id,
      });

      const fullName = [createdDbUser?.FirstName, createdDbUser?.FatherName, createdDbUser?.GrandFatherName].filter(Boolean).join(' ');
      setMessage(`User ${fullName || formData.firstName} has been created in the database.`);
      setFormData(emptyForm);
      setActiveTab('list');
    } catch (saveErr) {
      setError(saveErr?.response?.data?.message || 'Failed to create user in the database.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setError('');
    setMessage('');
    setActiveTab('list');
  };

  return (
    <div className="mx-auto rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Register New User</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create a user profile with the role and office hierarchy needed for KPI distribution.</p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Admin only</div>
      </div>

      {error ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
      {catalogError ? <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{catalogError}</div> : null}

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            Role Assignment
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="Role Category" required>
              <CustomSelect
                options={roleCategories}
                value={formData.roleCategory}
                onChange={(val) => handleFormChange('roleCategory', val)}
                placeholder={catalogLoading ? 'Loading categories from database...' : 'Select category'}
              />
            </Field>
            <Field label="Role" required>
              <CustomSelect
                options={availableRoles}
                value={formData.role}
                onChange={(val) => handleFormChange('role', val)}
                placeholder={formData.roleCategory ? 'Select role' : 'Select category first'}
              />
            </Field>
            <Field label="Office Level">
              <CustomSelect
                options={officeLevels}
                value={formData.officeLevel}
                onChange={(val) => handleFormChange('officeLevel', val)}
                placeholder="Select level"
              />
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-emerald-600" />
            Personal Identity
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="First Name" required>
              <Input value={formData.firstName} placeholder="First name" onChange={(e) => handleFormChange('firstName', e.target.value)} />
            </Field>
            <Field label="Father Name" required>
              <Input value={formData.fatherName} placeholder="Father name" onChange={(e) => handleFormChange('fatherName', e.target.value)} />
            </Field>
            <Field label="Grandfather Name">
              <Input
                value={formData.grandFatherName}
                placeholder="Grandfather name"
                onChange={(e) => handleFormChange('grandFatherName', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Mail className="h-4 w-4 text-violet-600" />
            Account Information
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Email Address" required>
              <Input type="email" value={formData.email} placeholder="user@amu.edu.et" onChange={(e) => handleFormChange('email', e.target.value)} />
            </Field>
            <Field label="Username" required>
              <Input value={formData.username} placeholder="username" onChange={(e) => handleFormChange('username', e.target.value)} />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                value={formData.password}
                placeholder="Create password"
                onChange={(e) => handleFormChange('password', e.target.value)}
              />
            </Field>
            <Field label="Phone Number" required>
              <Input value={formData.phone} placeholder="+251 ..." onChange={(e) => handleFormChange('phone', e.target.value)} />
            </Field>
            <Field label="Personal Email">
              <Input
                value={formData.personalEmail}
                placeholder="personal@email.com"
                onChange={(e) => handleFormChange('personalEmail', e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-blue-600" />
            Work Assignment
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field label="Department">
              <Input value={formData.department} placeholder="Department / unit" onChange={(e) => handleFormChange('department', e.target.value)} />
            </Field>
            <Field label="Institution">
              <Input value={formData.institution} placeholder="Institution" onChange={(e) => handleFormChange('institution', e.target.value)} />
            </Field>
            <Field label="Location">
              <Input value={formData.location} placeholder="Campus or location" onChange={(e) => handleFormChange('location', e.target.value)} />
            </Field>
          </div>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap justify-end gap-3 border-t border-border pt-6">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="gap-2" disabled={saving || catalogLoading}>
          <UserPlus className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save User'}
        </Button>
      </div>
    </div>
  );
}

const Field = ({ label, required = false, children }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-foreground">
      {label}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
    {children}
  </div>
);

export default AddUser;
