'use server';

/**
 * @file actions/delivery.actions.ts
 * @description Enterprise Delivery Partner and Fleet Dispatch Server Actions for OX Shoes.
 * Supports private courier fleet with 100% Free stack (MongoDB, Haversine, Leaflet).
 * Strict TypeScript: ZERO `any`.
 */

import { connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { DeliveryPartner } from '@/models/DeliveryPartner';
import { DeliveryAssignment } from '@/models/DeliveryAssignment';
import { DeliveryLog } from '@/models/DeliveryLog';
import { Order } from '@/models/Order';
import { MockDb } from '@/lib/db/mock-store';
import {
  DeliveryPartnerStatus,
  DeliveryAssignmentStatus,
  OrderStatus,
  PaymentStatus,
  type IDeliveryPartner,
  type IDeliveryAssignment,
  type IDeliveryLog,
  type CreateDeliveryPartnerInput,
  type UpdateDeliveryPartnerInput,
  type AssignOrderInput,
  type UpdateAssignmentStatusInput,
} from '@/types';
import { successResponse, errorResponse, type ActionResult } from '@/lib/response';
import { handleActionError } from '@/lib/error-handler';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

declare module '@/types' {
  interface IOrder {
    lastUpdatedBy?: string;
  }
}

async function getUpdaterId(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.id || 'system-admin';
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  Peshawar: [34.0151, 71.5249],
  Lahore: [31.5204, 74.3587],
  Islamabad: [33.6844, 73.0479],
  Rawalpindi: [33.5651, 73.0169],
  Karachi: [24.8607, 67.0011],
  Faisalabad: [31.4504, 73.135],
  Multan: [30.1575, 71.5249],
  Sialkot: [32.4945, 74.5229],
  Gujranwala: [32.1877, 74.1945],
  Hyderabad: [25.396, 68.3578],
  Quetta: [30.1798, 66.975],
  Mardan: [34.1989, 72.0404],
  Abbottabad: [34.1688, 73.2215],
};

/**
 * Free Haversine Distance calculation in kilometers
 */
export async function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Normalize Pakistani phone numbers: 03001234567 or +923001234567
 */
function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '');
  if (digits.startsWith('923')) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return '0' + digits;
  }
  return digits;
}

/* ==========================================================================
   PARTNER CRUD (ADMIN)
   ========================================================================== */

