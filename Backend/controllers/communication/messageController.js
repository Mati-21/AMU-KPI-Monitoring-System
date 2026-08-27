import { prisma  } from '../../config/database.js';
import { emitToUser  } from '../../realtime/socket.js';

const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ success: true, data: [] });

    const lowerQuery = query.toLowerCase();

    const users = await prisma.users.findMany({
      where: {
        IsArchived: false,
        Id: { not: req.user.Id },
        OR: [
          { UserName: { contains: lowerQuery, mode: 'insensitive' } },
          { Email: { contains: lowerQuery, mode: 'insensitive' } },
          { FirstName: { contains: lowerQuery, mode: 'insensitive' } },
          { FatherName: { contains: lowerQuery, mode: 'insensitive' } }
        ]
      },
      select: {
        Id: true, FirstName: true, FatherName: true, Email: true, UserName: true, ProfilePicture: true,
        UserRoles: {
          select: {
            RoleId: true,
            Roles: { select: { RoleName: true } }
          }
        }
      },
      take: 10
    });

    const mappedUsers = users.map(u => ({
      ...u,
      UserRoles: u.UserRoles.map(ur => ({
        ...ur,
        Role: ur.Roles,
        Roles: undefined
      }))
    }));

    res.json({ success: true, data: mappedUsers });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, fileUrl, fileName, fileType, attachments } = req.body;
    const senderId = req.user.Id;

    if (!receiverId || (!content && !fileUrl && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ message: 'Receiver and (content or file) are required' });
    }

    const message = await prisma.messages.create({
      data: {
        SenderId: senderId,
        ReceiverId: receiverId,
        Content: content,
        FileUrl: fileUrl,
        FileName: fileName,
        FileType: fileType,
        Attachments: attachments || null
      }
    });

    const fullMessage = await prisma.messages.findUnique({
      where: { Id: message.Id },
      include: {
        Users_Messages_SenderIdToUsers: { select: { FirstName: true, FatherName: true } }
      }
    });

    const mappedMsg = {
      ...fullMessage,
      Sender: fullMessage.Users_Messages_SenderIdToUsers,
      Users_Messages_SenderIdToUsers: undefined
    };

    emitToUser(receiverId, 'messages:new', mappedMsg);

    res.json({ success: true, data: mappedMsg });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = req.file.path;
    res.json({
      success: true,
      data: {
        fileUrl,
        fileName: req.file.originalname,
        fileType: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.Id;

    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          { SenderId: currentUserId, ReceiverId: userId },
          { SenderId: userId, ReceiverId: currentUserId }
        ]
      },
      orderBy: { createdAt: 'asc' },
      include: {
        Users_Messages_SenderIdToUsers: { select: { Id: true, FirstName: true, FatherName: true } }
      }
    });

    const mappedMessages = messages.map(m => ({
      ...m,
      Sender: m.Users_Messages_SenderIdToUsers,
      Users_Messages_SenderIdToUsers: undefined
    }));

    const updated = await prisma.messages.updateMany({
      where: { SenderId: userId, ReceiverId: currentUserId, IsRead: false },
      data: { IsRead: true }
    });

    if (updated.count > 0) {
      emitToUser(userId, 'messages:read', {
        readerId: currentUserId,
        readAt: new Date()
      });
    }

    res.json({ success: true, data: mappedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.Id;

    const sent = await prisma.messages.groupBy({
      by: ['ReceiverId'],
      where: { SenderId: currentUserId }
    });

    const received = await prisma.messages.groupBy({
      by: ['SenderId'],
      where: { ReceiverId: currentUserId }
    });

    const userIds = [...new Set([
      ...sent.map(m => m.ReceiverId),
      ...received.map(m => m.SenderId)
    ])];

    const conversations = await prisma.users.findMany({
      where: { Id: { in: userIds } },
      select: {
        Id: true, FirstName: true, FatherName: true, Email: true, UserName: true, ProfilePicture: true,
        UserRoles: {
          select: {
            RoleId: true,
            Roles: { select: { RoleName: true } }
          }
        }
      }
    });

    const data = await Promise.all(conversations.map(async (user) => {
      const lastMsg = await prisma.messages.findFirst({
        where: {
          OR: [
            { SenderId: currentUserId, ReceiverId: user.Id },
            { SenderId: user.Id, ReceiverId: currentUserId }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      const unreadCount = await prisma.messages.count({
        where: {
          SenderId: user.Id,
          ReceiverId: currentUserId,
          IsRead: false
        }
      });

      return {
        ...user,
        UserRoles: user.UserRoles.map(ur => ({
          ...ur,
          Role: ur.Roles,
          Roles: undefined
        })),
        lastMessage: lastMsg,
        unreadCount
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.messages.count({
      where: {
        ReceiverId: req.user.Id,
        IsRead: false
      }
    });
    res.json({ success: true, data: { unread: count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.Id;

    const updated = await prisma.messages.updateMany({
      where: { SenderId: userId, ReceiverId: currentUserId, IsRead: false },
      data: { IsRead: true }
    });

    if (updated.count > 0) {
      emitToUser(userId, 'messages:read', {
        readerId: currentUserId,
        readAt: new Date()
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.Id;

    const message = await prisma.messages.findUnique({ where: { Id: messageId } });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.SenderId !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    const receiverId = message.ReceiverId;
    await prisma.messages.delete({ where: { Id: messageId } });

    emitToUser(receiverId, 'messages:delete', { messageId });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteAttachment = async (req, res) => {
  try {
    const { messageId, attachmentUrl } = req.body;
    const currentUserId = req.user.Id;

    const message = await prisma.messages.findUnique({ where: { Id: messageId } });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.SenderId !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (message.Attachments) {
      const attachments = Array.isArray(message.Attachments) ? message.Attachments : [];
      const updatedAttachments = attachments.filter(a => a.fileUrl !== attachmentUrl);
      
      if (updatedAttachments.length === 0 && !message.Content) {
        await prisma.messages.delete({ where: { Id: messageId } });
        emitToUser(message.ReceiverId, 'messages:delete', { messageId });
      } else {
        await prisma.messages.update({
          where: { Id: messageId },
          data: { Attachments: updatedAttachments }
        });
        emitToUser(message.ReceiverId, 'messages:attachment_delete', { messageId, attachmentUrl });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  searchUsers,
  sendMessage,
  getMessages,
  getConversations,
  getUnreadCount,
  markAsRead,
  uploadFile,
  deleteMessage,
  deleteAttachment
 };
