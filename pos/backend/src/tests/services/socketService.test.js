/**
 * Tests for Socket.io service
 */
const socketService = require('../../services/socketService');

// Mock socket.io
jest.mock('socket.io', () => {
  const mockSocketOn = jest.fn();
  const mockSocketJoin = jest.fn();
  const mockSocketLeave = jest.fn();
  const mockSocketEmit = jest.fn();
  const mockSocketTo = jest.fn(() => ({ emit: mockSocketEmit }));
  
  const mockSocket = {
    on: mockSocketOn,
    join: mockSocketJoin,
    leave: mockSocketLeave,
    to: mockSocketTo,
    emit: mockSocketEmit,
    id: 'test-socket-id'
  };
  
  const mockIoOn = jest.fn((event, callback) => {
    if (event === 'connection') {
      callback(mockSocket);
    }
  });
  
  const mockIoEmit = jest.fn();
  const mockIoTo = jest.fn(() => ({ emit: mockIoEmit }));
  
  const mockIo = {
    on: mockIoOn,
    emit: mockIoEmit,
    to: mockIoTo,
    use: jest.fn((middleware) => middleware(mockSocket, jest.fn())),
    engine: { clientsCount: 5 }
  };
  
  return jest.fn(() => mockIo);
});

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token) => {
    if (token === 'valid-token') {
      return { id: 'user-123', role: 'admin' };
    }
    throw new Error('Invalid token');
  })
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Socket.io Service', () => {
  let mockServer;
  
  beforeEach(() => {
    mockServer = { test: 'server' };
    
    // Reset module state between tests
    jest.resetModules();
    
    // Clear environment
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.JWT_SECRET = 'test-secret';
    
    // Reset internal maps
    socketService._userSockets.clear();
    socketService._roomSockets.clear();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('initialize', () => {
    test('should initialize socket.io with server', () => {
      const io = socketService.initialize(mockServer);
      
      expect(io).toBeDefined();
      expect(require('socket.io')).toHaveBeenCalledWith(mockServer, expect.any(Object));
    });
    
    test('should return existing io instance if already initialized', () => {
      const io1 = socketService.initialize(mockServer);
      const io2 = socketService.initialize(mockServer);
      
      expect(io1).toBe(io2);
      expect(require('socket.io')).toHaveBeenCalledTimes(1);
    });
    
    test('should set up connection handler', () => {
      const io = socketService.initialize(mockServer);
      
      expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
    
    test('should set up authentication middleware', () => {
      const io = socketService.initialize(mockServer);
      
      expect(io.use).toHaveBeenCalledWith(expect.any(Function));
    });
  });
  
  describe('emitToAll', () => {
    test('should emit event to all connected clients', () => {
      const io = socketService.initialize(mockServer);
      const data = { test: 'data' };
      
      socketService.emitToAll('test-event', data);
      
      expect(io.emit).toHaveBeenCalledWith('test-event', data);
    });
    
    test('should log error if io not initialized', () => {
      // Reset module to clear io
      jest.resetModules();
      const logger = require('../../utils/logger');
      
      socketService.emitToAll('test-event', {});
      
      expect(logger.error).toHaveBeenCalledWith('Socket.io not initialized');
    });
  });
  
  describe('emitToUser', () => {
    test('should emit event to user sockets', () => {
      const io = socketService.initialize(mockServer);
      const userId = 'user-123';
      const socketId = 'socket-123';
      const data = { test: 'data' };
      
      // Setup user socket
      socketService._userSockets.set(userId, new Set([socketId]));
      
      socketService.emitToUser(userId, 'test-event', data);
      
      expect(io.to).toHaveBeenCalledWith(socketId);
      expect(io.to(socketId).emit).toHaveBeenCalledWith('test-event', data);
    });
    
    test('should log debug message if no sockets for user', () => {
      socketService.initialize(mockServer);
      const logger = require('../../utils/logger');
      
      socketService.emitToUser('non-existent', 'test-event', {});
      
      expect(logger.debug).toHaveBeenCalledWith('No active sockets for user non-existent');
    });
  });
  
  describe('emitToRoom', () => {
    test('should emit event to room', () => {
      const io = socketService.initialize(mockServer);
      const room = 'test-room';
      const data = { test: 'data' };
      
      socketService.emitToRoom(room, 'test-event', data);
      
      expect(io.to).toHaveBeenCalledWith(room);
      expect(io.to(room).emit).toHaveBeenCalledWith('test-event', data);
    });
  });
  
  describe('getConnectionStats', () => {
    test('should return connection statistics', () => {
      socketService.initialize(mockServer);
      
      // Setup test data
      socketService._userSockets.set('user1', new Set(['socket1']));
      socketService._userSockets.set('user2', new Set(['socket2', 'socket3']));
      socketService._roomSockets.set('room1', new Set(['socket1']));
      socketService._roomSockets.set('room2', new Set(['socket2']));
      
      const stats = socketService.getConnectionStats();
      
      expect(stats).toEqual({
        total: 5, // From mock
        users: 2,
        rooms: 2
      });
    });
  });
});