export async function getAllDeliveryPartners(filters?: {
  city?: string;
  status?: string;
  search?: string;
}): Promise<ActionResult<IDeliveryPartner[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockPartners = MockDb.getDeliveryPartners(filters);
      return successResponse(mockPartners, 'Delivery partners fetched from store.');
    }

    const query: Record<string, unknown> = { isDeleted: false };
    if (filters?.city && filters.city !== 'all') {
      query.city = filters.city;
    }
    if (filters?.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters?.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { bikeNumber: regex }, { area: regex }];
    }

    const partners = await DeliveryPartner.find(query).sort({ createdAt: -1 }).lean();
    return successResponse(JSON.parse(JSON.stringify(partners)), 'Delivery partners retrieved.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getDeliveryPartnerById(id: string): Promise<ActionResult<IDeliveryPartner | null>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const partner = MockDb.getDeliveryPartnerById(id);
      return successResponse(partner, 'Delivery partner retrieved.');
    }

    const partner = await DeliveryPartner.findOne({ _id: id, isDeleted: false }).lean();
    return successResponse(partner as unknown as IDeliveryPartner | null, 'Delivery partner retrieved.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function createDeliveryPartner(
  input: CreateDeliveryPartnerInput
): Promise<ActionResult<IDeliveryPartner>> {
  try {
    if (!input.name?.trim() || !input.phone?.trim() || !input.password?.trim()) {
      return errorResponse('Name, Phone number, and Password are required.');
    }

    const cleanPhone = normalizePhone(input.phone);
    const coords = CITY_COORDINATES[input.city] || [34.0151, 71.5249];

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const existing = MockDb.getDeliveryPartnerByPhone(cleanPhone);
      if (existing) {
        return errorResponse(`A delivery partner with phone ${cleanPhone} already exists.`);
      }

      const newMock = MockDb.createDeliveryPartner({
        name: input.name.trim(),
        phone: cleanPhone,
        cnic: input.cnic?.trim() || '17301-0000000-1',
        bikeNumber: input.bikeNumber?.trim().toUpperCase() || 'KPK-1234',
        password: input.password,
        area: input.area?.trim() || 'City Center',
        city: input.city || 'Peshawar',
        photo: input.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        currentLat: coords[0] + (Math.random() - 0.5) * 0.05,
        currentLng: coords[1] + (Math.random() - 0.5) * 0.05,
        createdByAdminId: input.adminId || 'super-admin',
      });

      return successResponse(newMock, `Delivery Partner ${newMock.name} created successfully.`);
    }

    const existing = await DeliveryPartner.findOne({ phone: cleanPhone, isDeleted: false });
    if (existing) {
      return errorResponse(`A delivery partner with phone ${cleanPhone} already exists.`);
    }

    const partner = await DeliveryPartner.create({
      name: input.name.trim(),
      phone: cleanPhone,
      cnic: input.cnic?.trim() || '17301-0000000-1',
      bikeNumber: input.bikeNumber?.trim().toUpperCase() || 'KPK-1234',
      password: input.password,
      area: input.area?.trim() || 'City Center',
      city: input.city || 'Peshawar',
      photo: input.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      currentLat: coords[0] + (Math.random() - 0.5) * 0.05,
      currentLng: coords[1] + (Math.random() - 0.5) * 0.05,
      lastLocationUpdate: new Date(),
      status: DeliveryPartnerStatus.ACTIVE,
      createdByAdminId: input.adminId || 'super-admin',
    });

    const partnerObj = partner.toObject();
    delete partnerObj.password;
    return successResponse(partnerObj as unknown as IDeliveryPartner, `Delivery partner ${partner.name} registered.`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateDeliveryPartner(
  input: UpdateDeliveryPartnerInput
): Promise<ActionResult<IDeliveryPartner>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const updated = MockDb.updateDeliveryPartner(input.id, input);
      if (!updated) return errorResponse('Delivery partner not found.');
      return successResponse(updated, 'Delivery partner updated successfully.');
    }

    const partner = await DeliveryPartner.findById(input.id);
    if (!partner || partner.isDeleted) {
      return errorResponse('Delivery partner not found.');
    }

    if (input.name) partner.name = input.name.trim();
    if (input.phone) partner.phone = normalizePhone(input.phone);
    if (input.cnic) partner.cnic = input.cnic.trim();
    if (input.bikeNumber) partner.bikeNumber = input.bikeNumber.trim().toUpperCase();
    if (input.area) partner.area = input.area.trim();
    if (input.city) partner.city = input.city.trim();
    if (input.status) partner.status = input.status;
    if (input.photo) partner.photo = input.photo;
    if (input.password && input.password.trim()) {
      partner.password = input.password.trim();
    }
    if (typeof input.walletDelta === 'number') {
      partner.walletBalance = Math.max(0, (partner.walletBalance || 0) + input.walletDelta);
    }
    if (input.resetCod) {
      partner.codCollectedBalance = 0;
    }

    await partner.save();
    const partnerObj = partner.toObject();
    delete partnerObj.password;
    return successResponse(partnerObj as unknown as IDeliveryPartner, 'Delivery partner updated.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteDeliveryPartner(id: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const ok = MockDb.deleteDeliveryPartner(id);
      return ok ? successResponse({ success: true }, 'Partner deactivated.') : errorResponse('Partner not found.');
    }

    await DeliveryPartner.findByIdAndUpdate(id, { isDeleted: true, status: DeliveryPartnerStatus.INACTIVE });
    return successResponse({ success: true }, 'Delivery partner deactivated (soft delete).');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function markCodReceivedInOffice(partnerId: string): Promise<ActionResult<{ amountCleared: number }>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const partner = MockDb.getDeliveryPartnerById(partnerId);
      if (!partner) return errorResponse('Partner not found.');
      const amount = partner.codCollectedBalance || 0;
      MockDb.updateDeliveryPartner(partnerId, { resetCod: true });
      return successResponse({ amountCleared: amount }, `PKR ${amount.toLocaleString()} marked as received in office.`);
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) return errorResponse('Partner not found.');
    const amount = partner.codCollectedBalance || 0;
    partner.codCollectedBalance = 0;
    await partner.save();

    return successResponse({ amountCleared: amount }, `PKR ${amount.toLocaleString()} marked as received in office.`);
  } catch (error) {
    return handleActionError(error);
  }
}

