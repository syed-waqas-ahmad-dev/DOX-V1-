/**
 * @file scripts/run-migrations.ts
 * @description Standalone entry point for database migrations.
 */
import { runMigrations } from '../lib/db/migrate';
import { disconnectFromDatabase } from '../lib/db/connect';

async function main() {
  console.log('🚀 Starting OX Shoes Pakistan Database Migrations...');
  
  try {
    const report = await runMigrations();
    
    console.log('\n--- Migration Report ---');
    console.log(`Total Registered: ${report.totalRegistered}`);
    console.log(`Already Applied:  ${report.alreadyApplied}`);
    console.log(`Newly Applied:    ${report.newlyApplied.length}`);
    
    if (report.newlyApplied.length > 0) {
      console.log('Applied Migrations:', report.newlyApplied.join(', '));
    }
    
    if (report.success) {
      console.log('\n✅ Migrations completed successfully.');
      process.exitCode = 0;
    } else {
      console.error('\n❌ Migrations failed with errors:');
      report.errors?.forEach(err => console.error(` - ${err}`));
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    console.error('\n💥 Critical Migration Failure:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    try {
      console.log('🔌 Closing database connections...');
      await disconnectFromDatabase();
      console.log('👋 Teardown complete.');
    } catch (cleanupErr) {
      console.warn('⚠️  Cleanup error during teardown:', cleanupErr);
    }
  }
}

main().catch(err => {
  console.error('Unhandled process error:', err);
  process.exit(1);
});
