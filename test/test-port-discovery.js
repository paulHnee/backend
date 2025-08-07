#!/usr/bin/env node

/**
 * OPNsense Port und Service Discovery
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function discoverOPNsenseService() {
  console.log('🔍 OPNsense Service Discovery startet...\n');
  
  const host = process.env.OPNSENSE_HOST || 'vpn.hnee.de';
  const fallbackHost = process.env.OPNSENSE_IP || '10.1.1.48';
  
  // Teste verschiedene häufige Ports für OPNsense
  const portsToTest = [
    { port: 443, desc: 'Standard HTTPS' },
    { port: 8443, desc: 'Alternative HTTPS' },
    { port: 80, desc: 'HTTP (unsicher)' },
    { port: 8080, desc: 'Alternative HTTP' },
    { port: 10443, desc: 'Custom HTTPS' },
    { port: 4443, desc: 'Custom HTTPS Alt' }
  ];
  
  const hostsToTest = [host, fallbackHost];
  
  for (const testHost of hostsToTest) {
    console.log(`🌐 Teste Host: ${testHost}`);
    console.log('   ' + '─'.repeat(40));
    
    for (const { port, desc } of portsToTest) {
      try {
        // Teste Port-Erreichbarkeit mit netcat
        const { stdout, stderr } = await execAsync(`timeout 2 nc -z -v ${testHost} ${port} 2>&1`, { 
          timeout: 3000 
        });
        
        const output = (stdout + stderr).toLowerCase();
        
        if (output.includes('succeeded') || output.includes('open') || output.includes('connected')) {
          console.log(`   ✅ Port ${port} (${desc}): OFFEN`);
          
          // Teste ob es ein HTTP-Service ist
          try {
            const { stdout: httpTest } = await execAsync(`timeout 2 curl -k -s -I https://${testHost}:${port}/ 2>/dev/null || curl -s -I http://${testHost}:${port}/ 2>/dev/null`, {
              timeout: 3000
            });
            
            if (httpTest.includes('HTTP')) {
              console.log(`      💻 HTTP-Service erkannt`);
              if (httpTest.includes('Server:')) {
                const serverMatch = httpTest.match(/Server:\s*([^\r\n]+)/i);
                if (serverMatch) {
                  console.log(`      🔧 Server: ${serverMatch[1].trim()}`);
                }
              }
              
              // Teste speziell auf OPNsense
              try {
                const { stdout: opnTest } = await execAsync(`timeout 3 curl -k -s https://${testHost}:${port}/api 2>/dev/null || curl -s http://${testHost}:${port}/api 2>/dev/null`, {
                  timeout: 4000
                });
                
                if (opnTest.includes('OPNsense') || opnTest.includes('Authentication required') || opnTest.includes('Unauthorized')) {
                  console.log(`      🎯 OPNsense API möglicherweise verfügbar!`);
                }
              } catch (e) {
                // Ignoriere Timeout
              }
            }
          } catch (httpError) {
            // HTTP-Test fehlgeschlagen, Port ist trotzdem offen
          }
          
        } else {
          console.log(`   ❌ Port ${port} (${desc}): GESCHLOSSEN`);
        }
      } catch (error) {
        console.log(`   ❌ Port ${port} (${desc}): NICHT ERREICHBAR`);
      }
    }
    
    console.log('');
  }
  
  // Zusätzliche Netzwerk-Diagnostik
  console.log('🔍 Zusätzliche Netzwerk-Diagnostik:');
  console.log('   ' + '─'.repeat(40));
  
  for (const testHost of hostsToTest) {
    try {
      // DNS-Auflösung testen
      const { stdout: dnsResult } = await execAsync(`nslookup ${testHost}`, { timeout: 5000 });
      console.log(`   📍 DNS für ${testHost}: OK`);
      
      // Ping-Test
      const { stdout: pingResult } = await execAsync(`ping -c 1 -W 2000 ${testHost}`, { timeout: 4000 });
      if (pingResult.includes('1 received')) {
        console.log(`   🏓 Ping zu ${testHost}: OK`);
      }
      
      // Traceroute (erste 3 Hops)
      try {
        const { stdout: traceResult } = await execAsync(`timeout 5 traceroute -m 3 ${testHost} 2>/dev/null | head -5`, { timeout: 6000 });
        if (traceResult.trim()) {
          console.log(`   🛣️ Route zu ${testHost}: Teilweise sichtbar`);
        }
      } catch (e) {
        // Traceroute nicht verfügbar oder fehlgeschlagen
      }
      
    } catch (error) {
      console.log(`   ❌ Netzwerk-Diagnostik für ${testHost}: Fehlgeschlagen`);
    }
  }
  
  console.log('\n💡 Empfehlungen:');
  console.log('   - Falls Port 443 oder 8443 offen ist: Verwende HTTPS-API');
  console.log('   - Falls nur Port 80 offen ist: OPNsense läuft möglicherweise nur auf HTTP');
  console.log('   - Falls keine Ports offen: Prüfe Firewall-Einstellungen');
  console.log('   - OPNsense-Standard: Port 443 mit selbstsigniertem Zertifikat');
}

discoverOPNsenseService().catch(console.error);
