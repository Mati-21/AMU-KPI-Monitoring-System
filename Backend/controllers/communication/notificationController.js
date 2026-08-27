import { prisma  } from '../../config/database.js';

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.Id;
    const { unread, type, priority, limit, offset } = req.query;

    const where = {
      RecipientUserId: userId,
      IsArchived: false,
    };

    if (String(unread).toLowerCase() === 'true') {
      where.IsRead = false;
    }

    if (type) {
      where.Type = String(type);
    }

    if (priority) {
      where.Priority = String(priority);
    }

    const pageSize = Math.min(200, Math.max(1, toInt(limit, 50)));
    const pageOffset = Math.max(0, toInt(offset, 0));

    const total = await prisma.notifications.count({ where });
    const rows = await prisma.notifications.findMany({
      where,
      orderBy: { CreatedAt: 'desc' },
      take: pageSize,
      skip: pageOffset,
    });

    res.json({
      success: true,
      data: rows,
      meta: {
        total,
        limit: pageSize,
        offset: pageOffset,
      },
    });
  } catch (error) {
    console.error('Get my notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.Id;

    const count = await prisma.notifications.count({
      where: {
        RecipientUserId: userId,
        IsRead: false,
        IsArchived: false,
      },
    });

    res.json({ success: true, data: { unread: count } });
  } catch (error) {
    console.error('Get my unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.Id;
    const { id } = req.params;

    const notification = await prisma.notifications.findUnique({ where: { Id: id } });
    if (!notification || notification.IsArchived) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (String(notification.RecipientUserId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    if (!notification.IsRead) {
      await prisma.notifications.update({
        where: { Id: id },
        data: { IsRead: true, ReadAt: new Date() }
      });
      notification.IsRead = true;
      notification.ReadAt = new Date();
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAllRead = async (req, res) => {
  try {
    const userId = req.user?.Id;

    const updated = await prisma.notifications.updateMany({
      where: {
        RecipientUserId: userId,
        IsRead: false,
        IsArchived: false,
      },
      data: { IsRead: true, ReadAt: new Date() }
    });

    res.json({ success: true, data: { updated: updated.count } });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const archiveNotification = async (req, res) => {
  try {
    const userId = req.user?.Id;
    const { id } = req.params;

    const notification = await prisma.notifications.findUnique({ where: { Id: id } });
    if (!notification || notification.IsArchived) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (String(notification.RecipientUserId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    await prisma.notifications.update({
      where: { Id: id },
      data: { IsArchived: true }
    });
    res.json({ success: true, message: 'Notification archived.' });
  } catch (error) {
    console.error('Archive notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
  markAllRead,
  archiveNotification,
 };
