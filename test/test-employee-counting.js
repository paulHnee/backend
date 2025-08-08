#!/usr/bin/env node

/**
 * Test für korrigierte Angestellten-Zählung im Monitoring Controller
 * 
 * Testet die Logik zur Kategorisierung und Zählung von:
 * - Wissenschaftlichen Mitarbeitern (als Teil der Angestellten)
 * - Regulären Angestellten
 * - Kombination beider Gruppen für Gesamtzahl
 */

// Mock-Gruppendaten simulieren
const mockGroups = [
  { name: 'Studenten', memberCount: 2940 },
  { name: 'WissenschaftlicheMitarbeiter', memberCount: 191 },
  { name: 'Angestellte', memberCount: 85 },
  { name: 'Gastdozenten', memberCount: 12 },
  { name: 'ITSZadmins', memberCount: 5 }
];

// Gruppenmuster (aus monitoringController.js kopiert)
const studentenGroups = ['Studenten', 'Studierende', 'studenten', 'student'];
const angestellteGroups = ['Angestellte', 'Mitarbeiter', 'Beschaeftigte', 'mitarbeiter', 'personal', 'wissenschaftliche', 'WissenschaftlicheMitarbeiter', 'wissenschaftlich'];
const gastdozentenGroups = ['Gastdozenten', 'GastDozenten', 'gastdozenten', 'dozent'];
const itszGroups = ['ITSZadmins', 'IT-Mitarbeiter', 'itsz', 'ITSZ'];

// Zähler initialisieren
let totalStudenten = 0;
let totalAngestellte = 0;
let totalWissenschaftliche = 0;
let totalGastdozenten = 0;
let totalITSZ = 0;

console.log('🧪 Teste korrigierte Angestellten-Zählung...\n');

// Iteriere durch Mock-Gruppen (simuliert die korrigierte Logik)
for (const group of mockGroups) {
  const groupNameLower = group.name.toLowerCase();
  
  // Studenten-Gruppen identifizieren und zählen
  if (studentenGroups.some(sg => groupNameLower.includes(sg.toLowerCase()))) {
    totalStudenten += group.memberCount || 0;
    console.log(`📚 Studenten-Gruppe: ${group.name} = ${group.memberCount}`);
  }
  
  // Angestellte-Gruppen identifizieren und zählen (inkl. alle Mitarbeitertypen)
  if (angestellteGroups.some(ag => groupNameLower.includes(ag.toLowerCase()))) {
    totalAngestellte += group.memberCount || 0;
    console.log(`👥 Angestellte-Gruppe: ${group.name} = ${group.memberCount}`);
    
    // Wissenschaftliche Mitarbeiter separat zählen für Tracking
    if (groupNameLower.includes('wissenschaftliche') || groupNameLower.includes('wissenschaftlichmitarbeiter')) {
      totalWissenschaftliche += group.memberCount || 0;
      console.log(`🔬 → Davon wissenschaftliche: ${group.memberCount}`);
    }
  }
  
  // Gastdozenten-Gruppen identifizieren und zählen
  if (gastdozentenGroups.some(gg => groupNameLower.includes(gg.toLowerCase()))) {
    totalGastdozenten += group.memberCount || 0;
    console.log(`🎓 Gastdozenten-Gruppe: ${group.name} = ${group.memberCount}`);
  }
  
  // ITSZ-Gruppen identifizieren und zählen
  if (itszGroups.some(ig => groupNameLower.includes(ig.toLowerCase()))) {
    totalITSZ += group.memberCount || 0;
    console.log(`🖥️ ITSZ-Gruppe: ${group.name} = ${group.memberCount}`);
  }
}

// Ergebnisse ausgeben
console.log('\n📊 TESTERGEBNISSE:');
console.log('='.repeat(50));
console.log(`Studenten:                    ${totalStudenten}`);
console.log(`Angestellte (gesamt):         ${totalAngestellte}`);
console.log(`  └─ Wissenschaftliche:       ${totalWissenschaftliche}`);
console.log(`  └─ Andere Angestellte:      ${totalAngestellte - totalWissenschaftliche}`);
console.log(`Gastdozenten:                 ${totalGastdozenten}`);
console.log(`ITSZ:                         ${totalITSZ}`);
console.log('='.repeat(50));
console.log(`GESAMTBENUTZER:               ${totalStudenten + totalAngestellte + totalGastdozenten + totalITSZ}`);

// Erwartete vs. tatsächliche Werte prüfen
console.log('\n✅ VALIDIERUNG:');
const expectedAngestellte = 191 + 85; // WissenschaftlicheMitarbeiter + Angestellte
const expectedTotal = 2940 + 276 + 12 + 5; // Studenten + Angestellte + Gastdozenten + ITSZ

if (totalAngestellte === expectedAngestellte) {
  console.log(`✅ Angestellte korrekt: ${totalAngestellte} (erwartet: ${expectedAngestellte})`);
} else {
  console.log(`❌ Angestellte fehlerhaft: ${totalAngestellte} (erwartet: ${expectedAngestellte})`);
}

if (totalWissenschaftliche === 191) {
  console.log(`✅ Wissenschaftliche korrekt: ${totalWissenschaftliche} (erwartet: 191)`);
} else {
  console.log(`❌ Wissenschaftliche fehlerhaft: ${totalWissenschaftliche} (erwartet: 191)`);
}

const actualTotal = totalStudenten + totalAngestellte + totalGastdozenten + totalITSZ;
if (actualTotal === expectedTotal) {
  console.log(`✅ Gesamtzahl korrekt: ${actualTotal} (erwartet: ${expectedTotal})`);
} else {
  console.log(`❌ Gesamtzahl fehlerhaft: ${actualTotal} (erwartet: ${expectedTotal})`);
}

console.log('\n🎯 Frontend sollte jetzt zeigen:');
console.log(`   Studenten: ${totalStudenten}`);
console.log(`   Angestellte: ${totalAngestellte} (statt nur 191)`);
console.log(`   Gastdozenten: ${totalGastdozenten}`);
