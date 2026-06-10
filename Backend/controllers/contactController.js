const { ContactMessage } = require('../models');

// @desc    Submit a contact message (public)
// @route   POST /api/contact-messages
const createContactMessage = async (req, res) => {
  try {
    const { username, email, message, subject } = req.body;

    if (!username || !email || !message) {
      return res.status(400).json({ message: 'Username, email, and message are required.' });
    }

    const newMessage = await ContactMessage.create({
      Username: username,
      Email: email,
      Message: message,
      Subject: subject || `Inquiry from ${username}`,
      Status: 'Unread',
    });

    res.status(201).json({
      message: 'Message sent successfully! We will get back to you soon.',
      contactMessage: newMessage,
    });
  } catch (error) {
    console.error('[contactController] createContactMessage error:', error);
    res.status(500).json({ message: 'Server error. Failed to send message.' });
  }
};

// @desc    Get all contact messages (Admin only)
// @route   GET /api/contact-messages
const getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.findAll({
      order: [['createdAt', 'DESC']],
    });

    const formattedMessages = messages.map((m) => {
      const parts = (m.Username || '').split('.');
      const initials = parts
        .map((p) => (p[0] || '').toUpperCase())
        .join('')
        .slice(0, 2) || (m.Username || 'U').slice(0, 2).toUpperCase();

      return {
        id: m.Id,
        sender: m.Username,
        email: m.Email,
        subject: m.Subject || 'General Inquiry',
        content: m.Message,
        date: m.createdAt
          ? new Date(m.createdAt).toISOString().replace('T', ' ').substring(0, 16)
          : '',
        status: m.Status,
        initials,
      };
    });

    res.json(formattedMessages);
  } catch (error) {
    console.error('[contactController] getContactMessages error:', error);
    res.status(500).json({ message: 'Server error. Failed to retrieve messages.' });
  }
};

// @desc    Update contact message status (Admin only)
// @route   PATCH /api/contact-messages/:id/status
const updateContactMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['Unread', 'Read', 'Resolved', 'Archived'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const msg = await ContactMessage.findByPk(id);
    if (!msg) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }

    msg.Status = status;
    await msg.save();

    res.json({ message: `Message marked as ${status}.`, contactMessage: msg });
  } catch (error) {
    console.error('[contactController] updateContactMessageStatus error:', error);
    res.status(500).json({ message: 'Server error. Failed to update message.' });
  }
};

module.exports = {
  createContactMessage,
  getContactMessages,
  updateContactMessageStatus,
};
