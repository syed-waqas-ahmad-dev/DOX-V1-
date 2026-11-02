
import { connectToDatabase } from '../lib/db/connect';
import mongoose from 'mongoose';

async function checkIsolation() {
  await connectToDatabase();
  const uri = process.env.MONGODB_URI || '';
  
  // Basic hostname check
  const isAtlas = uri.includes('mongodb.net');
  const isSandbox = uri.includes('sandbox') || uri.includes('dev') || uri.includes('test');
  
  console.log('--- Isolation Evidence ---');
  console.log(`Cluster Type:     ${isAtlas ? 'MongoDB Atlas' : 'Local/Other'}`);
  console.log(`Sandbox Keywords: ${isSandbox ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check if we can see other databases (production would likely restrict this)
  try {
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log(`Accessible DBs:   ${dbs.databases.length}`);
    const hasProd = dbs.databases.some((db: any) => db.name.toLowerCase().includes('prod'));
    console.log(`Prod DB visible:  ${hasProd ? 'YES' : 'NO'}`);
  } catch (e: any) {
    console.log(`Admin Check:      RESTRICTED (${e.message})`);
  }

  await mongoose.disconnect();
}

checkIsolation();
