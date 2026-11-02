
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/db/connect';

async function listDbs() {
  await connectToDatabase();
  if (mongoose.connection.db) {
    try {
      const admin = mongoose.connection.db.admin();
      const dbs = await admin.listDatabases();
      console.log('Available Databases:');
      dbs.databases.forEach((db: any) => console.log(` - ${db.name}`));
    } catch (err: any) {
      console.log('List Databases: FAILED (Insufficient permissions)');
    }
  }
  await mongoose.disconnect();
  process.exit(0);
}

listDbs();
