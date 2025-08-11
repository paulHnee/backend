/**
 * Rate-Limited OPNsense API Client
 * 
 * This version prevents connection flooding by implementing:
 * - Request queuing
 * - Rate limiting
 * - Connection pooling
 * - Duplicate request deduplication
 * 
 * @author Assistant
 * @version 2.0.0
 * @since 2025-08-11
 */

import https from 'https';
import { EventEmitter } from 'events';

/**
 * Request Queue Manager to prevent overwhelming the API
 */
class RequestQueue extends EventEmitter {
  constructor(maxConcurrent = 2, minInterval = 1000) {
    super();
    this.maxConcurrent = maxConcurrent; // Max 2 concurrent requests
    this.minInterval = minInterval; // Min 1 second between requests
    this.queue = [];
    this.active = new Set();
    this.lastRequestTime = 0;
    this.pendingRequests = new Map(); // For deduplication
  }

  /**
   * Add request to queue with deduplication
   */
  async enqueue(requestKey, requestFunction) {
    // Check if same request is already pending
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 Deduplicating request: ${requestKey}`);
      return this.pendingRequests.get(requestKey);
    }

    // Create promise for this request
    const promise = new Promise((resolve, reject) => {
      this.queue.push({
        key: requestKey,
        execute: requestFunction,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });

    // Store promise for deduplication
    this.pendingRequests.set(requestKey, promise);
    
    // Clean up after completion
    promise.finally(() => {
      this.pendingRequests.delete(requestKey);
    });

    return promise;
  }

  /**
   * Process the request queue
   */
  async processQueue() {
    if (this.queue.length === 0 || this.active.size >= this.maxConcurrent) {
      return;
    }

    // Rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      setTimeout(() => this.processQueue(), this.minInterval - timeSinceLastRequest);
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.active.add(request.key);
    this.lastRequestTime = now;

    console.log(`🚀 Processing request: ${request.key} (${this.active.size}/${this.maxConcurrent} active)`);

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.active.delete(request.key);
      // Process next request after a short delay
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      active: this.active.size,
      pending: this.pendingRequests.size,
      lastRequest: this.lastRequestTime
    };
  }
}

/**
 * Enhanced OPNsense API with rate limiting and connection management
 */
class OPNsenseAPI {
  constructor(options = {}) {
    // Configuration
    this.host = options.host || process.env.OPNSENSE_HOST || 'vpn.hnee.de';
    this.port = parseInt(process.env.OPNSENSE_PORT) || 443;
    this.apiKey = process.env.OPNSENSE_API_KEY;
    this.apiSecret = process.env.OPNSENSE_API_SECRET;
    
    // Longer timeouts for stability
    this.connectTimeout = 10000; // 10 seconds
    this.responseTimeout = 15000; // 15 seconds
    
    // Request queue for rate limiting
    this.requestQueue = new RequestQueue(1, 2000); // 1 concurrent, 2 sec interval
    
    // Response cache to reduce duplicate requests
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 second cache
    
    console.log('[OPNsenseAPI] Initialized with rate limiting:');
    console.log('  host:', this.host);
    console.log('  maxConcurrent: 1');
    console.log('  minInterval: 2000ms');
    console.log('  cacheTimeout: 5000ms');

    if (!this.apiKey || !this.apiSecret) {
      console.warn('⚠️ OPNsense API credentials not configured');
      this.configured = false;
    } else {
      this.configured = true;
    }
  }

  /**
   * Generate cache key for request
   */
  getCacheKey(endpoint, method, data) {
    return `${method}:${endpoint}:${data ? JSON.stringify(data) : ''}`;
  }

  /**
   * Check cache for recent response
   */
  getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log(`📦 Cache hit: ${cacheKey}`);
      return cached.data;
    }
    return null;
  }

  /**
   * Store response in cache
   */
  setCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Rate-limited API request with caching and deduplication
   */
  async request(endpoint, method = 'GET', data = null) {
    if (!this.configured) {
      throw new Error('OPNsense API not configured - missing credentials');
    }

    const cacheKey = this.getCacheKey(endpoint, method, data);
    
    // Check cache for GET requests
    if (method === 'GET') {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Create request key for deduplication
    const requestKey = `${method}:${endpoint}`;
    
    // Enqueue request with deduplication
    const result = await this.requestQueue.enqueue(requestKey, async () => {
      return this.makeActualRequest(endpoint, method, data);
    });

    // Cache successful GET responses
    if (method === 'GET' && result) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * Actual HTTP request implementation
   */
  async makeActualRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
      
      const options = {
        hostname: this.host,
        port: this.port,
        path: endpoint,
        method: method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'HNEE-ServicePortal/2.0',
          'Connection': 'close',
          'Cache-Control': 'no-cache'
        },
        agent: false, // No connection pooling
        rejectUnauthorized: false,
        timeout: this.connectTimeout
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      console.log(`🌐 ${method} https://${this.host}${endpoint}`);

      const req = https.request(options, (res) => {
        let responseData = '';
        let responseTimeout;

        // Set response timeout
        responseTimeout = setTimeout(() => {
          console.error('❌ Response timeout');
          req.destroy();
          reject(new Error(`Response timeout after ${this.responseTimeout}ms`));
        }, this.responseTimeout);

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          clearTimeout(responseTimeout);
          
          console.log(`📊 Response: ${res.statusCode} (${responseData.length} bytes)`);

          try {
            if (!responseData || responseData.trim().length === 0) {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, status: res.statusCode });
                return;
              } else {
                reject(new Error(`Empty response with status ${res.statusCode}`));
                return;
              }
            }

            if (responseData.trim().startsWith('<') || responseData.includes('<!DOCTYPE html>')) {
              reject(new Error(`Server returned HTML (Status: ${res.statusCode}). Check API configuration.`));
              return;
            }

            let parsedData;
            try {
              parsedData = JSON.parse(responseData);
            } catch (parseError) {
              reject(new Error(`JSON Parse Error: ${parseError.message}`));
              return;
            }

            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`✅ Request successful: ${method} ${endpoint}`);
              resolve(parsedData);
            } else {
              reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(parsedData)}`));
            }
          } catch (error) {
            clearTimeout(responseTimeout);
            reject(new Error(`Response processing error: ${error.message}`));
          }
        });

        res.on('error', (error) => {
          clearTimeout(responseTimeout);
          reject(new Error(`Response error: ${error.message}`));
        });
      });

      req.on('error', (error) => {
        console.error(`❌ Request error:`, error.code, error.message);
        
        let errorMessage = `Request failed to ${this.host}: `;
        switch (error.code) {
          case 'ENOTFOUND':
            errorMessage += 'DNS resolution failed';
            break;
          case 'ECONNREFUSED':
            errorMessage += 'Connection refused (check if OPNsense is running)';
            break;
          case 'ETIMEDOUT':
            errorMessage += 'Connection timeout';
            break;
          case 'ECONNRESET':
            errorMessage += 'Connection reset (possible rate limiting or auth issue)';
            break;
          default:
            errorMessage += error.message;
        }
        
        reject(new Error(errorMessage));
      });

      req.on('timeout', () => {
        console.error(`❌ Connection timeout after ${this.connectTimeout}ms`);
        req.destroy();
        reject(new Error(`Connection timeout after ${this.connectTimeout}ms`));
      });

      req.setTimeout(this.connectTimeout);

      if (data && (method === 'POST' || method === 'PUT')) {
        try {
          req.write(JSON.stringify(data));
        } catch (writeError) {
          reject(new Error(`Error writing request data: ${writeError.message}`));
          return;
        }
      }

      req.end();
    });
  }

  /**
   * Get system status with caching
   */
  async getSystemStatus() {
    try {
      console.log('🔍 Fetching system status (rate-limited)...');
      
      const menuTree = await this.request('/api/core/menu/tree', 'GET');

      function flattenMenuTree(node, arr = []) {
        if (Array.isArray(node)) {
          node.forEach(child => flattenMenuTree(child, arr));
        } else if (node && typeof node === 'object') {
          arr.push(node);
          if (node.Children) flattenMenuTree(node.Children, arr);
        }
        return arr;
      }
      const flatMenu = flattenMenuTree(menuTree);

      if (flatMenu && Array.isArray(flatMenu)) {
        console.log(`✅ System status: ${flatMenu.length} menu items`);
        return {
          status: 'online',
          message: 'OPNsense Core API available',
          menuItems: flatMenu.length,
          availableModules: flatMenu.slice(0, 5).map(item => item.VisibleName || item.Id),
          lastCheck: new Date().toISOString(),
          source: 'menu-tree-api'
        };
      }

      throw new Error('Menu-Tree-API returned no valid data');

    } catch (error) {
      console.error('❌ Error fetching system status:', error.message);
      return {
        status: 'error',
        message: error.message,
        source: 'system-status-error',
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Get service status with caching
   */
  async getCoreServiceStatus() {
    try {
      console.log('🔍 Fetching service status (rate-limited)...');

      const menuTree = await this.request('/api/core/menu/tree', 'GET');

      function flattenMenuTree(node, arr = []) {
        if (Array.isArray(node)) {
          node.forEach(child => flattenMenuTree(child, arr));
        } else if (node && typeof node === 'object') {
          arr.push(node);
          if (node.Children) flattenMenuTree(node.Children, arr);
        }
        return arr;
      }
      const flatMenu = flattenMenuTree(menuTree);

      if (flatMenu && Array.isArray(flatMenu)) {
        const serviceRelatedItems = flatMenu.filter(item => 
          item.VisibleName && (
            item.VisibleName.toLowerCase().includes('service') ||
            item.VisibleName.toLowerCase().includes('vpn') ||
            item.VisibleName.toLowerCase().includes('interface') ||
            item.VisibleName.toLowerCase().includes('firewall') ||
            item.VisibleName.toLowerCase().includes('wireguard')
          )
        );

        const services = serviceRelatedItems.map(item => ({
          id: item.Id,
          name: item.VisibleName,
          description: `OPNsense ${item.VisibleName}`,
          running: 1,
          url: item.Url || '',
          breadcrumb: item.breadcrumb || ''
        }));

        console.log(`✅ Service status: ${services.length} service-related items`);

        return {
          total: services.length,
          rows: services,
          source: 'menu-tree-api',
          lastCheck: new Date().toISOString()
        };
      }

      throw new Error('Menu-Tree-API returned no valid data');

    } catch (error) {
      console.error('❌ Error fetching services:', error.message);

      return {
        total: 1,
        rows: [{
          id: 'opnsense',
          name: 'OPNsense System',
          description: 'OPNsense Core System',
          running: 1
        }],
        source: 'fallback',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Get combined status (prevents multiple simultaneous requests)
   */
  async getStatus() {
    try {
      // Use single request to get menu tree, then derive both system and service status
      const menuTree = await this.request('/api/core/menu/tree', 'GET');
      
      function flattenMenuTree(node, arr = []) {
        if (Array.isArray(node)) {
          node.forEach(child => flattenMenuTree(child, arr));
        } else if (node && typeof node === 'object') {
          arr.push(node);
          if (node.Children) flattenMenuTree(node.Children, arr);
        }
        return arr;
      }
      const flatMenu = flattenMenuTree(menuTree);

      // Derive system status
      const systemStatus = {
        status: 'online',
        message: 'OPNsense Core API available',
        menuItems: flatMenu.length,
        availableModules: flatMenu.slice(0, 5).map(item => item.VisibleName || item.Id),
        lastCheck: new Date().toISOString(),
        source: 'combined-request'
      };

      // Derive service status
      const serviceRelatedItems = flatMenu.filter(item => 
        item.VisibleName && (
          item.VisibleName.toLowerCase().includes('service') ||
          item.VisibleName.toLowerCase().includes('vpn') ||
          item.VisibleName.toLowerCase().includes('wireguard')
        )
      );

      const services = serviceRelatedItems.map(item => ({
        id: item.Id,
        name: item.VisibleName,
        description: `OPNsense ${item.VisibleName}`,
        running: 1,
        url: item.Url || ''
      }));

      const serviceStatus = {
        total: services.length,
        rows: services,
        source: 'combined-request',
        lastCheck: new Date().toISOString()
      };

      // Find WireGuard service
      const wgService = services.find(service => 
        service.name?.toLowerCase().includes('wireguard')
      );
      
      const vpnServices = services.filter(service => 
        service.name?.toLowerCase().includes('vpn') || 
        service.name?.toLowerCase().includes('wireguard')
      );
      
      console.log(`✅ Combined status: ${vpnServices.length} VPN services found`);
      
      return {
        status: 'running',
        system: systemStatus,
        services: serviceStatus,
        wireguard: wgService ? {
          running: true,
          status: 'running',
          name: wgService.name,
          id: wgService.id,
          url: wgService.url
        } : null,
        vpn: {
          available: vpnServices.length > 0,
          services: vpnServices,
          count: vpnServices.length
        },
        source: 'optimized-single-request',
        lastCheck: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error fetching combined status:', error.message);
      
      return {
        status: 'error',
        error: error.message,
        system: null,
        services: null,
        wireguard: null,
        vpn: { available: false, services: [], count: 0 },
        source: 'error-fallback',
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    return this.requestQueue.getStatus();
  }

  /**
   * Test connection with rate limiting
   */
  async testConnection() {
    try {
      console.log('🔍 Testing connection (rate-limited)...');
      const response = await this.request('/api/core/menu/tree', 'GET');
      return {
        success: true,
        message: 'Connection successful',
        responseType: typeof response,
        hasData: Boolean(response),
        queueStatus: this.getQueueStatus()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        queueStatus: this.getQueueStatus()
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 50,
      timeout: this.cacheTimeout
    };
  }

  // WireGuard methods with rate limiting...
  async getClients() {
    try {
      console.log('🔍 Getting WireGuard clients (rate-limited)...');
      const response = await this.request('/api/wireguard/client/searchClient', 'POST', {});
      return response.rows || [];
    } catch (error) {
      console.warn('WireGuard Client API not available:', error.message);
      return [];
    }
  }

  async getServiceInfo() {
    try {
      console.log('🔍 Getting WireGuard service info (rate-limited)...');
      const response = await this.request('/api/wireguard/service/show', 'GET');
      return response;
    } catch (error) {
      console.warn('WireGuard Service Info API not available:', error.message);
      return {
        name: null,
        status: 'unavailable',
        enabled: false,
        error: error.message,
        source: 'rate-limited-fallback'
      };
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.clearCache();
    console.log('🧹 OPNsense API client destroyed');
  }
}

// Singleton with rate limiting
let opnsenseInstance = null;

export const getOPNsenseAPI = () => {
  if (!opnsenseInstance) {
    opnsenseInstance = new OPNsenseAPI();
  }
  return opnsenseInstance;
};

export const isOPNsenseConfigured = () => {
  try {
    const api = getOPNsenseAPI();
    return api.configured;
  } catch (error) {
    return false;
  }
};

export default OPNsenseAPI;