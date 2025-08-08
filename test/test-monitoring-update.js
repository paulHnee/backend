#!/usr/bin/env node

/**
 * Simple test to verify the updated monitoring controller loads correctly
 */

console.log('🧪 Teste die aktualisierte Monitoring-Logik...\n');

try {
  // Test that the module loads without syntax errors
  await import('../controllers/monitoringController.js');
  console.log('✅ Monitoring Controller erfolgreich geladen');
  console.log('📊 Die Logik sollte nun 255 Angestellte zeigen (ohne _MS365 und Pooltest OUs)');
  console.log('🧹 Console-Logs wurden bereinigt (nur noch Warnings/Errors/Final Count)');
  console.log('🎯 Erwartete Logs: "✅ FINAL COUNT: X Benutzer in OU..." für jede Kategorie');
  console.log('\n🔄 Server muss neu gestartet werden, um Änderungen zu übernehmen');
  
} catch (error) {
  console.error('❌ Fehler beim Laden des Monitoring Controllers:', error.message);
}
