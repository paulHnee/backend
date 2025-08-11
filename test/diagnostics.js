/**
 * OPNsense Connection Diagnostic Tool
 * 
 * This tool helps diagnose connection issues with OPNsense API
 * and provides step-by-step troubleshooting.
 * 
 * @author Paul Buchwald
 * @version 1.0.0
 * @since 2025-08-11
 */

import https from 'https';
import tls from 'tls';
import net from 'net';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = dirname(__dirname);
dotenv.config({ path: join(testDir, '.env') });

class OPNsenseDiagnostics {
  constructor(host = 'vpn.hnee.de', port = 443) {
    this.host = host;
    this.port = port;
    this.apiKey = process.env.OPNSENSE_API_KEY;
    this.apiSecret = process.env.OPNSENSE_API_SECRET;
  }

  /**
   * Run complete diagnostic suite
   */
  async runFullDiagnostic() {
    console.log('🔍 Starting OPNsense Connection Diagnostics');
    console.log('='.repeat(50));
    
    const results = {
      timestamp: new Date().toISOString(),
      host: this.host,
      port: this.port,
      tests: {}
    };

    // Test 1: Basic network connectivity
    results.tests.networkConnectivity = await this.testNetworkConnectivity();
    
    // Test 2: Port accessibility
    results.tests.portAccessibility = await this.testPortConnectivity();
    
    // Test 3: SSL/TLS handshake
    results.tests.sslHandshake = await this.testSSLHandshake();
    
    // Test 4: HTTP connection without API
    results.tests.httpConnection = await this.testHTTPConnection();
    
    // Test 5: API endpoint accessibility
    results.tests.apiEndpoint = await this.testAPIEndpoint();
    
    // Test 6: Authentication test
    if (this.apiKey && this.apiSecret) {
      results.tests.authentication = await this.testAuthentication();
    } else {
      results.tests.authentication = { 
        success: false, 
        error: 'API credentials not configured' 
      };
    }

    // Generate report
    this.generateDiagnosticReport(results);
    
    return results;
  }

