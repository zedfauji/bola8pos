/**
 * WebSocket service for real-time table management updates
 */

class TableWebSocketService {
  constructor() {
    this.socket = null;
    this.subscriptions = new Map(); // Map of resource -> Set of callbacks
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.connectionPromise = null;
    this.pingInterval = null;
  }

  /**
   * Initialize WebSocket connection
   * @returns {Promise} Resolves when connected, rejects on error
   */
  connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => this.handleOpen(resolve);
        this.socket.onmessage = (event) => this.handleMessage(event);
        this.socket.onclose = () => this.handleClose();
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen(resolve) {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    
    // Set up ping/pong to keep connection alive
    this.setupPingPong();
    
    // Resubscribe to all previous subscriptions
    this.resubscribeAll();
    
    // Resolve the connection promise
    if (resolve) {
      resolve();
      this.connectionPromise = null;
    }
  }

  /**
   * Handle WebSocket close event
   */
  handleClose() {
    console.log('WebSocket disconnected');
    this.cleanup();
    
    // Attempt to reconnect with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
        this.maxReconnectDelay
      );
      
      console.log(`Attempting to reconnect in ${delay}ms...`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(console.error);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'pong':
          // Connection is alive, no action needed
          break;
          
        case 'subscription_confirmed':
          console.log(`Subscribed to ${message.resource}`);
          break;
          
        case 'unsubscribe_confirmed':
          console.log(`Unsubscribed from ${message.resource}`);
          break;
          
        case 'error':
          console.error('WebSocket error:', message);
          break;
          
        case 'update':
        case 'table_updated':
        case 'session_updated':
        case 'layout_updated':
          this.notifySubscribers(message);
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }

  /**
   * Set up ping/pong to keep connection alive
   */
  setupPingPong() {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  /**
   * Resubscribe to all previously subscribed resources
   */
  resubscribeAll() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.subscriptions.forEach((_, resource) => {
      this.sendSubscribeMessage(resource);
    });
  }

  /**
   * Send subscribe message to server
   */
  sendSubscribeMessage(resource) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'subscribe',
        resource,
      }));
    }
  }

  /**
   * Send unsubscribe message to server
   */
  sendUnsubscribeMessage(resource) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'unsubscribe',
        resource,
      }));
    }
  }

  /**
   * Subscribe to a resource
   * @param {string} resource - Resource to subscribe to (e.g., 'tables', 'sessions', 'layout')
   * @param {Function} callback - Callback function to handle updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(resource, callback) {
    if (!this.subscriptions.has(resource)) {
      this.subscriptions.set(resource, new Set());
      
      // Send subscribe message if connected
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendSubscribeMessage(resource);
      } else {
        // If not connected, connect first
        this.connect().catch(console.error);
      }
    }
    
    // Add callback to resource's callback set
    this.subscriptions.get(resource).add(callback);
    
    // Return unsubscribe function
    return () => this.unsubscribe(resource, callback);
  }

  /**
   * Unsubscribe from a resource
   */
  unsubscribe(resource, callback) {
    if (!this.subscriptions.has(resource)) {
      return;
    }
    
    const callbacks = this.subscriptions.get(resource);
    callbacks.delete(callback);
    
    // If no more callbacks, clean up
    if (callbacks.size === 0) {
      this.subscriptions.delete(resource);
      
      // Send unsubscribe message if connected
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendUnsubscribeMessage(resource);
      }
    }
  }

  /**
   * Notify all subscribers of a resource update
   */
  notifySubscribers(message) {
    let resource;
    
    // Determine resource from message type
    if (message.type === 'update') {
      resource = message.resource;
    } else if (message.type.endsWith('_updated')) {
      resource = message.type.split('_')[0];
    } else {
      console.warn('Unknown message type for notification:', message.type);
      return;
    }
    
    // Get callbacks for this resource
    const callbacks = this.subscriptions.get(resource);
    if (!callbacks) {
      return;
    }
    
    // Call each callback with the message data
    callbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in WebSocket callback:', error);
      }
    });
  }

  /**
   * Request an immediate update for a resource
   */
  requestUpdate(resource) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'request_update',
        resource,
      }));
    }
  }

  /**
   * Close the WebSocket connection
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.cleanup();
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      
      this.socket = null;
    }
    
    this.connectionPromise = null;
  }
}

// Export a singleton instance
const tableWebSocketService = new TableWebSocketService();

export default tableWebSocketService;