/* ==========================================================================
   ORDER ASSIGNMENT SYSTEM (ADMIN & DISPATCH)
   ========================================================================== */

export async function getActiveRidersForCity(city: string): Promise<ActionResult<Array<IDeliveryPartner & { distanceKm?: number }>>> {
  try {
    await connectToDatabase();
    const cityCoords = CITY_COORDINATES[city] || [34.0151, 71.5249];

    if (!isDatabaseConnected()) {
      const riders = MockDb.getDeliveryPartners({ city, status: DeliveryPartnerStatus.ACTIVE });
      const enriched = await Promise.all(
        riders.map(async (r) => {
          const lat = r.currentLat || cityCoords[0];
          const lng = r.currentLng || cityCoords[1];
          const distanceKm = await calculateHaversineDistance(cityCoords[0], cityCoords[1], lat, lng);
          return { ...r, distanceKm };
        })
      );
      enriched.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
      return successResponse(enriched, 'Active riders retrieved.');
    }

    const riders = await DeliveryPartner.find({
      city,
      status: DeliveryPartnerStatus.ACTIVE,
      isDeleted: false,
    }).lean();

    const enriched = await Promise.all(
      riders.map(async (r) => {
        const lat = r.currentLat || cityCoords[0];
        const lng = r.currentLng || cityCoords[1];
        const distanceKm = await calculateHaversineDistance(cityCoords[0], cityCoords[1], lat, lng);
        return { ...(r as unknown as IDeliveryPartner), distanceKm };
      })
    );
    enriched.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    return successResponse(enriched, 'Active riders in city retrieved.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function assignOrderToPartner(
  input: AssignOrderInput
): Promise<ActionResult<IDeliveryAssignment>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const order = MockDb.getOrderById(input.orderId);
      const partner = MockDb.getDeliveryPartnerById(input.partnerId);

      if (!order) return errorResponse('Order not found.');
      if (!partner) return errorResponse('Delivery partner not found.');
      if ((order.version ?? 0) !== input.expectedVersion) return errorResponse('This was updated by someone else, please refresh');

      const shipAddr = order.shippingAddress as unknown as Record<string, string> | undefined;
      const assignment = MockDb.createDeliveryAssignment({
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        partnerId: partner._id.toString(),
        partnerName: partner.name,
        partnerPhone: partner.phone,
        status: DeliveryAssignmentStatus.ASSIGNED,
        codAmount: order.paymentStatus === PaymentStatus.PAID ? 0 : order.totalAmount || 0,
        codCollected: false,
        deliveryAddress: `${shipAddr?.street || shipAddr?.address || ''}, ${shipAddr?.city || partner.city}`,
        city: shipAddr?.city || partner.city,
        customerName: shipAddr?.fullName || 'Customer',
        customerPhone: shipAddr?.phone || '',
        assignedAt: new Date().toISOString(),
        assignedByAdmin: input.adminId || 'Super Admin',
      });

      // Update order status in mock store
      MockDb.updateOrderStatus(order._id.toString(), {
        status: OrderStatus.SHIPPED,
        trackingNumber: `OX-RIDER-${partner.phone.slice(-4)}-${order.orderNumber.replace(/\D/g, '').slice(-4)}`,
        version: (order.version ?? 0) + 1,
      });

      return successResponse(assignment, `Order ${order.orderNumber} assigned to ${partner.name}.`);
    }

    const [order, partner] = await Promise.all([
      Order.findById(input.orderId),
      DeliveryPartner.findById(input.partnerId),
    ]);

    if (!order) return errorResponse('Order not found.');
    if (!partner || partner.isDeleted) return errorResponse('Delivery partner not found.');
    if ((order.version ?? 0) !== input.expectedVersion) return errorResponse('This was updated by someone else, please refresh');

    const shipAddr = order.shippingAddress as unknown as Record<string, string> | undefined;

    // Check if assignment already exists
    let assignment = await DeliveryAssignment.findOne({ orderId: order._id });
    if (assignment) {
      assignment.partnerId = partner._id;
      assignment.partnerName = partner.name;
      assignment.partnerPhone = partner.phone;
      assignment.status = DeliveryAssignmentStatus.ASSIGNED;
      assignment.assignedAt = new Date();
      assignment.assignedByAdmin = input.adminId || 'Super Admin';
      await assignment.save();
    } else {
      assignment = await DeliveryAssignment.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        partnerId: partner._id,
        partnerName: partner.name,
        partnerPhone: partner.phone,
        status: DeliveryAssignmentStatus.ASSIGNED,
        codAmount: order.paymentStatus === PaymentStatus.PAID ? 0 : order.totalAmount || 0,
        codCollected: false,
        deliveryAddress: `${shipAddr?.street || ''}, ${shipAddr?.city || partner.city}`,
        city: shipAddr?.city || partner.city,
        customerName: shipAddr?.fullName || 'Customer',
        customerPhone: shipAddr?.phone || '',
        assignedAt: new Date(),
        assignedByAdmin: input.adminId || 'Super Admin',
      });
    }

    // Update order status & courier info
    order.status = OrderStatus.SHIPPED;
    order.courier = `OX Express Rider (${partner.name})`;
    order.trackingNumber = `OX-RIDER-${partner.phone.slice(-4)}-${order.orderNumber.replace(/\D/g, '').slice(-4)}`;
    order.version = (order.version ?? 0) + 1;
    const updaterId = await getUpdaterId();
    order.lastUpdatedBy = updaterId;
    await order.save();

    // Create log entry
    await DeliveryLog.create({
      assignmentId: assignment._id,
      partnerId: partner._id,
      status: 'Assigned to Rider',
      note: `Assigned to ${partner.name} by ${input.adminId || 'Super Admin'}`,
    });

    return successResponse(
      assignment.toObject() as unknown as IDeliveryAssignment,
      `Order ${order.orderNumber} assigned to ${partner.name}.`
    );
  } catch (error) {
    return handleActionError(error);
  }
}

