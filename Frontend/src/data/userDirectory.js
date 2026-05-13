const STORAGE_KEY = 'amu-user-directory';

const defaultUsers = [
  {
    id: 'amu-admin-001',
    firstName: 'Samson',
    fatherName: 'Alemu',
    grandFatherName: '',
    fullName: 'Mr. Samson Alemu',
    initials: 'SA',
    email: 'samson.alemu@amu.edu.et',
    userName: 'samson.alemu',
    phone: '+251 912 345 678',
    role: 'System Administrator',
    roleCategory: 'Management',
    officeLevel: 'Strategic Office',
    department: 'Information Technology',
    institution: 'Arba Minch University',
    location: 'Arba Minch, Ethiopia',
    joinedDate: '2022-01-15',
    status: 'Active',
    bio: 'Experienced system administrator with expertise in KPI management systems, IT infrastructure, and organizational process improvement.',
    overallScore: 87,
    completedKpis: 24,
    pendingKpis: 4,
    overdueKpis: 1,
    kpiTrend: '+8.3%',
    dateOfBirth: '1990-03-12',
    emergencyContact: '+251 911 222 333',
    nationalId: 'ET-1990-XXXX-XXXX',
    address: 'Arba Minch, Gamo Zone, SNNPR, Ethiopia',
    bankAccount: 'CBE - ****4521',
    personalEmail: 'samson.personal@gmail.com',
    kpiBreakdown: [
      { category: 'Teaching', score: 92, weight: 30 },
      { category: 'Research', score: 85, weight: 25 },
      { category: 'Community Service', score: 78, weight: 20 },
      { category: 'Administration', score: 90, weight: 15 },
      { category: 'Professional Dev', score: 88, weight: 10 },
    ],
    recentActivity: [
      { action: 'KPI Report Submitted', date: '2 hours ago', type: 'success' },
      { action: 'Profile Updated', date: '1 day ago', type: 'info' },
      { action: 'Performance Review Completed', date: '3 days ago', type: 'success' },
      { action: 'Training Certificate Uploaded', date: '1 week ago', type: 'info' },
      { action: 'Leave Request Approved', date: '2 weeks ago', type: 'warning' },
    ],
    achievements: [
      { title: 'Top Performer Q3', color: 'text-yellow-500' },
      { title: '100% KPI Completion', color: 'text-green-500' },
      { title: '5 Year Service', color: 'text-blue-500' },
      { title: 'Training Champion', color: 'text-purple-500' },
    ],
  },
  {
    id: 'amu-dean-001',
    firstName: 'Aster',
    fatherName: 'Desta',
    grandFatherName: '',
    fullName: 'Dr. Aster Desta',
    initials: 'AD',
    email: 'aster.desta@amu.edu.et',
    userName: 'aster.desta',
    phone: '+251 913 222 444',
    role: 'Dean',
    roleCategory: 'Academic',
    officeLevel: 'Faculty',
    department: 'College of Engineering',
    institution: 'Arba Minch University',
    location: 'Faculty Campus, Arba Minch',
    joinedDate: '2020-09-08',
    status: 'Active',
    bio: 'Faculty dean responsible for academic oversight, synthetic KPI review, and quarterly office performance reporting.',
    overallScore: 81,
    completedKpis: 18,
    pendingKpis: 3,
    overdueKpis: 0,
    kpiTrend: '+4.9%',
    dateOfBirth: '1982-07-24',
    emergencyContact: '+251 911 555 201',
    nationalId: 'ET-1982-XXXX-XXXX',
    address: 'Arba Minch, Ethiopia',
    bankAccount: 'CBE - ****2211',
    personalEmail: 'aster.desta@gmail.com',
    kpiBreakdown: [],
    recentActivity: [],
    achievements: [],
  },
  {
    id: 'amu-chair-001',
    firstName: 'Kebede',
    fatherName: 'Tadesse',
    grandFatherName: '',
    fullName: 'Mr. Kebede Tadesse',
    initials: 'KT',
    email: 'kebede.tadesse@amu.edu.et',
    userName: 'kebede.tadesse',
    phone: '+251 910 888 102',
    role: 'Chair',
    roleCategory: 'Academic',
    officeLevel: 'Faculty Chair',
    department: 'Computer Science',
    institution: 'Arba Minch University',
    location: 'Main Campus, Arba Minch',
    joinedDate: '2021-02-11',
    status: 'Active',
    bio: 'Department chair overseeing staff distribution of synthetic KPIs and aggregated quarterly reporting.',
    overallScore: 76,
    completedKpis: 14,
    pendingKpis: 5,
    overdueKpis: 2,
    kpiTrend: '+2.1%',
    dateOfBirth: '1986-11-04',
    emergencyContact: '+251 911 555 202',
    nationalId: 'ET-1986-XXXX-XXXX',
    address: 'Arba Minch, Ethiopia',
    bankAccount: 'CBE - ****1135',
    personalEmail: 'kebede.personal@gmail.com',
    kpiBreakdown: [],
    recentActivity: [],
    achievements: [],
  },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeNameParts = (user) => {
  const firstName = user.firstName || user.FirstName || '';
  const fatherName = user.fatherName || user.FatherName || '';
  const grandFatherName = user.grandFatherName || user.GrandFatherName || '';
  const fullName = user.fullName || user.FullName || [firstName, fatherName, grandFatherName].filter(Boolean).join(' ');
  const initials =
    user.initials ||
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0])
      .join('')
      .toUpperCase() ||
    'U';

  return { firstName, fatherName, grandFatherName, fullName, initials };
};

