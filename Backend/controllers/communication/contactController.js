import { prisma  } from '../../config/database.js';

const createContactMessage = async (req, res) => {
  try {
    const { username, email, message, subject } = req.body;

    if (!username || !email || !message) {
      return res.status(400).json({ message: 'Username, email, and message are required.' });
    }

    const newMessage = await prisma.contactMessages.create({
      data: {
        Username: username,
        Email: email,
        Message: message,
        Subject: subject || `Inquiry from ${username}`,
        Status: 'Unread',
      }
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

const getContactMessages = async (req, res) => {
  try {
    const messages = await prisma.contactMessages.findMany({
      orderBy: { CreatedAt: 'desc' },
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
        date: m.CreatedAt || m.createdAt
          ? new Date(m.CreatedAt || m.createdAt).toISOString().replace('T', ' ').substring(0, 16)
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

const updateContactMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['Unread', 'Read', 'Resolved', 'Archived'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const msg = await prisma.contactMessages.findUnique({ where: { Id: id } });
    if (!msg) {
      return res.status(404).json({ message: 'Contact message not found.' });
    }

    const updated = await prisma.contactMessages.update({
      where: { Id: id },
      data: { Status: status }
    });

    res.json({ message: `Message marked as ${status}.`, contactMessage: updated });
  } catch (error) {
    console.error('[contactController] updateContactMessageStatus error:', error);
    res.status(500).json({ message: 'Server error. Failed to update message.' });
  }
};

export { 
  createContactMessage,
  getContactMessages,
  updateContactMessageStatus,
 };
