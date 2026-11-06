import { Server } from 'socket.io';
import { TOKEN_TYPES, verifyToken } from '../config/jwt.js';
import { validateSession } from '../modules/01-identity-access/auth/session.service.js';
import { getActiveGrants, isSuperAdmin } from '../modules/03-access-control/access.service.js';

let io = null;

const personRoom = (personId) => `person:${personId}`;

// Who is online: every open tab of a signed-in person holds a socket, so an account with at least one is online.
// Closing the last tab, or losing the connection, takes them offline within seconds.
const onlineSockets = new Map(); // account id -> ids of that account's sockets
const WATCHERS_ROOM = 'presence-watchers'; // Super Admins, told whenever someone comes online or goes offline

export const getOnlineAccountIds = () => [...onlineSockets.keys()];

const readCookie = (header, name) => {
  const match = (header || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

/**
 * A socket connects only with a valid session cookie, like any protected route. It then joins its person's room,
 * so a notification reaches only the people it is meant for.
 */
const authenticate = async (socket, next) => {
  try {
    const token = readCookie(socket.handshake.headers.cookie, 'token');
    const decoded = verifyToken(token, TOKEN_TYPES.ACCESS);
    const { account } = await validateSession(decoded.sid);
    socket.data.accountId = account.id;
    socket.join(personRoom(account.personId));
    if (isSuperAdmin(await getActiveGrants(account.personId))) socket.join(WATCHERS_ROOM);
    next();
  } catch {
    next(new Error('Not authenticated'));
  }
};

/**
 * Initializes Socket.io realtime server
 */
export const initSocket = (httpServer, { allowedOrigins = [] } = {}) => {
  if (io) return io;

  io = new Server(httpServer, {
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

  io.use(authenticate);

  io.on('connection', (socket) => {
    console.log(`⚡ Socket client connected: ${socket.id}`);

    const { accountId } = socket.data;
    const sockets = onlineSockets.get(accountId) ?? new Set();
    sockets.add(socket.id);
    onlineSockets.set(accountId, sockets);
    if (sockets.size === 1) io.to(WATCHERS_ROOM).emit('presence:changed');

    socket.on('disconnect', () => {
      console.log(`🔌 Socket client disconnected: ${socket.id}`);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineSockets.delete(accountId);
        io.to(WATCHERS_ROOM).emit('presence:changed');
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

/**
 * Push an event to a person if they are connected. Returns whether anyone received it.
 */
export const pushToPerson = (personId, event, payload) => {
  if (!io) return false;
  const room = personRoom(personId);
  if ((io.sockets.adapter.rooms.get(room)?.size ?? 0) === 0) return false;
  io.to(room).emit(event, payload);
  return true;
};

export default { initSocket, getIO, pushToPerson, getOnlineAccountIds };
