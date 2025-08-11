#!/usr/bin/env node

/**
 * Mock-Test für die Angestellten-Zählung im Monitoring-Controller
 * 
 * Simuliert die Ergebnisse, die wir aus dem echten LDAP-System erhalten,
 * um zu testen, ob die Aggregations-Logik korrekt funktioniert.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock-Implementierung der LDAP-Funktionen
const mockSearchGroups = async (pattern) => {
  console.log('🔍 Mock: Simuliere LDAP-Gruppensuche...');
  
  // Simuliere die Gruppen, die in der echten Umgebung gefunden werden
  return [
    { name: 'WissenschaftlicheMitarbeiter', memberCount: 191, type: 'Group', description: 'Wissenschaftliche Mitarbeiter der Hochschule' },
    { name: 'Angestellte', memberCount: 85, type: 'Group', description: 'Fest angestellte Mitarbeiter (Verwaltung, etc.)' },
    { name: 'Studenten', memberCount: 0, type: 'Group', description: 'Studierende (memberCount oft unzuverlässig)' },
    { name: 'ITSZ', memberCount: 5, type: 'Group', description: 'ITSZ Team' },
    { name: 'Gastdozenten', memberCount: 12, type: 'Group', description: 'Gastdozenten' },
    { name: 'Pooltest', memberCount: 0, type: 'OU', description: 'Test-OU' },
    { name: 'Verwaltung', memberCount: 25, type: 'Group', description: 'Verwaltungsmitarbeiter' },
    // Weitere Gruppen...
  ];
};

const mockGetUsersFromOU = async (ouPath, ouName) => {
  console.log(`📂 Mock: Simuliere OU-basierte Benutzerabfrage für ${ouName}...`);
  
  // Simuliere die OU-Ergebnisse basierend auf echten Daten
  if (ouName === 'Studenten') {
    // Simuliere 2940 Studenten (wie in der echten Ausgabe gesehen)
    return Array.from({ length: 2940 }, (_, i) => ({
      username: `student${i + 1}`,
      displayName: `Student ${i + 1}`,
      mail: `student${i + 1}@hnee.de`
    }));
  } else if (ouName === 'Angestellte') {
    // Simuliere wenige direkte Angestellte (real oft niedriger als Gruppenmitgliedschaften)
    return Array.from({ length: 50 }, (_, i) => ({
      username: `angestellte${i + 1}`,
      displayName: `Angestellte ${i + 1}`,
      mail: `angestellte${i + 1}@hnee.de`
    }));
  } else if (ouName === 'Gastdozenten') {
    return Array.from({ length: 8 }, (_, i) => ({
      username: `gastdozent${i + 1}`,
      displayName: `Gastdozent ${i + 1}`,
      mail: `gastdozent${i + 1}@hnee.de`
    }));
  }
  
  return [];
};

async function testAngestellteMitMock() {
  try {
    console.log('🧪 Teste Angestellten-Aggregation mit Mock-Daten...\n');
    
    // Simuliere die getUserStatisticsWithLdapUtils Funktion
    console.log('📊 Rufe LDAP-Benutzerstatistiken mit ldapUtils ab...');
    
    // Definiere Gruppenmuster (wie im echten Code)
    const studentenGroups = ['Studenten', 'Studierende', 'studenten', 'student'];
    const angestellteGroups = ['Angestellte', 'Mitarbeiter', 'Beschaeftigte', 'mitarbeiter', 'personal'];
    const wissenschaftlicheGroups = ['wissenschaftliche', 'WissenschaftlicheMitarbeiter', 'wissenschaftlich'];
    const gastdozentenGroups = ['Gastdozenten', 'GastDozenten', 'gastdozenten', 'dozent'];
    const itszGroups = ['ITSZadmins', 'IT-Mitarbeiter', 'itsz', 'ITSZ'];
    
    let totalStudenten = 0;
    let totalAngestellte = 0;
    let totalWissenschaftliche = 0;
    let totalGastdozenten = 0;
    let totalITSZ = 0;
    
    // STRATEGIE 1: Moderne Gruppensuche (Mock)
    try {
      const allGroups = await mockSearchGroups('*');
      console.log(`🔍 Gefundene LDAP-Gruppen: ${allGroups.length}`);
      
      // Iteriere durch alle gefundenen Gruppen und kategorisiere sie
      for (const group of allGroups) {
        const groupNameLower = group.name.toLowerCase();
        
        // Studenten-Gruppen identifizieren und zählen
        if (studentenGroups.some(sg => groupNameLower.includes(sg.toLowerCase()))) {
          totalStudenten += group.memberCount || 0;
          console.log(`📚 Studenten-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
        }
        
        // Wissenschaftliche Mitarbeiter separat zählen (ZUERST prüfen, um Doppelzählung zu vermeiden)
        if (wissenschaftlicheGroups.some(wg => groupNameLower.includes(wg.toLowerCase()))) {
          totalWissenschaftliche += group.memberCount || 0;
          console.log(`� Wissenschaftliche-Mitarbeiter-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
        }
        // Angestellte-Gruppen identifizieren und zählen (ABER wissenschaftliche ausschließen)
        else if (angestellteGroups.some(ag => groupNameLower.includes(ag.toLowerCase()))) {
          totalAngestellte += group.memberCount || 0;
          console.log(`� Angestellte-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
        }
        
        // Gastdozenten-Gruppen identifizieren und zählen
        if (gastdozentenGroups.some(gg => groupNameLower.includes(gg.toLowerCase()))) {
          totalGastdozenten += group.memberCount || 0;
          console.log(`🎓 Gastdozenten-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
        }
        
        // ITSZ-Gruppen identifizieren und zählen
        if (itszGroups.some(ig => groupNameLower.includes(ig.toLowerCase()))) {
          totalITSZ += group.memberCount || 0;
          console.log(`🖥️ ITSZ-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
        }
      }
      
      console.log(`🔍 Gruppenbasierte Ergebnisse: Studenten=${totalStudenten}, Angestellte=${totalAngestellte}, Wissenschaftliche=${totalWissenschaftliche}, Gastdozenten=${totalGastdozenten}, ITSZ=${totalITSZ}`);
      
      const totalUsersFromGroups = totalStudenten + totalAngestellte + totalWissenschaftliche + totalGastdozenten + totalITSZ;
      console.log(`📊 Gesamtzahl aus Gruppensuche: ${totalUsersFromGroups} Benutzer`);
      
      // Wenn Studenten-Anzahl verdächtig niedrig ist, verwende OU-basierte Methode als Ergänzung
      if (totalStudenten < 500) {
        console.log('⚠️ Studenten-Anzahl verdächtig niedrig, ergänze mit OU-basierter Suche...');
        const studentenFromOU = await mockGetUsersFromOU('OU=Studenten,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Studenten');
        if (studentenFromOU.length > totalStudenten) {
          console.log(`📚 OU-basierte Suche ergab ${studentenFromOU.length} Studenten (überschreibt ${totalStudenten})`);
          totalStudenten = studentenFromOU.length;
        }
      }
      
      // Wenn Angestellten-Anzahl sehr niedrig ist, ergänze mit OU-Suche
      if (totalAngestellte < 50) {
        console.log('⚠️ Angestellten-Anzahl verdächtig niedrig, ergänze mit OU-basierter Suche...');
        const angestellteFromOU = await mockGetUsersFromOU('OU=Angestellte,OU=Benutzer,OU=FH-Eberswalde,DC=fh-eberswalde,DC=de', 'Angestellte');
        if (angestellteFromOU.length > totalAngestellte) {
          console.log(`👥 OU-basierte Suche ergab ${angestellteFromOU.length} Angestellte (überschreibt ${totalAngestellte})`);
          totalAngestellte = angestellteFromOU.length;
        }
      }
      
      // ===== FINAL VALIDATION =====
      if (totalAngestellte > 0 || totalWissenschaftliche > 0) {
        console.log(`✅ Finale Mitarbeiter-Anzahl: ${totalAngestellte} Angestellte + ${totalWissenschaftliche} Wissenschaftliche = ${totalAngestellte + totalWissenschaftliche} Gesamt`);
      }
      
    } catch (groupError) {
      console.warn('⚠️ Gruppensuche fehlgeschlagen:', groupError.message);
    }
    
    // Finale Berechnung
    const totalUsers = totalStudenten + totalAngestellte + totalWissenschaftliche + totalGastdozenten + totalITSZ;
    
    console.log('\n📊 FINALE ERGEBNISSE:');
    console.log('=======================');
    console.log(`Total Registriert: ${totalUsers}`);
    console.log(`Studenten: ${totalStudenten}`);
    console.log(`Angestellte: ${totalAngestellte}`);
    console.log(`Wissenschaftliche Mitarbeiter: ${totalWissenschaftliche}`);
    console.log(`Gastdozenten: ${totalGastdozenten}`);
    console.log(`ITSZ: ${totalITSZ}`);
    
    console.log('\n🔍 ANALYSE:');
    console.log('=============');
    
    if (totalWissenschaftliche === 191) {
      console.log('✅ WissenschaftlicheMitarbeiter (191) werden korrekt SEPARAT von Angestellten gezählt!');
    } else {
      console.log(`⚠️ Wissenschaftliche Mitarbeiter: ${totalWissenschaftliche} (erwartet waren 191)`);
    }
    
    if (totalAngestellte > 0) {
      console.log(`✅ Angestellte separat gezählt: ${totalAngestellte} (ohne wissenschaftliche)`);
    } else {
      console.log(`⚠️ Keine direkten Angestellten gefunden`);
    }
    
    if (totalStudenten > 2000) {
      console.log(`✅ Studenten korrekt aus OU übernommen: ${totalStudenten}`);
    } else {
      console.log(`⚠️ Studenten: ${totalStudenten} (erwartet >2000)`);
    }
    
    if (totalUsers > 3000) {
      console.log(`✅ Plausible Gesamtzahl: ${totalUsers} Benutzer`);
    } else {
      console.log(`⚠️ Geringe Gesamtzahl: ${totalUsers} Benutzer`);
    }
    
    // Simuliere die erwartete Ausgabe
    console.log('\n🎯 ERWARTETE DASHBOARD-AUSGABE:');
    console.log('================================');
    console.log(`Neu diesen Monat: +0`);
    console.log(`Studenten: ${totalStudenten} | Angestellte: ${totalAngestellte} | Wissenschaftliche: ${totalWissenschaftliche}`);
    
  } catch (error) {
    console.error('❌ Test-Fehler:', error.message);
  }
}

// Test ausführen
testAngestellteMitMock().then(() => {
  console.log('\n🏁 Mock-Test abgeschlossen');
}).catch(err => {
  console.error('💥 Test fehlgeschlagen:', err);
});
