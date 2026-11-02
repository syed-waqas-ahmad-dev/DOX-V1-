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
import mongoose, { Types } from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isElevatedAdminRole } from '@/lib/auth-guard';
import crypto from 'crypto';
import { cookies } from 'next/headers';

declare module '@/types' {
  interface IOrder {
    lastUpdatedBy?: string;
  }
}

import {
  RIDER_COOKIE_NAME,
  RIDER_SESSION_TTL_MS,
  type RiderSessionPayload,
  signRiderPayload,
  verifyRiderToken,
} from '@/lib/rider-auth';

/* ==========================================================================
   INTERNAL AUTHORIZATION GATEKEEPERS (FAIL-CLOSED)
   ========================================================================== */

/**
 * Private helper to verify elevated administrative clearance (SUPER_ADMIN or ADMIN).
 * Obtains session exclusively from getServerSession(authOptions).
 * MANAGER, RIDER, CUSTOMER, and unauthenticated callers are strictly denied.
 */
async function verifyDeliveryAdminAuth(): Promise<{
  authorized: boolean;
  adminId: string | null;
  adminName: string | null;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isElevatedAdminRole((session.user as { role?: string }).role)) {
      return { authorized: false, adminId: null, adminName: null };
    }
    return {
      authorized: true,
      adminId: session.user.id || null,
      adminName: session.user.name || session.user.email || 'Admin',
    };
  } catch {
    return { authorized: false, adminId: null, adminName: null };
  }
}

/**
 * Private helper to authenticate rider operations.
 * Allows:
 *   1. Elevated Admin (super_admin or admin) - system dispatch clearance.
 *   2. Authenticated Rider possessing a valid signed session cookie matching target partnerId.
 *   3. Authenticated NextAuth session with role 'rider' matching target partnerId.
 * Strictly denies: unauthenticated callers, customers, managers, or riders targeting another rider's ID.
 */
async function verifyRiderOrAdminAuth(targetPartnerId?: string): Promise<{
  authorized: boolean;
  isAdmin: boolean;
  actorId: string | null;
  partnerId: string | null;
}> {
  try {
    // 1. Check if caller is elevated admin
    const adminAuth = await verifyDeliveryAdminAuth();
    if (adminAuth.authorized) {
      return {
        authorized: true,
        isAdmin: true,
        actorId: adminAuth.adminId,
        partnerId: targetPartnerId || null,
      };
    }

    // Determine rider partner ID from NextAuth session or signed rider session cookie
    let resolvedRiderId: string | null = null;

    // 2. Check NextAuth session for rider role
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { role?: string }).role === 'rider') {
      resolvedRiderId = session.user.id;
    }

    // 3. Check secure HTTP-only rider session cookie
    if (!resolvedRiderId) {
      let token: string | undefined;
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(RIDER_COOKIE_NAME)?.value;
      } catch {
        token = undefined;
      }

      if (token) {
        const payload = verifyRiderToken(token);
        if (payload && payload.partnerId) {
          resolvedRiderId = payload.partnerId;
        }
      }
    }

    if (!resolvedRiderId) {
      return { authorized: false, isAdmin: false, actorId: null, partnerId: null };
    }

    // If caller targeted a specific partnerId, ensure caller owns that ID
    if (targetPartnerId && targetPartnerId.trim() !== resolvedRiderId) {
      return { authorized: false, isAdmin: false, actorId: null, partnerId: null };
    }

    // 4. Verify current DeliveryPartner DB or mock record active and non-deleted status
    await connectToDatabase();
    if (isDatabaseConnected()) {
      const partnerDoc = await DeliveryPartner.findOne({
        _id: resolvedRiderId,
        isDeleted: false,
      }).lean();
      if (!partnerDoc || partnerDoc.status !== DeliveryPartnerStatus.ACTIVE) {
        return { authorized: false, isAdmin: false, actorId: null, partnerId: null };
      }
    } else {
      const mockPartner = MockDb.getDeliveryPartnerById(resolvedRiderId);
      if (!mockPartner || mockPartner.isDeleted || mockPartner.status !== DeliveryPartnerStatus.ACTIVE) {
        return { authorized: false, isAdmin: false, actorId: null, partnerId: null };
      }
    }

    return {
      authorized: true,
      isAdmin: false,
      actorId: resolvedRiderId,
      partnerId: resolvedRiderId,
    };
  } catch {
    return { authorized: false, isAdmin: false, actorId: null, partnerId: null };
  }
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
   PARTNER CRUD (ADMIN ONLY - ELEVATED ROLES REQUIRED)
   ========================================================================== */

