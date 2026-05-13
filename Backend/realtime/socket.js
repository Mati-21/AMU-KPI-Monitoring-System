const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let ioInstance = null;

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;

  String(cookieHeader)
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const eqIndex = pair.indexOf('=');
      if (eqIndex <= 0) return;
      const key = pair.slice(0, eqIndex).trim();
      const value = pair.slice(eqIndex + 1).trim();
      if (!key) return;
      cookies[key] = decodeURIComponent(value);
    });

  return cookies;
};

const initSocket = (httpServer, { allowedOrigins = [] } = {}) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake?.headers?.cookie || '';
      const cookies = parseCookies(cookieHeader);
      const token = cookies.token;

      if (!token) {
        next(new Error('Not authorized, no token'));
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.Id) {
        next(new Error('Not authorized, token invalid'));
        return;
      }

      socket.user = { Id: decoded.Id };
      next();
    } catch (err) {
      next(new Error('Not authorized, token failed'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.user?.Id;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', () => {
      // nothing
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId) return false;
  ioInstance.to(`user:${userId}`).emit(event, payload);
  return true;
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
};