export async function reassignOrder(
  assignmentId: string,
  newPartnerId: string,
  expectedVersion: number,
  adminId?: string
): Promise<ActionResult<IDeliveryAssignment>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignment = MockDb.getDeliveryAssignmentById(assignmentId);
      const order = assignment ? MockDb.getOrderById(assignment.orderId.toString()) : null;
      if (!order) return errorResponse('Order not found');
      if ((order.version ?? 0) !== expectedVersion) return errorResponse('This was updated by someone else, please refresh');

      const updated = MockDb.reassignDeliveryAssignment(assignmentId, newPartnerId);
      if (!updated) return errorResponse('Assignment not found.');
      return successResponse(updated, 'Order reassigned to new partner.');
    }

    const [assignment, newPartner] = await Promise.all([
      DeliveryAssignment.findById(assignmentId),
      DeliveryPartner.findById(newPartnerId),
    ]);

    if (!assignment) return errorResponse('Assignment record not found.');
    if (!newPartner || newPartner.isDeleted) return errorResponse('New partner not found.');
    
    const order = await Order.findById(assignment.orderId);
    if (!order) return errorResponse('Order not found.');
    if ((order.version ?? 0) !== expectedVersion) return errorResponse('This was updated by someone else, please refresh');

    const oldPartnerName = assignment.partnerName;
    assignment.partnerId = newPartner._id;
    assignment.partnerName = newPartner.name;
    assignment.partnerPhone = newPartner.phone;
    assignment.status = DeliveryAssignmentStatus.ASSIGNED;
    assignment.assignedAt = new Date();
    assignment.assignedByAdmin = adminId || 'Super Admin';
    const updaterId = await getUpdaterId();
    order.version = (order.version ?? 0) + 1;
    order.lastUpdatedBy = updaterId;
    await order.save();
    await assignment.save();

    await DeliveryLog.create({
      assignmentId: assignment._id,
      partnerId: newPartner._id,
      status: 'Reassigned',
      note: `Reassigned from ${oldPartnerName} to ${newPartner.name}`,
    });

    return successResponse(
      assignment.toObject() as unknown as IDeliveryAssignment,
      `Order reassigned to ${newPartner.name}.`
    );
  } catch (error) {
    return handleActionError(error);
  }
}

