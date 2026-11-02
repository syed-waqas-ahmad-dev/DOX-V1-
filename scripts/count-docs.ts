
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/db/connect';
import { DeliveryPartner } from '../models/DeliveryPartner';
import { Order } from '../models/Order';
import { DeliveryAssignment } from '../models/DeliveryAssignment';

async function countDocs() {
  await connectToDatabase();
  console.log('--- Database Record Counts ---');
  try {
    const partners = await DeliveryPartner.countDocuments({});
    const orders = await Order.countDocuments({});
    const assignments = await DeliveryAssignment.countDocuments({});
    
    console.log(`Delivery Partners:  ${partners}`);
    console.log(`Orders:             ${orders}`);
    console.log(`Assignments:        ${assignments}`);
    
    if (partners > 0) {
      const sample = await DeliveryPartner.findOne({}).lean();
      console.log(`Sample Partner:     ${sample?.name} (${sample?.city})`);
    }
  } catch (err: any) {
    console.log(`Record Count FAILED: ${err.message}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

countDocs();
