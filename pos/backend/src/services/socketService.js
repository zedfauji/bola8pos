/**
 * Socket.io Service
 * Manages real-time communication between server and clients
 */
const logger = require('../utils/logger');

// Store socket.io instance
let io;

// Store active connections by user ID
const userSockets = new Map();

// Store active connections by room
const roomSockets = new Map();

/**
 * Initialize Socket.io with server instance
 * @param {Object} server - HTTP/HTTPS server instance
 */
function initialize(server) {
  if (io) {
    return io;
  }
  
  io = require('socket.io')(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  // Set up authentication middleware
  io.use(authenticateSocket);
  
  // Set up connection handler
  io.on('connection', handleConnection);
  
  logger.info('Socket.io initialized');
  return io;
}

/**
 * Socket authentication middleware
 * @param {Object} socket - Socket.io socket
 * @param {Function} next - Next function
 */
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth.token;
    
    // Skip auth if no token provided (for public events)
    if (!token) {
      socket.user = { id: null, role: 'guest' };
      return next();
    }
    
    // Verify JWT token
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = process.env;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Store user info in socket
    socket.user = {
      id: decoded.id,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
}

/**
 * Handle new socket connection
 * @param {Object} socket - Socket.io socket
 */
function handleConnection(socket) {
  const userId = socket.user?.id;
  
  logger.info(`Socket connected: ${socket.id}${userId ? ` for user ${userId}` : ''}`);
  
  // Store user socket if authenticated
  if (userId) {
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
  }
  
  // Handle joining rooms
  socket.on('join', (rooms) => {
    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }
    
    rooms.forEach(room => {
      // Join room
      socket.join(room);
      
      // Store room membership
      if (!roomSockets.has(room)) {
        roomSockets.set(room, new Set());
      }
      roomSockets.get(room).add(socket.id);
      
      logger.debug(`Socket ${socket.id} joined room: ${room}`);
    });
  });
  
  // Handle leaving rooms
  socket.on('leave', (rooms) => {
    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }
    
    rooms.forEach(room => {
      // Leave room
      socket.leave(room);
      
      // Remove from room membership
      if (roomSockets.has(room)) {
        roomSockets.get(room).delete(socket.id);
      }
      
      logger.debug(`Socket ${socket.id} left room: ${room}`);
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
    
    // Remove from user sockets
    if (userId && userSockets.has(userId)) {
      userSockets.get(userId).delete(socket.id);
      if (userSockets.get(userId).size === 0) {
        userSockets.delete(userId);
      }
    }
    
    // Remove from room sockets
    for (const [room, sockets] of roomSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          roomSockets.delete(room);
        }
      }
    }
  });
}

/**
 * Emit event to all connected clients
 * @param {String} event - Event name
 * @param {*} data - Event data
 */
function emitToAll(event, data) {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  io.emit(event, data);
}

/**
 * Emit event to specific user
 * @param {String} userId - User ID
 * @param {String} event - Event name
 * @param {*} data - Event data
 */
function emitToUser(userId, event, data) {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  if (!userSockets.has(userId)) {
    logger.debug(`No active sockets for user ${userId}`);
    return;
  }
  
  for (const socketId of userSockets.get(userId)) {
    io.to(socketId).emit(event, data);
  }
}

/**
 * Emit event to specific room
 * @param {String} room - Room name
 * @param {String} event - Event name
 * @param {*} data - Event data
 */
function emitToRoom(room, event, data) {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  io.to(room).emit(event, data);
}

/**
 * Get active connections count
 * @returns {Object} Connection counts
 */
function getConnectionStats() {
  return {
    total: io ? io.engine.clientsCount : 0,
    users: userSockets.size,
    rooms: roomSockets.size
  };
}

module.exports = {
  initialize,
  emitToAll,
  emitToUser,
  emitToRoom,
  getConnectionStats,
  // Export for testing
  _userSockets: userSockets,
  _roomSockets: roomSockets
};