export async function unassignOrder(assignmentId: string, expectedVersion: number): Promise<ActionResult<{ success: boolean }>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignment = MockDb.getDeliveryAssignmentById(assignmentId);
      const order = assignment ? MockDb.getOrderById(assignment.orderId.toString()) : null;
      if (!order) return errorResponse('Order not found');
      if ((order.version ?? 0) !== expectedVersion) return errorResponse('This was updated by someone else, please refresh');

      MockDb.deleteDeliveryAssignment(assignmentId);
      return successResponse({ success: true }, 'Order unassigned successfully.');
    }

    const assignment = await DeliveryAssignment.findById(assignmentId);
    if (!assignment) return errorResponse('Assignment not found.');
    
    const order = await Order.findById(assignment.orderId);
    if (!order) return errorResponse('Order not found.');
    if ((order.version ?? 0) !== expectedVersion) return errorResponse('This was updated by someone else, please refresh');

    // Revert order status if found
    const updaterId = await getUpdaterId();
    order.version = (order.version ?? 0) + 1;
    order.lastUpdatedBy = updaterId;
    await order.save();
    await Order.findByIdAndUpdate(assignment.orderId, {
      status: OrderStatus.PROCESSING,
      courier: 'TCS',
    });

    await DeliveryAssignment.findByIdAndDelete(assignmentId);
    return successResponse({ success: true }, 'Order unassigned.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getAllDeliveryAssignments(filters?: {
  status?: string;
  partnerId?: string;
  city?: string;
  search?: string;
}): Promise<ActionResult<IDeliveryAssignment[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignments = MockDb.getDeliveryAssignments(filters);
      return successResponse(assignments, 'Delivery assignments retrieved.');
    }

    const query: Record<string, unknown> = {};
    if (filters?.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters?.partnerId && filters.partnerId !== 'all') {
      query.partnerId = filters.partnerId;
    }
    if (filters?.city && filters.city !== 'all') {
      query.city = filters.city;
    }
    if (filters?.search) {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [
        { orderNumber: regex },
        { customerName: regex },
        { customerPhone: regex },
        { partnerName: regex },
        { deliveryAddress: regex },
      ];
    }

    const list = await DeliveryAssignment.find(query).sort({ assignedAt: -1 }).lean();
    return successResponse(JSON.parse(JSON.stringify(list)), 'Delivery assignments retrieved.');
  } catch (error) {
    return handleActionError(error);
  }
}

/* ==========================================================================
   RIDER PORTAL & MOBILE ACTIONS (/delivery)
   ========================================================================== */

