const { User, KPI, KPIType, Role, UserKPI, UserKPIResult, UserRole, UserActivityLog, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getCurrentCycleYear } = require('../utils/kpiCycle');

const getAdminSummary = async (req, res) => {
  try {
    const resolvedYear = req.query.cycleYear || getCurrentCycleYear();

    // 1. Core Stats
    const [totalUsers, totalKpis, totalThemes, totalRoles] = await Promise.all([
      User.count({ where: { IsArchived: false } }),
      KPI.count({ where: { IsArchived: false } }),
      KPIType.count({ where: { ParentKPIID: null, IsArchived: false } }),
      Role.count({ where: { IsArchived: false } }),
    ]);

    // 2. Active KPIs (System-wide assigned KPIs for the selected cycle year)
    const activeAssignments = await UserKPI.count({
      where: {
        CycleYear: resolvedYear,
        IsArchived: false,
      },
    });

    // 3. Online vs Offline Users (Active in last 15 mins)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const onlineUsersCount = await User.count({
      where: { LastActiveAt: { [Op.gte]: fifteenMinsAgo }, IsArchived: false },
    });
    const offlineUsersCount = Math.max(0, totalUsers - onlineUsersCount);

    const userStatusDistribution = [
      { label: 'Online', value: onlineUsersCount, color: 'hsl(142, 71%, 45%)' },
      { label: 'Offline', value: offlineUsersCount, color: 'hsl(215, 16%, 47%)' },
    ];

    // 4. User Activity Trend (Daily Active Users - last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activityLogs = await UserActivityLog.findAll({
      where: { ActivityDate: { [Op.gte]: sevenDaysAgo } },
      attributes: ['ActivityDate', [sequelize.fn('COUNT', sequelize.col('UserId')), 'count']],
      group: ['ActivityDate'],
      order: [['ActivityDate', 'ASC']],
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeUsersTrend = activityLogs.map((log) => {
      const date = new Date(log.ActivityDate);
      return {
        day: dayNames[date.getDay()],
        value: parseInt(log.getDataValue('count'), 10),
      };
    });

    // 5. Login Frequency (Hourly distribution for today)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const loginTrends = await UserActivityLog.findAll({
      where: { ActivityDate: { [Op.gte]: thirtyDaysAgo } },
      attributes: [
        [sequelize.fn('to_char', sequelize.col('ActivityDate'), 'DY'), 'day'],
        [sequelize.fn('COUNT', sequelize.col('UserId')), 'count'],
      ],
      group: [sequelize.fn('to_char', sequelize.col('ActivityDate'), 'DY')],
      order: [[sequelize.literal('MIN("ActivityDate")'), 'ASC']],
    });

    const loginActivityData = loginTrends.map((t) => ({
      name: t.getDataValue('day'),
      value: parseInt(t.getDataValue('count'), 10),
    }));

    // 6. Recent Activities (From AuditLog)
    const timeAgo = (date) => {
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(date).toLocaleDateString();
    };

    const auditLogs = await AuditLog.findAll({
      limit: 1000,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, attributes: ['FirstName', 'FatherName'] }],
    });

    const mappedActivities = auditLogs.map((log) => ({
      user: log.User ? `${log.User.FirstName} ${log.User.FatherName}` : 'System',
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

    // Separate into System vs Admin Activities for the Dashboard columns
    const systemActivities = mappedActivities.filter((a) => a.type === 'system' || a.type === 'auth');
    const adminActivities = mappedActivities.filter((a) => a.type === 'admin');

    // If AuditLog is empty, provide some synthetic data so the dashboard doesn't look empty during first run
    if (mappedActivities.length === 0) {
      // Fallback to synthetic data logic...
      // (Skipping for brevity, the user wants REAL data)
    }

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

module.exports = { getAdminSummary };