export async function getAllDeliveryPartners(filters?: {
  city?: string;
  status?: string;
  search?: string;
}): Promise<ActionResult<IDeliveryPartner[]>> {
  try {
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
        createdByAdminId: adminAuth.adminId || input.adminId || 'super-admin',
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
      createdByAdminId: adminAuth.adminId || input.adminId || 'super-admin',
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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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

    // Financial & COD adjustments (strictly gated behind admin verification)
    if (typeof input.walletDelta === 'number') {
      if (isNaN(input.walletDelta)) {
        return errorResponse('Invalid wallet adjustment amount.');
      }
      partner.walletBalance = Math.max(0, (partner.walletBalance || 0) + input.walletDelta);
      await DeliveryLog.create({
        partnerId: partner._id,
        status: 'Wallet Adjusted',
        note: `Wallet adjusted by PKR ${input.walletDelta} by admin ${adminAuth.adminId}`,
      });
    }

    if (input.resetCod) {
      const cleared = partner.codCollectedBalance || 0;
      partner.codCollectedBalance = 0;
      await DeliveryLog.create({
        partnerId: partner._id,
        status: 'COD Reset',
        note: `COD balance of PKR ${cleared.toLocaleString()} reset by admin ${adminAuth.adminId}`,
      });
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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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

    await DeliveryLog.create({
      partnerId: partner._id,
      status: 'COD Received in Office',
      note: `PKR ${amount.toLocaleString()} received and settled in office by admin ${adminAuth.adminId}`,
    });

    return successResponse({ amountCleared: amount }, `PKR ${amount.toLocaleString()} marked as received in office.`);
  } catch (error) {
    return handleActionError(error);
  }
}

/* ==========================================================================
   ORDER ASSIGNMENT SYSTEM (ADMIN & DISPATCH ONLY)
   ========================================================================== */

export async function getActiveRidersForCity(city: string): Promise<ActionResult<Array<IDeliveryPartner & { distanceKm?: number }>>> {
  try {
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized || !adminAuth.adminId) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
        assignedByAdmin: adminAuth.adminName || 'Super Admin',
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
      assignment.assignedByAdmin = adminAuth.adminName || 'Super Admin';
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
        assignedByAdmin: adminAuth.adminName || 'Super Admin',
      });
    }

    // Update order status & courier info with authenticated admin attribution
    order.status = OrderStatus.SHIPPED;
    order.courier = `OX Express Rider (${partner.name})`;
    order.trackingNumber = `OX-RIDER-${partner.phone.slice(-4)}-${order.orderNumber.replace(/\D/g, '').slice(-4)}`;
    order.version = (order.version ?? 0) + 1;
    order.lastUpdatedBy = adminAuth.adminId;
    await order.save();

    // Create log entry
    await DeliveryLog.create({
      assignmentId: assignment._id,
      partnerId: partner._id,
      status: 'Assigned to Rider',
      note: `Assigned to ${partner.name} by ${adminAuth.adminName || 'Admin'}`,
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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized || !adminAuth.adminId) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    assignment.assignedByAdmin = adminAuth.adminName || adminId || 'Super Admin';
    order.version = (order.version ?? 0) + 1;
    order.lastUpdatedBy = adminAuth.adminId;
    await order.save();
    await assignment.save();

    await DeliveryLog.create({
      assignmentId: assignment._id,
      partnerId: newPartner._id,
      status: 'Reassigned',
      note: `Reassigned from ${oldPartnerName} to ${newPartner.name} by admin ${adminAuth.adminId}`,
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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized || !adminAuth.adminId) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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

    // Revert order status if found with verified actor attribution
    order.version = (order.version ?? 0) + 1;
    order.lastUpdatedBy = adminAuth.adminId;
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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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
    const adminAuth = await verifyDeliveryAdminAuth();
    if (!adminAuth.authorized) {
      return errorResponse('Unauthorized: Administrative clearance required.');
    }

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

/* ==========================================================================
   RIDER PORTAL & MOBILE ACTIONS (/delivery)
   AUTHENTICATED VIA CRYPTOGRAPHIC RIDER SESSION OR ELEVATED ADMIN
   ========================================================================== */

/**
 * Rider Login: verifies phone & password, creates cryptographically signed HTTP-only cookie session.
 */
export async function riderLogin(phone: string, password: string): Promise<ActionResult<IDeliveryPartner>> {
  try {
    if (!phone?.trim() || !password?.trim()) {
      return errorResponse('Mobile phone and password are required.');
    }

    const cleanPhone = normalizePhone(phone);
    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const mockPartner = MockDb.getDeliveryPartnerByPhone(cleanPhone);
      if (!mockPartner) {
        return errorResponse('No delivery partner account found with this phone number. Please contact Admin.');
      }
      if (mockPartner.status !== DeliveryPartnerStatus.ACTIVE) {
        return errorResponse('Your delivery partner account is deactivated. Please contact dispatch office.');
      }
      if (mockPartner.password && mockPartner.password !== password) {
        return errorResponse('Incorrect password for rider login.');
      }

      const token = signRiderPayload({
        partnerId: mockPartner._id.toString(),
        phone: mockPartner.phone,
        role: 'rider',
        iat: Date.now(),
        exp: Date.now() + RIDER_SESSION_TTL_MS,
      });

      try {
        const cookieStore = await cookies();
        cookieStore.set(RIDER_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: Math.floor(RIDER_SESSION_TTL_MS / 1000),
        });
      } catch {
        // Non-HTTP/testing contexts
      }

      const safeMock = { ...mockPartner };
      delete safeMock.password;
      return successResponse(safeMock, `Welcome, ${mockPartner.name}!`);
    }

    const partner = await DeliveryPartner.findOne({ phone: cleanPhone, isDeleted: false }).select('+password');
    if (!partner || !partner.password) {
      return errorResponse('No delivery partner account found with this phone number. Please contact Admin.');
    }

    if (partner.status !== DeliveryPartnerStatus.ACTIVE) {
      return errorResponse('Your delivery partner account is deactivated. Please contact dispatch office.');
    }

    const isMatch = await partner.comparePassword(password);
    if (!isMatch) {
      return errorResponse('Incorrect password for rider login.');
    }

    const token = signRiderPayload({
      partnerId: partner._id.toString(),
      phone: partner.phone,
      role: 'rider',
      iat: Date.now(),
      exp: Date.now() + RIDER_SESSION_TTL_MS,
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set(RIDER_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: Math.floor(RIDER_SESSION_TTL_MS / 1000),
      });
    } catch {
      // Non-HTTP/testing contexts
    }

    const safePartner = partner.toObject();
    delete safePartner.password;
    return successResponse(safePartner as unknown as IDeliveryPartner, `Welcome, ${partner.name}!`);
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Rider Logout: clears the HTTP-only session cookie.
 */
export async function riderLogout(): Promise<ActionResult<{ success: boolean }>> {
  try {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(RIDER_COOKIE_NAME);
    } catch {
      // Non-HTTP/testing contexts
    }
    return successResponse({ success: true }, 'Logged out of rider terminal.');
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Validates and retrieves the currently authenticated rider's profile from server-side session.
 */
export async function getCurrentRiderProfile(): Promise<ActionResult<IDeliveryPartner>> {
  try {
    const auth = await verifyRiderOrAdminAuth();
    if (!auth.authorized || !auth.partnerId) {
      return errorResponse('Unauthorized: Active rider session required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const partner = MockDb.getDeliveryPartnerById(auth.partnerId);
      if (!partner) return errorResponse('Delivery partner not found.');
      return successResponse(partner);
    }

    const partner = await DeliveryPartner.findOne({ _id: auth.partnerId, isDeleted: false }).lean();
    if (!partner || partner.status !== DeliveryPartnerStatus.ACTIVE) {
      return errorResponse('Delivery partner account not found or deactivated.');
    }

    const safePartner = { ...partner } as Record<string, unknown>;
    delete safePartner.password;
    return successResponse(safePartner as unknown as IDeliveryPartner);
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Retrieves delivery assignments belonging exclusively to the authenticated rider.
 */
export async function getRiderAssignments(partnerId?: string): Promise<ActionResult<IDeliveryAssignment[]>> {
  try {
    const auth = await verifyRiderOrAdminAuth(partnerId);
    if (!auth.authorized) {
      return errorResponse('Unauthorized: Rider session required.');
    }

    const resolvedPartnerId = auth.isAdmin ? (partnerId || auth.partnerId) : auth.partnerId;
    if (!resolvedPartnerId) {
      return errorResponse('Missing target partner ID.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignments = MockDb.getDeliveryAssignments({ partnerId: resolvedPartnerId });
      return successResponse(assignments, 'Rider assignments retrieved.');
    }

    const assignments = await DeliveryAssignment.find({ partnerId: resolvedPartnerId }).sort({ assignedAt: -1 }).lean();
    return successResponse(assignments as unknown as IDeliveryAssignment[], 'Rider assignments retrieved.');
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Updates status of a delivery assignment with strict ownership, valid state transitions,
 * and duplicate commission credit protection.
 */
export async function updateRiderAssignmentStatus(
  input: UpdateAssignmentStatusInput
): Promise<ActionResult<IDeliveryAssignment>> {
  try {
    const auth = await verifyRiderOrAdminAuth(input.partnerId);
    if (!auth.authorized) {
      return errorResponse('Unauthorized: Rider session required.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      const assignment = MockDb.getDeliveryAssignmentById(input.assignmentId);
      if (!assignment) return errorResponse('Assignment not found.');

      // Strict assignment ownership check
      if (!auth.isAdmin && assignment.partnerId.toString() !== auth.partnerId) {
        return errorResponse('Unauthorized: You can only update your own assignments.');
      }

      // Prevent duplicate delivery processing / commission credit
      if (input.status === DeliveryAssignmentStatus.DELIVERED) {
        if (assignment.status === DeliveryAssignmentStatus.DELIVERED || assignment.codCollected) {
          return errorResponse('Assignment is already marked as delivered.');
        }
      }

      // Terminal state protection: rider cannot alter delivered or failed assignments
      if (
        !auth.isAdmin &&
        (assignment.status === DeliveryAssignmentStatus.DELIVERED ||
          assignment.status === DeliveryAssignmentStatus.FAILED)
      ) {
        return errorResponse(`Cannot alter assignment in ${assignment.status} status.`);
      }

      const updated = MockDb.updateDeliveryAssignmentStatus(input.assignmentId, input);
      if (!updated) return errorResponse('Assignment not found.');

      if (input.status === DeliveryAssignmentStatus.DELIVERED) {
        MockDb.updateOrderStatus(assignment.orderId.toString(), {
          status: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
        });
        const partner = MockDb.getDeliveryPartnerById(assignment.partnerId.toString());
        if (partner) {
          MockDb.updateDeliveryPartner(assignment.partnerId.toString(), {
            walletDelta: 150,
          });
          partner.codCollectedBalance = (partner.codCollectedBalance || 0) + (assignment.codAmount || 0);
          partner.totalDeliveries = (partner.totalDeliveries || 0) + 1;
        }
      } else if (input.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
        MockDb.updateOrderStatus(assignment.orderId.toString(), {
          status: OrderStatus.OUT_FOR_DELIVERY,
        });
      }

      return successResponse(updated, `Assignment status updated to ${input.status}.`);
    }

    const assignment = await DeliveryAssignment.findById(input.assignmentId);
    if (!assignment) return errorResponse('Assignment not found.');

    // Strict assignment ownership check
    if (!auth.isAdmin && assignment.partnerId.toString() !== auth.partnerId) {
      return errorResponse('Unauthorized: You can only update your own assignments.');
    }

    // Terminal state protection: rider cannot alter delivered or failed assignments
    if (
      !auth.isAdmin &&
      (assignment.status === DeliveryAssignmentStatus.DELIVERED ||
        assignment.status === DeliveryAssignmentStatus.FAILED)
    ) {
      return errorResponse(`Cannot alter assignment in ${assignment.status} status.`);
    }

    // Concurrency-Safe Delivery Completion & Commission Credit via Mandatory ACID Transaction
    if (input.status === DeliveryAssignmentStatus.DELIVERED) {
      // Early check: if already delivered, reject immediately
      if (assignment.status === DeliveryAssignmentStatus.DELIVERED || assignment.codCollected) {
        return errorResponse('Assignment is already marked as delivered.');
      }

      let session: mongoose.ClientSession | null = null;

      try {
        const mongooseConn = await connectToDatabase();
        if (!mongooseConn || mongooseConn.connection.readyState !== 1) {
          return errorResponse('Database connection unavailable. Cannot process delivery completion.');
        }

        try {
          session = await mongooseConn.startSession();
          session.startTransaction();
        } catch (sessionErr) {
          console.error('[OX Shoes] Transaction session startup failed:', sessionErr);
          return errorResponse('Transaction service unavailable. Please retry in a few moments.');
        }

        // ATOMIC CONDITIONAL UPDATE: Lock delivery transition at MongoDB layer.
        // Include partnerId in filter to enforce assignment ownership directly in DB query.
        const updatedAssignment = await DeliveryAssignment.findOneAndUpdate(
          {
            _id: input.assignmentId,
            partnerId: auth.isAdmin ? assignment.partnerId : auth.partnerId,
            status: { $ne: DeliveryAssignmentStatus.DELIVERED },
            codCollected: { $ne: true },
          },
          {
            $set: {
              status: DeliveryAssignmentStatus.DELIVERED,
              deliveredAt: new Date(),
              codCollected: true,
              ...(input.photoUrl ? { proofPhotoUrl: input.photoUrl } : {}),
              ...(input.note ? { deliveryNotes: input.note } : {}),
            },
          },
          { new: true, session }
        );

        // If atomic update returned null, a competing concurrent request claimed the delivery transition
        if (!updatedAssignment) {
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
          return errorResponse('Assignment is already marked as delivered.');
        }

        // Downstream updates within the transaction session - STRICT VALIDATION REQUIRED
        const updatedOrder = await Order.findByIdAndUpdate(
          updatedAssignment.orderId,
          {
            status: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PAID,
          },
          { session, new: true }
        );

        if (!updatedOrder) {
          throw new Error('Order record not found during transaction.');
        }

        const updatedPartner = await DeliveryPartner.findByIdAndUpdate(
          updatedAssignment.partnerId,
          {
            $inc: {
              totalDeliveries: 1,
              walletBalance: 150, // PKR 150 delivery commission
              codCollectedBalance: updatedAssignment.codAmount || 0,
            },
          },
          { session, new: true }
        );

        if (!updatedPartner) {
          throw new Error('Delivery partner record not found during transaction.');
        }

        const logPayload = {
          assignmentId: updatedAssignment._id,
          partnerId: updatedAssignment.partnerId,
          status: input.status,
          lat: input.lat,
          lng: input.lng,
          note: input.note || input.failureReason,
          photoUrl: input.photoUrl,
        };

        // Pass payload as array to .create() when using sessions
        const logs = await DeliveryLog.create([logPayload], { session });
        if (!logs || logs.length === 0) {
          throw new Error('Audit log creation failed during transaction.');
        }

        await session.commitTransaction();

        return successResponse(
          updatedAssignment.toObject() as unknown as IDeliveryAssignment,
          `Order status updated to ${input.status}.`
        );
      } catch (downstreamErr) {
        if (session && session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch (abortErr) {
            console.error('[OX Shoes] Transaction abort failed:', abortErr);
          }
        }
        // Handle specific errors cleanly without exposing internals
        const errMsg = downstreamErr instanceof Error ? downstreamErr.message : 'Financial transaction failed.';
        if (errMsg.includes('not found')) {
          return errorResponse(`Processing error: ${errMsg}`);
        }
        throw downstreamErr;
      } finally {
        if (session) {
          try {
            await session.endSession();
          } catch (endErr) {
            console.error('[OX Shoes] Session termination failed:', endErr);
          }
        }
      }
    }

    // Non-delivered state transitions (PICKED, OUT_FOR_DELIVERY, FAILED)
    assignment.status = input.status;

    if (input.status === DeliveryAssignmentStatus.PICKED) {
      assignment.pickedAt = new Date();
    } else if (input.status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
      assignment.outForDeliveryAt = new Date();
      await Order.findByIdAndUpdate(assignment.orderId, { status: OrderStatus.OUT_FOR_DELIVERY });
    } else if (input.status === DeliveryAssignmentStatus.FAILED) {
      assignment.failedAt = new Date();
      assignment.failureReason = input.failureReason || 'Customer unavailable';
      if (input.note) assignment.deliveryNotes = input.note;
    }

    await assignment.save();

    // Log the event with verified actor attribution
    await DeliveryLog.create({
      assignmentId: assignment._id,
      partnerId: assignment.partnerId,
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

/**
 * Updates live GPS coordinates for the authenticated rider.
 */
export async function updateRiderLocation(
  partnerId: string,
  lat: number,
  lng: number
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const auth = await verifyRiderOrAdminAuth(partnerId);
    if (!auth.authorized) {
      return errorResponse('Unauthorized: Rider session required.');
    }

    const targetPartnerId = auth.isAdmin ? partnerId : auth.partnerId;
    if (!targetPartnerId) {
      return errorResponse('Missing partner ID.');
    }

    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return errorResponse('Invalid coordinates provided.');
    }

    await connectToDatabase();

    if (!isDatabaseConnected()) {
      MockDb.updateDeliveryPartner(targetPartnerId, { currentLat: lat, currentLng: lng });
      return successResponse({ success: true }, 'Location updated.');
    }

    await DeliveryPartner.findByIdAndUpdate(targetPartnerId, {
      currentLat: lat,
      currentLng: lng,
      lastLocationUpdate: new Date(),
    });

    return successResponse({ success: true }, 'Rider location updated.');
  } catch (error) {
    return handleActionError(error);
  }
}