export async function riderLogin(phone: string, password: string): Promise<ActionResult<IDeliveryPartner>> {
  try {
    if (!phone?.trim() || !password?.trim()) {
      return errorResponse('Mobile phone and password are required.');
    }

    const cleanPhone = normalizePhone(phone);
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const partner = MockDb.getDeliveryPartnerByPhone(cleanPhone);
      if (!partner) {
        return errorResponse('No delivery partner account found with this phone number. Please contact Admin.');
      }
      if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
        return errorResponse('Your delivery partner account is currently deactivated. Please contact dispatch office.');
      }
      // Demo password check
      if (partner.password && partner.password !== password && !bcrypt.compareSync(password, partner.password)) {
        return errorResponse('Incorrect password for rider login.');
      }

      const safePartner = { ...partner };
      delete safePartner.password;
      return successResponse(safePartner, `Welcome, ${safePartner.name}!`);
    }

    const partner = await DeliveryPartner.findOne({ phone: cleanPhone, isDeleted: false }).select('+password');
    if (!partner) {
      return errorResponse('No delivery partner account found with this phone number. Please contact Admin.');
    }

    if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
      return errorResponse('Your delivery partner account is deactivated. Please contact dispatch office.');
    }

    const isMatch = await partner.comparePassword(password);
    if (!isMatch && partner.password !== password) {
      return errorResponse('Incorrect password for rider login.');
    }

    const safePartner = partner.toObject();
    delete safePartner.password;
    return successResponse(safePartner as unknown as IDeliveryPartner, `Welcome, ${partner.name}!`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getRiderAssignments(partnerId: string): Promise<ActionResult<IDeliveryAssignment[]>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignments = MockDb.getDeliveryAssignments({ partnerId });
      return successResponse(assignments, 'Rider assignments retrieved.');
    }

    const assignments = await DeliveryAssignment.find({ partnerId }).sort({ assignedAt: -1 }).lean();
    return successResponse(assignments as unknown as IDeliveryAssignment[], 'Rider assignments retrieved.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateRiderAssignmentStatus(
  input: UpdateAssignmentStatusInput
): Promise<ActionResult<IDeliveryAssignment>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignment = MockDb.updateDeliveryAssignmentStatus(input.assignmentId, input);
      if (!assignment) return errorResponse('Assignment not found.');

      // If delivered, update order status and partner COD balance
      if (input.status === DeliveryAssignmentStatus.DELIVERED) {
        MockDb.updateOrderStatus(assignment.orderId.toString(), {
          status: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
        });
        const partner = MockDb.getDeliveryPartnerById(input.partnerId);
        if (partner) {
          MockDb.updateDeliveryPartner(input.partnerId, {
            walletDelta: 150, // PKR 150 delivery bonus per package
          });
          partner.codCollectedBalance = (partner.codCollectedBalance || 0) + (assignment.codAmount || 0);
          partner.totalDeliveries = (partner.totalDeliveries || 0) + 1;
        }
      } else if (input.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
        MockDb.updateOrderStatus(assignment.orderId.toString(), {
          status: OrderStatus.OUT_FOR_DELIVERY,
        });
      }

      return successResponse(assignment, `Assignment status updated to ${input.status}.`);
    }

    const assignment = await DeliveryAssignment.findById(input.assignmentId);
    if (!assignment) return errorResponse('Assignment not found.');

    assignment.status = input.status;

    if (input.status === DeliveryAssignmentStatus.PICKED) {
      assignment.pickedAt = new Date();
    } else if (input.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
      assignment.outForDeliveryAt = new Date();
      await Order.findByIdAndUpdate(assignment.orderId, { status: OrderStatus.OUT_FOR_DELIVERY });
    } else if (input.status === DeliveryAssignmentStatus.DELIVERED) {
      assignment.deliveredAt = new Date();
      assignment.codCollected = true;
      if (input.photoUrl) assignment.proofPhotoUrl = input.photoUrl;
      if (input.note) assignment.deliveryNotes = input.note;

      // Update Order
      await Order.findByIdAndUpdate(assignment.orderId, {
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      });

      // Update Partner metrics
      await DeliveryPartner.findByIdAndUpdate(input.partnerId, {
        $inc: {
          totalDeliveries: 1,
          walletBalance: 150, // PKR 150 delivery commission credited to wallet
          codCollectedBalance: assignment.codAmount || 0,
        },
      });
    } else if (input.status === DeliveryAssignmentStatus.FAILED) {
      assignment.failedAt = new Date();
      assignment.failureReason = input.failureReason || 'Customer unavailable';
      if (input.note) assignment.deliveryNotes = input.note;
    }

    await assignment.save();

    // Log the event
    await DeliveryLog.create({
      assignmentId: assignment._id,
      partnerId: input.partnerId,
      status: input.status,
      lat: input.lat,
      lng: input.lng,
      note: input.note || input.failureReason,
      photoUrl: input.photoUrl,
    });

    return successResponse(
      assignment.toObject() as unknown as IDeliveryAssignment,
      `Order status updated to ${input.status}.`
    );
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateRiderLocation(
  partnerId: string,
  lat: number,
  lng: number
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      MockDb.updateDeliveryPartner(partnerId, { currentLat: lat, currentLng: lng });
      return successResponse({ success: true }, 'Location updated.');
    }

    await DeliveryPartner.findByIdAndUpdate(partnerId, {
      currentLat: lat,
      currentLng: lng,
      lastLocationUpdate: new Date(),
    });

    return successResponse({ success: true }, 'Rider location updated.');
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getDeliveryDashboardMetrics(): Promise<
  ActionResult<{
    totalPartners: number;
    activePartners: number;
    totalAssignments: number;
    deliveredCount: number;
    outForDeliveryCount: number;
    failedCount: number;
    totalCodInTransit: number;
  }>