  /**
   * Test basic network connectivity using DNS resolution
   */
  async testNetworkConnectivity() {
    console.log('\n📡 Testing DNS Resolution...');
    
    try {
      const dns = await import('dns');
      const lookup = promisify(dns.lookup);
      
      const result = await lookup(this.host);
      
      console.log(`✅ DNS Resolution successful: ${this.host} -> ${result.address}`);
      return {
        success: true,
        ip: result.address,
        family: result.family,
      };
    } catch (error) {
      console.log(`❌ DNS Resolution failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testPortConnectivity() {
    console.log(`\n🔌 Testing TCP connection to ${this.host}:${this.port}...`);
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 10000; // 10 seconds
      
      let resolved = false;
      
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
        }
      };
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        console.log(`✅ TCP connection successful to ${this.host}:${this.port}`);
        cleanup();
        resolve({
          success: true,
          message: 'TCP connection established'
        });
      });
      
      socket.on('timeout', () => {
        console.log(`❌ TCP connection timeout to ${this.host}:${this.port}`);
        cleanup();
        resolve({
          success: false,
          error: 'Connection timeout'
        });
      });
      
      socket.on('error', (error) => {
        console.log(`❌ TCP connection error: ${error.message}`);
        cleanup();
        resolve({
          success: false,
          error: error.message,
          code: error.code
        });
      });
      
      socket.connect(this.port, this.host);
    });
  }

  /**
   * Test SSL/TLS handshake
   */
  async testSSLHandshake() {
    console.log(`\n🔒 Testing SSL/TLS handshake...`);
    
    return new Promise((resolve) => {
      const options = {
        host: this.host,
        port: this.port,
        rejectUnauthorized: false, // Accept self-signed certificates
        timeout: 10000
      };
      
      // BUG FIX: Use tls.connect instead of https.connect for raw TLS handshake
      const socket = tls.connect(options);
      let resolved = false;
      
      socket.on('secureConnect', () => {
        if (!resolved) {
          resolved = true;
          const cert = socket.getPeerCertificate();
          console.log(`✅ SSL/TLS handshake successful`);
          console.log(`   Certificate Subject: ${cert.subject?.CN || 'Unknown'}`);
          console.log(`   Certificate Issuer: ${cert.issuer?.CN || 'Unknown'}`);
          console.log(`   Valid From: ${cert.valid_from || 'Unknown'}`);
          console.log(`   Valid To: ${cert.valid_to || 'Unknown'}`);
          
          socket.end();
          resolve({
            success: true,
            certificate: {
              subject: cert.subject?.CN,
              issuer: cert.issuer?.CN,
              validFrom: cert.valid_from,
              validTo: cert.valid_to,
              fingerprint: cert.fingerprint
            }
          });
        }
      });
      
      socket.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          console.log(`❌ SSL/TLS handshake failed: ${error.message}`);
          resolve({
            success: false,
            error: error.message,
            code: error.code
          });
        }
      });
      
      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          console.log(`❌ SSL/TLS handshake timeout`);
          socket.destroy();
          resolve({
            success: false,
            error: 'SSL handshake timeout'
          });
        }
      });
    });
  }

  /**
   * Test basic HTTP connection to root path
   */
  async testHTTPConnection() {
    console.log(`\n🌐 Testing HTTP connection to root path...`);
    
    return new Promise((resolve) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/',
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'OPNsense-Diagnostic/1.0'
        },
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`✅ HTTP connection successful - Status: ${res.statusCode}`);
          console.log(`   Response length: ${data.length} bytes`);
          console.log(`   Content-Type: ${res.headers['content-type'] || 'Unknown'}`);
          
          resolve({
            success: true,
            statusCode: res.statusCode,
            headers: res.headers,
            responseLength: data.length,
            containsHTML: data.includes('<html>') || data.includes('<!DOCTYPE')
          });
        });
      });
      
      req.on('error', (error) => {
        console.log(`❌ HTTP connection failed: ${error.message}`);
        resolve({
          success: false,
          error: error.message,
          code: error.code
        });
      });
      
      req.on('timeout', () => {
        console.log(`❌ HTTP connection timeout`);
        req.destroy();
        resolve({
          success: false,
          error: 'HTTP request timeout'
        });
      });
      
      req.end();
    });
  }

  /**
   * Test API endpoint accessibility (without auth)
   */
  async testAPIEndpoint() {
    console.log(`\n🔧 Testing API endpoint accessibility...`);
    
    const endpoints = [
      '/api/core/menu/tree',
      '/api/core/system/status',
      '/api/diagnostics/interface/getInterfaceNames'
    ];
    
    const results = {};
    
    for (const endpoint of endpoints) {
      console.log(`   Testing: ${endpoint}`);
      
      try {
        const result = await this.testSingleEndpoint(endpoint);
        results[endpoint] = result;
        
        if (result.success) {
          console.log(`   ✅ ${endpoint} - Status: ${result.statusCode}`);
        } else {
          console.log(`   ❌ ${endpoint} - Error: ${result.error}`);
        }
      } catch (error) {
        results[endpoint] = {
          success: false,
          error: error.message
        };
        console.log(`   ❌ ${endpoint} - Exception: ${error.message}`);
      }
    }
    
    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`\n📊 API Endpoint Summary: ${successCount}/${endpoints.length} endpoints accessible`);
    
    return {
      success: successCount > 0,
      endpoints: results,
      accessibleCount: successCount,
      totalCount: endpoints.length
    };
  }

  /**
   * Test authentication with API credentials
   */
  async testAuthentication() {
    console.log(`\n🔐 Testing API authentication...`);
    
    if (!this.apiKey || !this.apiSecret) {
      console.log(`❌ API credentials not configured`);
      return {
        success: false,
        error: 'API credentials not configured'
      };
    }
    
    return new Promise((resolve) => {
      const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
      
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/api/core/menu/tree',
        method: 'GET',
        timeout: 10000,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'User-Agent': 'OPNsense-Diagnostic/1.0'
        },
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`✅ Authentication successful - Status: ${res.statusCode}`);
            try {
              const parsed = JSON.parse(data);
              console.log(`   Response type: JSON with ${Array.isArray(parsed) ? parsed.length : 'object'} items`);
            } catch (e) {
              console.log(`   Response type: Non-JSON (${data.length} bytes)`);
            }
            
            resolve({
              success: true,
              statusCode: res.statusCode,
              responseLength: data.length,
              isJSON: data.startsWith('{') || data.startsWith('[')
            });
          } else {
            console.log(`❌ Authentication failed - Status: ${res.statusCode}`);
            console.log(`   Response: ${data.substring(0, 200)}...`);
            
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: `HTTP ${res.statusCode}`,
              response: data.substring(0, 500)
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.log(`❌ Authentication request failed: ${error.message}`);
        resolve({
          success: false,
          error: error.message,
          code: error.code
        });
      });
      
      req.on('timeout', () => {
        console.log(`❌ Authentication request timeout`);
        req.destroy();
        resolve({
          success: false,
          error: 'Authentication request timeout'
        });
      });
      
      req.end();
    });
  }

  /**
   * Test a single API endpoint
   */
  async testSingleEndpoint(endpoint) {
    return new Promise((resolve) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: endpoint,
        method: 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'OPNsense-Diagnostic/1.0'
        },
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            success: res.statusCode < 500, // Consider 4xx as "accessible" but auth issue
            statusCode: res.statusCode,
            responseLength: data.length
          });
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          code: error.code
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });
      
      req.end();
    });
  }

  /**
   * Generate diagnostic report with recommendations
   */
  generateDiagnosticReport(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📋 DIAGNOSTIC REPORT');
    console.log('='.repeat(50));
    
    // Network Layer
    console.log('\n🌐 NETWORK LAYER:');
    if (results.tests.networkConnectivity.success) {
      console.log('✅ DNS Resolution: OK');
    } else {
      console.log('❌ DNS Resolution: FAILED');
      console.log('   💡 Check if hostname is correct and DNS is reachable');
    }
    
    if (results.tests.portAccessibility.success) {
      console.log('✅ TCP Connection: OK');
    } else {
      console.log('❌ TCP Connection: FAILED');
      console.log('   💡 Check firewall rules, port availability, and network routing');
      
      if (results.tests.portAccessibility.code === 'ECONNREFUSED') {
        console.log('   💡 ECONNREFUSED: Service not running or port blocked');
      } else if (results.tests.portAccessibility.code === 'ETIMEDOUT') {
        console.log('   💡 ETIMEDOUT: Network firewall or routing issue');
      }
    }
    
    // SSL/TLS Layer
    console.log('\n🔒 SSL/TLS LAYER:');
    if (results.tests.sslHandshake.success) {
      console.log('✅ SSL/TLS Handshake: OK');
    } else {
      console.log('❌ SSL/TLS Handshake: FAILED');
      console.log('   💡 Check SSL certificate configuration on OPNsense');
    }
    
    // HTTP Layer
    console.log('\n🌐 HTTP LAYER:');
    if (results.tests.httpConnection.success) {
      console.log('✅ HTTP Connection: OK');
    } else {
      console.log('❌ HTTP Connection: FAILED');
    }
    
    // API Layer
    console.log('\n🔧 API LAYER:');
    if (results.tests.apiEndpoint.success) {
      console.log(`✅ API Endpoints: ${results.tests.apiEndpoint.accessibleCount}/${results.tests.apiEndpoint.totalCount} accessible`);
    } else {
      console.log('❌ API Endpoints: All failed');
      console.log('   💡 Check if OPNsense API is enabled in System -> Settings -> Administration');
    }
    
    // Authentication
    console.log('\n🔐 AUTHENTICATION:');
    if (results.tests.authentication.success) {
      console.log('✅ API Authentication: OK');
    } else {
      console.log('❌ API Authentication: FAILED');
      if (results.tests.authentication.error === 'API credentials not configured') {
        console.log('   💡 Configure OPNSENSE_API_KEY and OPNSENSE_API_SECRET environment variables');
      } else if (results.tests.authentication.statusCode === 401) {
        console.log('   💡 Check API key and secret are correct');
        console.log('   💡 Verify API user has proper permissions in OPNsense');
      }
    }
    
    // Overall recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (!results.tests.networkConnectivity.success) {
      console.log('1. Verify hostname/IP address is correct');
      console.log('2. Check DNS resolution');
    }
    
    if (!results.tests.portAccessibility.success) {
      console.log('3. Check if OPNsense is running and accessible');
      console.log('4. Verify firewall rules allow connections on port 443');
      console.log('5. Test from same network segment if possible');
    }
    
    if (results.tests.portAccessibility.success && !results.tests.apiEndpoint.success) {
      console.log('6. Enable API in OPNsense: System -> Settings -> Administration');
      console.log('7. Check "Enable API" checkbox');
      console.log('8. Create API user with proper permissions');
    }
    
    if (!results.tests.authentication.success && results.tests.apiEndpoint.success) {
      console.log('9. Verify API credentials are correct');
      console.log('10. Check API user permissions in OPNsense');
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// Export for use
export default OPNsenseDiagnostics;

// Usage example
export const runDiagnostics = async (host = 'vpn.hnee.de', port = 443) => {
  const diagnostics = new OPNsenseDiagnostics(host, port);
  return await diagnostics.runFullDiagnostic();
};