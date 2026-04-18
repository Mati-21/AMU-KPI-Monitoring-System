import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useParams } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  Award,
  TrendingUp,
  BarChart3,
  Shield,
  Clock,
  Star,
  Target,
  BookOpen,
  Briefcase,
  Lock,
  Edit3,
  Save,
  X,
  EyeOff,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/ProfileButtonTab';
import { Badge } from '../../Components/UI/Badge';
import { Input } from '../../Components/UI/Input';
import Button from '../../Components/UI/Button';
import { setUser } from '../../Features/authSlice';
import { getUserById, normalizeProfileUser, updateUser } from '../../data/userDirectory';
import { api } from '../../api/axios';
import { useNotification } from '../../Context/NotificationContext';

const DEFAULT_SELF_ID = 'amu-admin-001';

const UserProfile = () => {
  const { userId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const { notify } = useNotification();

  const isAdmin = (authUser?.role || '').toLowerCase().includes('admin');
  const isSelf = !userId || String(userId) === String(authUser?.id || authUser?.Id || DEFAULT_SELF_ID);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fallbackProfile = normalizeProfileUser(getUserById(DEFAULT_SELF_ID) || authUser || getUserById(DEFAULT_SELF_ID));

    const loadProfile = async () => {
      if (!userId) {
        if (mounted) {
          setProfile(normalizeProfileUser(authUser || getUserById(DEFAULT_SELF_ID) || fallbackProfile));
          setProfileLoading(false);
        }
        return;
      }

      setProfileLoading(true);
      try {
        const response = await api.get(`/users/${userId}`, { params: { t: Date.now() } });
        if (!mounted) return;

        const record = response.data?.data;
        const activeRole = record?.UserRoles?.[0]?.Role;
        const normalized = normalizeProfileUser({
          id: record?.Id,
          firstName: record?.FirstName || '',
          fatherName: record?.FatherName || '',
          grandFatherName: record?.GrandFatherName || '',
          fullName: [record?.FirstName, record?.FatherName, record?.GrandFatherName].filter(Boolean).join(' '),
          email: record?.Email || '',
          userName: record?.UserName || '',
          phone: record?.Phone || '',
          role: activeRole?.RoleName || 'Unassigned',
          roleCategory: activeRole?.RoleCategory?.CategoryName || 'No Category',
          officeLevel: activeRole?.RoleName || '-',
          joinedDate: record?.CreatedAt ? new Date(record.CreatedAt).toISOString().slice(0, 10) : '',
          status: 'Active',
        });

        setProfile(normalized);
      } catch (loadErr) {
        if (!mounted) return;
        notify(loadErr?.response?.data?.message || 'Failed to load user profile.', 'error');
        setProfile(normalizeProfileUser(authUser || getUserById(DEFAULT_SELF_ID) || fallbackProfile));
      } finally {
        if (mounted) setProfileLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [userId, authUser, notify]);

  const canViewPersonal = isSelf || isAdmin;
  const canEdit = isSelf || isAdmin;
  const [draft, setDraft] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(profile);
    const shouldStartEditing = Boolean(location.state?.startEditing) && canEdit;
    setEditing(shouldStartEditing);
    setNotice('');
  }, [profile, location.state, canEdit]);

  if (profileLoading || !profile) {
    return <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">Profile not available.</div>;
  }

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const activeDraft = draft || profile;
    const targetUserId = userId || profile.id;
    const resetPassword = String(activeDraft?.resetPassword || '').trim();
    const confirmResetPassword = String(activeDraft?.confirmResetPassword || '').trim();

    if (isAdmin && !isSelf && (resetPassword || confirmResetPassword)) {
      if (resetPassword.length < 6) {
        notify('New password must be at least 6 characters.', 'warning');
        return;
      }

      if (resetPassword !== confirmResetPassword) {
        notify('New password and confirm password do not match.', 'warning');
        return;
      }
    }

    setSaving(true);
    try {
      const updated = updateUser(profile.id, {
        firstName: activeDraft.firstName,
        fatherName: activeDraft.fatherName,
        grandFatherName: activeDraft.grandFatherName,
        fullName: [activeDraft.firstName, activeDraft.fatherName, activeDraft.grandFatherName].filter(Boolean).join(' '),
        email: activeDraft.email,
        phone: activeDraft.phone,
        department: activeDraft.department,
        location: activeDraft.location,
        bio: activeDraft.bio,
        personalEmail: activeDraft.personalEmail,
        emergencyContact: activeDraft.emergencyContact,
        address: activeDraft.address,
        bankAccount: activeDraft.bankAccount,
        dateOfBirth: activeDraft.dateOfBirth,
        nationalId: activeDraft.nationalId,
      });

      if (isAdmin && !isSelf && resetPassword) {
        await api.put(`/users/${targetUserId}/reset-password`, { password: resetPassword });
        notify('Password reset successfully.', 'success');
      }

      if (updated && String(updated.id) === String(authUser?.id || authUser?.Id)) {
        dispatch(setUser(updated));
      }

      setDraft(
        normalizeProfileUser({
          ...(updated || profile),
          resetPassword: '',
          confirmResetPassword: '',
        })
      );
      setEditing(false);
      setNotice('Profile saved successfully.');
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(profile);
    setEditing(false);
    setNotice('Changes discarded.');
  };

  const display = editing ? draft || profile : profile;
  const editingDraft = draft || profile;

  if (!display) {
    return <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">Profile not available.</div>;
  }

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <Card className="overflow-hidden border-border bg-card shadow-sm">
            <div className="h-32 bg-linear-to-r from-primary/20 via-primary/10 to-accent/20" />
            <CardContent className="relative pb-6 pt-0 px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end -mt-12">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-primary/10 text-2xl font-bold text-primary shadow-lg">
                  {display.initials}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">{display.fullName}</h1>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                      {display.status}
                    </Badge>
                    {!canViewPersonal ? (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 text-xs">
                        Restricted View
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{display.role}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {display.department}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {display.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined {display.joinedDate}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{display.overallScore}%</p>
                  <p className="text-xs text-muted-foreground">Overall Performance</p>
                  <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {display.kpiTrend}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {notice ? <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div> : null}

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              {canViewPersonal && <TabsTrigger value="personal">Personal Info</TabsTrigger>}
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="border-border bg-card lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4 text-primary" />
                      About
                    </CardTitle>
                    {canEdit ? (
                      editing ? (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2">
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSave} className="gap-2" disabled={saving}>
                            <Save className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-2">
                          <Edit3 className="h-4 w-4" />
                          Edit Profile
                        </Button>
                      )
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    {editing ? (
                      <div className="space-y-4">
                        <Input value={editingDraft.bio || ''} onChange={(e) => handleChange('bio', e.target.value)} placeholder="Short bio" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <EditableInfo icon={Mail} label="Email" value={editingDraft.email} onChange={(val) => handleChange('email', val)} />
                          <EditableInfo icon={Phone} label="Phone" value={editingDraft.phone} onChange={(val) => handleChange('phone', val)} />
                          <EditableInfo icon={Shield} label="Role" value={editingDraft.role} onChange={(val) => handleChange('role', val)} disabled />
                          <EditableInfo
                            icon={Building2}
                            label="Department"
                            value={editingDraft.department}
                            onChange={(val) => handleChange('department', val)}
                          />
                        </div>
                        {isAdmin && !isSelf ? (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border border-border p-4">
                            <EditableInfo
                              icon={Lock}
                              label="Reset Password"
                              value={editingDraft.resetPassword || ''}
                              onChange={(val) => handleChange('resetPassword', val)}
                              type="password"
                            />
                            <EditableInfo
                              icon={Lock}
                              label="Confirm Password"
                              value={editingDraft.confirmResetPassword || ''}
                              onChange={(val) => handleChange('confirmResetPassword', val)}
                              type="password"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="mb-6 text-sm text-muted-foreground">{display.bio}</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <InfoRow icon={Mail} label="Email" value={display.email} />
                          <InfoRow icon={Phone} label="Phone" value={display.phone} />
                          <InfoRow icon={Shield} label="Role" value={display.role} />
                          <InfoRow icon={Building2} label="Department" value={display.department} />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-4 w-4 text-primary" />
                      Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(display.achievements || []).length ? (
                      display.achievements.map((achievement, index) => (
                        <div key={index} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                          <Star className={`h-5 w-5 ${achievement.color || 'text-primary'}`} />
                          <span className="text-sm font-medium text-foreground">{achievement.title}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                        <EyeOff className="h-4 w-4" />
                        No achievements recorded yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4 lg:col-span-3 sm:grid-cols-4">
                  <StatMini icon={Target} label="Completed KPIs" value={display.completedKpis} color="text-green-500" />
                  <StatMini icon={Clock} label="Pending KPIs" value={display.pendingKpis} color="text-yellow-500" />
                  <StatMini icon={BarChart3} label="Overdue KPIs" value={display.overdueKpis} color="text-red-500" />
                  <StatMini icon={TrendingUp} label="Performance Trend" value={display.kpiTrend} color="text-primary" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader>
                  <CardTitle>Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(display.kpiBreakdown || []).length ? (
                      display.kpiBreakdown.map((kpi, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{kpi.category}</span>
                            <span>{kpi.score}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${kpi.score}%` }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No KPI breakdown has been configured for this user yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {canViewPersonal && (
              <TabsContent value="personal">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="h-4 w-4 text-primary" />
                      Personal Information
                      <Badge variant="outline" className="ml-2 border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-700">
                        Private
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <InfoRow icon={Calendar} label="Date of Birth" value={display.dateOfBirth || 'Not provided'} />
                      <InfoRow icon={Phone} label="Emergency Contact" value={display.emergencyContact || 'Not provided'} />
                      <InfoRow icon={Shield} label="National ID" value={display.nationalId || 'Not provided'} />
                      <InfoRow icon={MapPin} label="Full Address" value={display.address || 'Not provided'} />
                      <InfoRow icon={Briefcase} label="Bank Account" value={display.bankAccount || 'Not provided'} />
                      <InfoRow icon={Mail} label="Personal Email" value={display.personalEmail || 'Not provided'} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="activity">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-primary" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {(display.recentActivity || []).length ? (
                      display.recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${activity.type === 'success' ? 'bg-green-500' : activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">{activity.date}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent activity is available for this profile.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="rounded-lg bg-muted p-2">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);

const EditableInfo = ({ icon: Icon, label, value, onChange, disabled = false, type = 'text' }) => (
  <div className="flex items-start gap-3 rounded-lg border border-border p-3">
    <div className="rounded-lg bg-muted p-2">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div className="flex-1 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  </div>
);

const StatMini = ({ icon: Icon, label, value, color }) => (
  <Card className="border-border bg-card">
    <CardContent className="flex items-center gap-3 p-4">
      <div className="rounded-lg bg-muted p-2">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

export default UserProfile;