> {
  try {
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const partners = MockDb.getDeliveryPartners({});
      const assignments = MockDb.getDeliveryAssignments({});
      const activePartners = partners.filter((p) => p.status === DeliveryPartnerStatus.ACTIVE).length;
      const deliveredCount = assignments.filter((a) => a.status === DeliveryAssignmentStatus.DELIVERED).length;
      const outForDeliveryCount = assignments.filter((a) => a.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY).length;
      const failedCount = assignments.filter((a) => a.status === DeliveryAssignmentStatus.FAILED).length;
      const totalCodInTransit = partners.reduce((sum, p) => sum + (p.codCollectedBalance || 0), 0);

      return successResponse(
        {
          totalPartners: partners.length,
          activePartners,
          totalAssignments: assignments.length,
          deliveredCount,
          outForDeliveryCount,
          failedCount,
          totalCodInTransit,
        },
        'Delivery metrics retrieved.'
      );
    }

    const [totalPartners, activePartners, assignments, partners] = await Promise.all([
      DeliveryPartner.countDocuments({ isDeleted: false }),
      DeliveryPartner.countDocuments({ status: DeliveryPartnerStatus.ACTIVE, isDeleted: false }),
      DeliveryAssignment.find({}).lean(),
      DeliveryPartner.find({ isDeleted: false }, { codCollectedBalance: 1 }).lean(),
    ]);

    const deliveredCount = assignments.filter((a) => a.status === DeliveryAssignmentStatus.DELIVERED).length;
    const outForDeliveryCount = assignments.filter((a) => a.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY).length;
    const failedCount = assignments.filter((a) => a.status === DeliveryAssignmentStatus.FAILED).length;
    const totalCodInTransit = partners.reduce((sum, p) => sum + (p.codCollectedBalance || 0), 0);

    return successResponse(
      {
        totalPartners,
        activePartners,
        totalAssignments: assignments.length,
        deliveredCount,
        outForDeliveryCount,
        failedCount,
        totalCodInTransit,
      },
      'Delivery metrics retrieved.'
    );
  } catch (error) {
    return handleActionError(error);
  }
}
