const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { Table, TableSession } = require('../models');
const { calculateSessionCost } = require('../utils/billing');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map(); // Map of clientId -> WebSocket
    this.subscriptions = new Map(); // Map of resource -> Set of clientIds
    
    this.setupEventHandlers();
    this.setupCleanupInterval();
  }

  setupEventHandlers() {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      this.clients.set(clientId, ws);
      
      console.log(`Client connected: ${clientId}`);
      
      ws.on('message', (message) => this.handleMessage(clientId, message));
      ws.on('close', () => this.handleDisconnect(clientId));
      
      // Send initial connection confirmation
      this.sendToClient(clientId, {
        type: 'connection_established',
        clientId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  setupCleanupInterval() {
    // Clean up dead connections every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const deadClients = [];
      
      this.clients.forEach((ws, clientId) => {
        if (ws.isAlive === false) {
          deadClients.push(clientId);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping(() => {});
      });
      
      deadClients.forEach(clientId => this.handleDisconnect(clientId));
    }, 300000); // 5 minutes
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'ping':
          this.handlePing(clientId, data);
          break;
          
        case 'subscribe':
          this.handleSubscribe(clientId, data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, data);
          break;
          
        case 'request_update':
          this.handleRequestUpdate(clientId, data);
          break;
          
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendErrorToClient(clientId, 'invalid_message', 'Invalid message format');
    }
  }

  handleDisconnect(clientId) {
    // Remove all subscriptions for this client
    this.subscriptions.forEach((clientIds, resource) => {
      if (clientIds.has(clientId)) {
        clientIds.delete(clientId);
        
        // Clean up empty subscription sets
        if (clientIds.size === 0) {
          this.subscriptions.delete(resource);
        }
      }
    });
    
    // Remove client
    this.clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  }

  // Message Handlers
  handlePing(clientId, data) {
    const ws = this.clients.get(clientId);
    if (ws) {
      ws.isAlive = true;
      this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
    }
  }

  handleSubscribe(clientId, data) {
    if (!data.resource) {
      this.sendErrorToClient(clientId, 'missing_resource', 'Resource is required for subscription');
      return;
    }
    
    // Initialize subscription set if it doesn't exist
    if (!this.subscriptions.has(data.resource)) {
      this.subscriptions.set(data.resource, new Set());
    }
    
    // Add client to subscription
    this.subscriptions.get(data.resource).add(clientId);
    
    // Send confirmation
    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      resource: data.resource,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`Client ${clientId} subscribed to ${data.resource}`);
  }

  handleUnsubscribe(clientId, data) {
    if (!data.resource) {
      this.sendErrorToClient(clientId, 'missing_resource', 'Resource is required for unsubscription');
      return;
    }
    
    if (this.subscriptions.has(data.resource)) {
      this.subscriptions.get(data.resource).delete(clientId);
      
      // Clean up empty subscription sets
      if (this.subscriptions.get(data.resource).size === 0) {
        this.subscriptions.delete(data.resource);
      }
      
      // Send confirmation
      this.sendToClient(clientId, {
        type: 'unsubscribe_confirmed',
        resource: data.resource,
        timestamp: new Date().toISOString(),
      });
      
      console.log(`Client ${clientId} unsubscribed from ${data.resource}`);
    }
  }

  async handleRequestUpdate(clientId, data) {
    if (!data.resource) {
      this.sendErrorToClient(clientId, 'missing_resource', 'Resource is required for update request');
      return;
    }
    
    try {
      let response;
      
      switch (data.resource) {
        case 'tables':
          response = await this.getTablesUpdate();
          break;
          
        case 'sessions':
          response = await this.getSessionsUpdate();
          break;
          
        case 'layout':
          response = await this.getLayoutUpdate();
          break;
          
        default:
          this.sendErrorToClient(clientId, 'invalid_resource', 'Unknown resource type');
          return;
      }
      
      this.sendToClient(clientId, {
        type: 'update',
        resource: data.resource,
        data: response,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Error handling update request:', error);
      this.sendErrorToClient(clientId, 'update_failed', 'Failed to fetch update');
    }
  }

  // Data Fetching Methods
  async getTablesUpdate() {
    const tables = await Table.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'status', 'positionX', 'positionY', 'rotation', 'group'],
      order: [['name', 'ASC']],
    });
    
    return { tables };
  }

  async getSessionsUpdate() {
    const activeSessions = await TableSession.findAll({
      where: { 
        status: { [Op.or]: ['active', 'paused'] },
      },
      include: [
        {
          model: Table,
          as: 'table',
          attributes: ['id', 'name'],
        },
        {
          model: Tariff,
          as: 'tariff',
          attributes: ['id', 'name', 'rate', 'rateType'],
        },
      ],
      order: [['startTime', 'ASC']],
    });
    
    // Calculate current cost for each session
    const sessions = await Promise.all(activeSessions.map(async (session) => {
      const { cost, totalMinutes, freeMinutesUsed } = calculateSessionCost(session);
      
      return {
        id: session.id,
        tableId: session.tableId,
        tableName: session.table?.name,
        status: session.status,
        startTime: session.startTime,
        playerCount: session.playerCount,
        totalMinutes,
        freeMinutesUsed,
        currentCost: cost,
        tariff: {
          id: session.tariff?.id,
          name: session.tariff?.name,
          rate: session.tariff?.rate,
          rateType: session.tariff?.rateType,
        },
      };
    }));
    
    return { sessions };
  }

  async getLayoutUpdate() {
    const layout = await TableLayout.findOne({
      where: { isActive: true },
      attributes: ['id', 'name', 'width', 'height', 'gridSize', 'settings'],
    });
    
    if (!layout) {
      return { layout: null };
    }
    
    const tables = await Table.findAll({
      where: { 
        layoutId: layout.id,
        isActive: true,
      },
      attributes: ['id', 'name', 'status', 'positionX', 'positionY', 'rotation', 'width', 'height', 'group'],
    });
    
    return {
      layout: {
        ...layout.toJSON(),
        tables,
      },
    };
  }

  // Event Broadcasting Methods
  broadcastTableUpdate(table) {
    this.broadcastToSubscribers('tables', {
      type: 'table_updated',
      table: {
        id: table.id,
        name: table.name,
        status: table.status,
        positionX: table.positionX,
        positionY: table.positionY,
        rotation: table.rotation,
        group: table.group,
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastSessionUpdate(session) {
    this.broadcastToSubscribers('sessions', {
      type: 'session_updated',
      session: {
        id: session.id,
        tableId: session.tableId,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        playerCount: session.playerCount,
        totalAmount: session.totalAmount,
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastLayoutUpdate(layout) {
    this.broadcastToSubscribers('layout', {
      type: 'layout_updated',
      layout: {
        id: layout.id,
        name: layout.name,
        width: layout.width,
        height: layout.height,
        gridSize: layout.gridSize,
        settings: layout.settings,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Utility Methods
  broadcastToSubscribers(resource, message) {
    if (!this.subscriptions.has(resource)) return;
    
    const subscribers = this.subscriptions.get(resource);
    const messageStr = JSON.stringify(message);
    
    subscribers.forEach(clientId => {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  sendToClient(clientId, message) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendErrorToClient(clientId, code, message) {
    this.sendToClient(clientId, {
      type: 'error',
      code,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = WebSocketService;