const readUsers = () => {
  if (typeof window === 'undefined') {
    return clone(defaultUsers);
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultUsers));
      return clone(defaultUsers);
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : clone(defaultUsers);
  } catch {
    return clone(defaultUsers);
  }
};

const writeUsers = (users) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

export const getUsers = () => readUsers();

export const getUserById = (id) => readUsers().find((user) => String(user.id) === String(id));

export const upsertUser = (user) => {
  const users = readUsers();
  const normalized = { ...user, ...normalizeNameParts(user) };
  const index = users.findIndex((item) => String(item.id) === String(normalized.id));

  if (index >= 0) {
    users[index] = { ...users[index], ...normalized };
  } else {
    users.unshift(normalized);
  }

  writeUsers(users);
  return normalized;
};

export const createUser = (user) => {
  const normalized = {
    id: user.id || `amu-user-${Date.now()}`,
    status: user.status || 'Active',
    joinedDate: user.joinedDate || new Date().toISOString().slice(0, 10),
    overallScore: user.overallScore ?? 0,
    completedKpis: user.completedKpis ?? 0,
    pendingKpis: user.pendingKpis ?? 0,
    overdueKpis: user.overdueKpis ?? 0,
    kpiTrend: user.kpiTrend || '+0.0%',
    kpiBreakdown: user.kpiBreakdown || [],
    recentActivity: user.recentActivity || [],
    achievements: user.achievements || [],
    ...user,
  };

  return upsertUser(normalized);
};

export const updateUser = (id, changes) => {
  const existing = getUserById(id);
  if (!existing) return null;

  return upsertUser({ ...existing, ...changes, id: existing.id });
};

export const deleteUser = (id) => {
  const users = readUsers();
  const existing = users.find((user) => String(user.id) === String(id));
  if (!existing) {
    return { ok: false, message: 'User not found.' };
  }

  const nextUsers = users.filter((user) => String(user.id) !== String(id));
  writeUsers(nextUsers);
  return { ok: true, message: 'User deleted successfully.' };
};

export const normalizeProfileUser = (user) => {
  if (!user) return null;

  const { firstName, fatherName, grandFatherName, fullName, initials } = normalizeNameParts(user);

  return {
    id: user.id || user.Id,
    firstName,
    fatherName,
    grandFatherName,
    fullName,
    initials,
    email: user.email || user.Email || '',
    userName: user.userName || user.UserName || '',
    phone: user.phone || user.Phone || '',
    role: user.role || 'User',
    roleCategory: user.roleCategory || 'Administrative',
    officeLevel: user.officeLevel || 'University',
    department: user.department || 'Information Technology',
    institution: user.institution || 'Arba Minch University',
    location: user.location || 'Arba Minch, Ethiopia',
    joinedDate: user.joinedDate || user.CreatedAt || new Date().toISOString().slice(0, 10),
    status: user.status || 'Active',
    bio: user.bio || 'No bio available yet.',
    overallScore: user.overallScore ?? 0,
    completedKpis: user.completedKpis ?? 0,
    pendingKpis: user.pendingKpis ?? 0,
    overdueKpis: user.overdueKpis ?? 0,
    kpiTrend: user.kpiTrend || '+0.0%',
    dateOfBirth: user.dateOfBirth || '',
    emergencyContact: user.emergencyContact || '',
    nationalId: user.nationalId || '',
    address: user.address || '',
    bankAccount: user.bankAccount || '',
    personalEmail: user.personalEmail || '',
    profilePicture: user.profilePicture || user.ProfilePicture || '',
    kpiBreakdown: user.kpiBreakdown || [],
    recentActivity: user.recentActivity || [],
    achievements: user.achievements || [],
  };
};

export const getVisibleUsers = () => getUsers().map(normalizeProfileUser);
