const { Op, Sequelize } = require('sequelize');
const { Message, User, Role, UserRole } = require('../models');
const { emitToUser } = require('../realtime/socket');

/**
 * Search for users to start a conversation
 */
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ success: true, data: [] });

    const lowerQuery = `%${query.toLowerCase()}%`;

    const users = await User.findAll({
      where: {
        IsArchived: false,
        Id: { [Op.ne]: req.user.Id },
        [Op.or]: [
          Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('UserName')), 'LIKE', lowerQuery),
          Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('Email')), 'LIKE', lowerQuery),
          Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('FirstName')), 'LIKE', lowerQuery),
          Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('FatherName')), 'LIKE', lowerQuery)
        ]
      },
      attributes: ['Id', 'FirstName', 'FatherName', 'Email', 'UserName', 'ProfilePicture'],
      include: [{
        model: UserRole,
        attributes: ['RoleId'],
        include: [{
          model: Role,
          attributes: ['RoleName']
        }]
      }],
      limit: 10
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Send a message to another user
 */
const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, fileUrl, fileName, fileType, attachments } = req.body;
    const senderId = req.user.Id;

    if (!receiverId || (!content && !fileUrl && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ message: 'Receiver and (content or file) are required' });
    }

    const message = await Message.create({
      SenderId: senderId,
      ReceiverId: receiverId,
      Content: content,
      FileUrl: fileUrl,
      FileName: fileName,
      FileType: fileType,
      Attachments: attachments
    });

    const fullMessage = await Message.findByPk(message.Id, {
      include: [
        { model: User, as: 'Sender', attributes: ['FirstName', 'FatherName'] }
      ]
    });

    // Emit real-time notification via socket
    emitToUser(receiverId, 'messages:new', fullMessage);

    res.json({ success: true, data: fullMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Handle file upload for messages
 */
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

/**
 * Get message history with a specific user
 */
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.Id;

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { SenderId: currentUserId, ReceiverId: userId },
          { SenderId: userId, ReceiverId: currentUserId }
        ]
      },
      order: [['createdAt', 'ASC']],
      include: [
        { model: User, as: 'Sender', attributes: ['Id', 'FirstName', 'FatherName'] }
      ]
    });

    // Mark messages as read
    const [updatedCount] = await Message.update(
      { IsRead: true },
      { where: { SenderId: userId, ReceiverId: currentUserId, IsRead: false } }
    );

    if (updatedCount > 0) {
      // Notify the sender that their messages were read
      emitToUser(userId, 'messages:read', {
        readerId: currentUserId,
        readAt: new Date()
      });
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Get list of recent conversations
 */
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.Id;

    // This is a simplified query to get unique users we've chatted with
    const sent = await Message.findAll({
      where: { SenderId: currentUserId },
      attributes: ['ReceiverId'],
      group: ['ReceiverId']
    });

    const received = await Message.findAll({
      where: { ReceiverId: currentUserId },
      attributes: ['SenderId'],
      group: ['SenderId']
    });

    const userIds = [...new Set([
      ...sent.map(m => m.ReceiverId),
      ...received.map(m => m.SenderId)
    ])];

    const conversations = await User.findAll({
      where: { Id: { [Op.in]: userIds } },
      attributes: ['Id', 'FirstName', 'FatherName', 'Email', 'UserName', 'ProfilePicture'],
      include: [{
        model: UserRole,
        attributes: ['RoleId'],
        include: [{
          model: Role,
          attributes: ['RoleName']
        }]
      }]
    });

    // For each conversation, get the last message and unread count
    const data = await Promise.all(conversations.map(async (user) => {
      const lastMsg = await Message.findOne({
        where: {
          [Op.or]: [
            { SenderId: currentUserId, ReceiverId: user.Id },
            { SenderId: user.Id, ReceiverId: currentUserId }
          ]
        },
        order: [['createdAt', 'DESC']]
      });

      const unreadCount = await Message.count({
        where: {
          SenderId: user.Id,
          ReceiverId: currentUserId,
          IsRead: false
        }
      });

      return {
        ...user.toJSON(),
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

/**
 * Get count of unread messages for the current user
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Message.count({
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

/**
 * Mark all messages from a specific user as read
 */
const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.Id;

    const [updatedCount] = await Message.update(
      { IsRead: true },
      { where: { SenderId: userId, ReceiverId: currentUserId, IsRead: false } }
    );

    if (updatedCount > 0) {
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

/**
 * Delete a message for everyone
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.Id;

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can delete for everyone
    if (message.SenderId !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    const receiverId = message.ReceiverId;
    await message.destroy();

    // Notify the receiver
    emitToUser(receiverId, 'messages:delete', { messageId });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Delete a specific attachment from a message
 */
const deleteAttachment = async (req, res) => {
  try {
    const { messageId, attachmentUrl } = req.body;
    const currentUserId = req.user.Id;

    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.SenderId !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (message.Attachments) {
      const updatedAttachments = message.Attachments.filter(a => a.fileUrl !== attachmentUrl);
      
      if (updatedAttachments.length === 0 && !message.Content) {
        await message.destroy();
        emitToUser(message.ReceiverId, 'messages:delete', { messageId });
      } else {
        message.Attachments = updatedAttachments;
        await message.save();
        emitToUser(message.ReceiverId, 'messages:attachment_delete', { messageId, attachmentUrl });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
