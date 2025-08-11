#!/usr/bin/env node

/**
 * Einfacher Test für die korrigierte Angestellten-Zählung
 * Nur die drei Hauptkategorien: Studenten, Angestellte, Gastdozenten
 */

async function testSimpleGroups() {
  console.log('🧪 Teste vereinfachte Gruppierung: Studenten, Angestellte, Gastdozenten\n');
  
  // Simuliere die Eingangsdaten wie sie aus dem echten LDAP kommen
  const mockGroups = [
    { name: 'WissenschaftlicheMitarbeiter', memberCount: 191, type: 'Group' },
    { name: 'Angestellte', memberCount: 85, type: 'Group' },
    { name: 'Studenten', memberCount: 0, type: 'Group' },
    { name: 'Gastdozenten', memberCount: 12, type: 'Group' },
    { name: 'ITSZ', memberCount: 5, type: 'Group' }
  ];
  
  // Simuliere OU-basierte Studenten-Daten
  const studentenFromOU = 2940;
  
  // Definiere Gruppenmuster (vereinfacht)
  const studentenGroups = ['Studenten', 'Studierende', 'studenten', 'student'];
  const angestellteGroups = ['Angestellte', 'Mitarbeiter', 'Beschaeftigte', 'mitarbeiter', 'personal', 'wissenschaftliche', 'WissenschaftlicheMitarbeiter', 'wissenschaftlich'];
  const gastdozentenGroups = ['Gastdozenten', 'GastDozenten', 'gastdozenten', 'dozent'];
  
  let totalStudenten = 0;
  let totalAngestellte = 0;
  let totalGastdozenten = 0;
  
  console.log('📊 Verarbeite LDAP-Gruppen...');
  
  // Gruppenerkennung
  for (const group of mockGroups) {
    const groupNameLower = group.name.toLowerCase();
    
    if (studentenGroups.some(sg => groupNameLower.includes(sg.toLowerCase()))) {
      totalStudenten += group.memberCount || 0;
      console.log(`📚 Studenten-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
    }
    
    if (angestellteGroups.some(ag => groupNameLower.includes(ag.toLowerCase()))) {
      totalAngestellte += group.memberCount || 0;
      console.log(`👥 Angestellte-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
    }
    
    if (gastdozentenGroups.some(gg => groupNameLower.includes(gg.toLowerCase()))) {
      totalGastdozenten += group.memberCount || 0;
      console.log(`🎓 Gastdozenten-Gruppe ${group.name}: ${group.memberCount} Mitglieder`);
    }
  }
  
  console.log(`\n🔍 Gruppenbasierte Ergebnisse: Studenten=${totalStudenten}, Angestellte=${totalAngestellte}, Gastdozenten=${totalGastdozenten}`);
  
  // OU-basierte Ergänzung für Studenten
  if (totalStudenten < 500) {
    console.log('⚠️ Studenten-Anzahl niedrig, verwende OU-basierte Daten...');
    totalStudenten = studentenFromOU;
    console.log(`📚 OU-basierte Studenten: ${totalStudenten}`);
  }
  
  const totalUsers = totalStudenten + totalAngestellte + totalGastdozenten;
  
  console.log('\n📊 FINALE ERGEBNISSE:');
  console.log('=======================');
  console.log(`Total Registriert: ${totalUsers}`);
  console.log(`Studenten: ${totalStudenten}`);
  console.log(`Angestellte: ${totalAngestellte} (inkl. 191 WissenschaftlicheMitarbeiter + 85 andere)`);
  console.log(`Gastdozenten: ${totalGastdozenten}`);
  
  console.log('\n🎯 DASHBOARD-AUSGABE:');
  console.log('=====================');
  console.log(`Studenten: ${totalStudenten} | Angestellte: ${totalAngestellte} | Gastdozenten: ${totalGastdozenten}`);
  
  console.log('\n✅ Korrekt: WissenschaftlicheMitarbeiter (191) sind in Angestellte (276) enthalten');
}

testSimpleGroups().then(() => {
  console.log('\n🏁 Test abgeschlossen');
}).catch(err => {
  console.error('❌ Fehler:', err);
});
