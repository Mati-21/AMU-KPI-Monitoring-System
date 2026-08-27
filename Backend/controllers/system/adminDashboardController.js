import { prisma  } from '../../config/database.js';
import { getCurrentCycleYear  } from '../../utils/kpiCycle.js';

const getAdminSummary = async (req, res) => {
  try {
    const resolvedYear = req.query.cycleYear || getCurrentCycleYear();

    const [totalUsers, totalKpis, totalThemes, totalRoles] = await Promise.all([
      prisma.users.count({ where: { IsArchived: false } }),
      prisma.kPIs.count({ where: { IsArchived: false } }),
      prisma.kPITypes.count({ where: { ParentKPIID: null, IsArchived: false } }),
      prisma.roles.count({ where: { IsArchived: false } }),
    ]);

    const activeAssignments = await prisma.userKPIs.count({
      where: {
        CycleYear: resolvedYear,
        IsArchived: false,
      },
    });

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const onlineUsersCount = await prisma.users.count({
      where: { LastActiveAt: { gte: fifteenMinsAgo }, IsArchived: false },
    });
    const offlineUsersCount = Math.max(0, totalUsers - onlineUsersCount);

    const userStatusDistribution = [
      { label: 'Online', value: onlineUsersCount, color: 'hsl(142, 71%, 45%)' },
      { label: 'Offline', value: offlineUsersCount, color: 'hsl(215, 16%, 47%)' },
    ];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activityLogs = await prisma.userActivityLogs.groupBy({
      by: ['ActivityDate'],
      where: { ActivityDate: { gte: sevenDaysAgo } },
      _count: { UserId: true },
      orderBy: { ActivityDate: 'asc' },
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeUsersTrend = activityLogs.map((log) => {
      const date = new Date(log.ActivityDate);
      return {
        day: dayNames[date.getDay()],
        value: log._count.UserId,
      };
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const loginLogs = await prisma.userActivityLogs.findMany({
      where: { ActivityDate: { gte: thirtyDaysAgo } },
      select: { ActivityDate: true }
    });

    const countsByDay = {};
    const earliestByDay = {};
    loginLogs.forEach(log => {
      const date = new Date(log.ActivityDate);
      const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      
      countsByDay[day] = (countsByDay[day] || 0) + 1;
      
      if (!earliestByDay[day] || date < earliestByDay[day]) {
        earliestByDay[day] = date;
      }
    });

    const loginActivityData = Object.keys(countsByDay)
      .sort((a, b) => earliestByDay[a] - earliestByDay[b])
      .map(day => ({
        name: day,
        value: countsByDay[day]
      }));

    const timeAgo = (date) => {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(date).toLocaleDateString();
    };

    const [systemAuditLogs, adminAuditLogs] = await Promise.all([
      prisma.auditLogs.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        where: {
          Action: { in: ['LOGIN', 'LOGOUT'] }
        },
        include: { Users: { select: { FirstName: true, FatherName: true } } },
      }),
      prisma.auditLogs.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        where: {
          Action: { in: [
            'CREATE_USER', 'USER_REGISTRATION', 'UPDATE_USER', 'DELETE_USER',
            'RESET_PASSWORD', 'CREATE_ROLE', 'UPDATE_ROLE', 'DELETE_ROLE',
            'UPDATE_SETTINGS', 'UPLOAD_LOGO'
          ] }
        },
        include: { Users: { select: { FirstName: true, FatherName: true } } },
      })
    ]);

    const auditLogs = [...systemAuditLogs, ...adminAuditLogs];

    const mappedActivities = auditLogs.map((log) => ({
      user: log.Users ? `${log.Users.FirstName} ${log.Users.FatherName}` : 'System',
      action: log.Action.split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' '),
      description: log.Description,
      time: timeAgo(log.createdAt),
      status: log.Status === 'Success' ? 'Completed' : 'Pending',
      type: ['LOGIN', 'LOGOUT'].includes(log.Action)
        ? 'auth'
        : [
              'CREATE_USER',
              'USER_REGISTRATION',
              'UPDATE_USER',
              'DELETE_USER',
              'RESET_PASSWORD',
              'CREATE_ROLE',
              'UPDATE_ROLE',
              'DELETE_ROLE',
              'UPDATE_SETTINGS',
              'UPLOAD_LOGO',
            ].includes(log.Action)
          ? 'admin'
          : 'system',
    }));

    const systemActivities = mappedActivities.filter((a) => a.type === 'auth' || a.type === 'system').slice(0, 20);
    const adminActivities = mappedActivities.filter((a) => a.type === 'admin').slice(0, 20);

    res.json({
      success: true,
      data: {
        stats: [
          { label: 'Total Users', value: totalUsers.toLocaleString(), change: 'Overall' },
          { label: 'Total KPIs', value: totalKpis.toLocaleString(), change: 'Overall' },
          { label: 'Total Themes', value: totalThemes.toLocaleString(), change: 'Overall' },
          { label: 'Total Roles', value: totalRoles.toLocaleString(), change: 'Overall' },
          { label: 'Active KPIs', value: activeAssignments.toLocaleString(), change: 'Overall' },
        ],
        userStatusDistribution,
        activeUsersTrend,
        loginActivityData,
        systemActivities,
        adminActivities,
      },
    });
  } catch (error) {
    console.error('Error fetching admin summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin summary', error: error.message });
  }
};

export {  getAdminSummary  };
