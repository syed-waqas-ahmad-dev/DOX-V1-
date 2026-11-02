
import mongoose from 'mongoose';
import { connectToDatabase, getConnectionState } from '../lib/db/connect';

async function inspect() {
  console.log('--- OX Shoes DB Infrastructure Inspection ---');
  
  const conn = await connectToDatabase();
  const state = getConnectionState();
  
  console.log(`Connection Status: ${state.status}`);
  console.log(`Ready State:       ${state.readyState}`);
  console.log(`Database Name:     ${state.database}`);
  console.log(`Is Configured:     ${state.isConfigured}`);
  
  if (state.status === 'connected' && mongoose.connection.db) {
    try {
      // Check topology type (Replica Set vs Standalone)
      // admin().serverStatus() requires admin privileges, might fail.
      // We can check connection host count or use isMaster (deprecated) / hello command.
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      console.log(`Topology Type:     ${hello.setName ? 'Replica Set (' + hello.setName + ')' : 'Standalone / Unknown'}`);
      console.log(`Transaction Supp:  ${hello.setName ? 'YES' : 'NO (Transactions require a Replica Set)'}`);
      
      // Check isolation (Staging vs Prod)
      const dbName = mongoose.connection.name;
      const isStaging = dbName.toLowerCase().includes('staging') || dbName.toLowerCase().includes('test') || dbName.toLowerCase().includes('dev');
      console.log(`Environment:       ${isStaging ? 'STAGING / ISOLATED' : 'PRODUCTION / UNKNOWN'}`);
      
    } catch (err: any) {
      console.log(`Topology Check:    FAILED (${err.message})`);
      console.log('Transaction Supp:  UNVERIFIED (Insufficient permissions for topology check)');
    }
  } else if (!state.isConfigured) {
    console.log('Topology Type:     MOCK STORE (No MongoDB URI provided)');
    console.log('Transaction Supp:  NO (Mock store is in-memory only)');
    console.log('Environment:       LOCAL DEVELOPMENT (Preview Sandbox)');
  }

  await mongoose.disconnect();
  process.exit(0);
}

inspect().catch(err => {
  console.error('Inspection Fatal Error:', err);
  process.exit(1);
});
