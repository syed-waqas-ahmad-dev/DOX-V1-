import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyDeliveryAdminAuth } from '@/actions/delivery.actions';
import { canUseMockDatabase, connectToDatabase, isDatabaseConnected } from '@/lib/db/connect';
import { DeliveryPartner } from '@/models/DeliveryPartner';
import { MockDb } from '@/lib/db/mock-store';
import { resolveCityCoordinates } from '@/lib/cities';
import { DeliveryPartnerStatus } from '@/types';
import {
  DEFAULT_DELIVERY_PARTNER_PHOTO,
  validateRiderPhotoBuffer,
} from '@/lib/delivery-partner-photo-validation';
import {
  destroyRiderPhotoFromCloudinary,
  extractDeliveryPartnerPublicIdFromUrl,
  uploadRiderPhotoBufferToCloudinary,
} from '@/lib/delivery-partner-upload.server';

/**
 * @file app/api/admin/delivery-partners/route.ts
 * @description Authenticated multipart/form-data endpoints for registering and updating
 * Delivery Partners with server-validated Cloudinary rider photo uploads.
 * Strict TypeScript: ZERO `any`.
 */

export const runtime = 'nodejs';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('923')) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return '0' + digits;
  }
  return digits;
}

function getStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: number; message?: string };
  return (
    candidate.code === 11000 ||
    (typeof candidate.message === 'string' && candidate.message.includes('E11000'))
  );
}

/**
 * POST /api/admin/delivery-partners
 * Registers a new Delivery Partner from multipart/form-data.
 * Independently authenticates session, enforces delivery:partners RBAC,
 * validates the optional rider photo, uploads to Cloudinary, and persists in MongoDB Atlas.
 */
export async function POST(req: NextRequest) {
  let uploadedAsset: { secureUrl: string; publicId: string } | null = null;

  try {
    // 1. Authenticate caller
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Enforce existing delivery partner management RBAC
    const adminAuth = await verifyDeliveryAdminAuth('delivery:partners');
    if (!adminAuth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Administrative clearance with partner management permission required.',
        },
        { status: 403 }
      );
    }

    // 3. Parse multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Request must use multipart/form-data.' },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Unable to parse multipart form payload.' },
        { status: 400 }
      );
    }

    // Never trust client-provided photo URL strings as proof of upload
    const rawPhotoEntry = formData.get('photo');
    const rawPhotoUrlEntry = formData.get('photoUrl');
    if (typeof rawPhotoEntry === 'string' || typeof rawPhotoUrlEntry === 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Client-provided photo URLs are not permitted. Please upload an image file.',
        },
        { status: 400 }
      );
    }

    // 4. Validate required partner fields
    const name = getStringField(formData, 'name');
    const rawPhone = getStringField(formData, 'phone');
    const password = getStringField(formData, 'password');
    const cnic = getStringField(formData, 'cnic');
    const bikeNumber = getStringField(formData, 'bikeNumber');
    const area = getStringField(formData, 'area');
    const city = getStringField(formData, 'city') || 'Peshawar';

    if (!name || !rawPhone || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, Phone number, and Password are required.' },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Partner full name must be between 2 and 100 characters.' },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(rawPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid phone number.' },
        { status: 400 }
      );
    }

    if (!cnic || !bikeNumber || !area || !city) {
      return NextResponse.json(
        { success: false, error: 'CNIC, Bike Registration No, City, and Assigned Area are required.' },
        { status: 400 }
      );
    }

    // 5. Independently validate optional rider photo on server BEFORE DB checks or Cloudinary upload
    let validatedPhotoBuffer: Buffer | null = null;
    if (rawPhotoEntry instanceof File && rawPhotoEntry.size > 0) {
      const arrayBuffer = await rawPhotoEntry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const validation = validateRiderPhotoBuffer(
        {
          name: rawPhotoEntry.name,
          type: rawPhotoEntry.type,
          size: rawPhotoEntry.size,
        },
        buffer
      );

      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error || 'Invalid rider photo upload.' },
          { status: 400 }
        );
      }

      validatedPhotoBuffer = buffer;
    }

    // 6. Verify database readiness (fail closed outside approved offline mock mode)
    await connectToDatabase();
    const dbReady = isDatabaseConnected();

    if (!dbReady && !canUseMockDatabase()) {
      return NextResponse.json(
        { success: false, error: 'Database connection unavailable. Cannot create delivery partner.' },
        { status: 503 }
      );
    }

    // Check duplicate phone BEFORE uploading to Cloudinary to avoid unnecessary uploads
    if (dbReady) {
      const existing = await DeliveryPartner.findOne({ phone: cleanPhone, isDeleted: false }).lean();
      if (existing) {
        return NextResponse.json(
          { success: false, error: `A delivery partner with phone ${cleanPhone} already exists.` },
          { status: 409 }
        );
      }
    } else {
      const existingMock = MockDb.getDeliveryPartnerByPhone(cleanPhone);
      if (existingMock) {
        return NextResponse.json(
          { success: false, error: `A delivery partner with phone ${cleanPhone} already exists.` },
          { status: 409 }
        );
      }
    }

    // 7. Upload photo to Cloudinary if provided (fail closed on upload failure)
    if (validatedPhotoBuffer) {
      try {
        uploadedAsset = await uploadRiderPhotoBufferToCloudinary(validatedPhotoBuffer);
      } catch (uploadErr: unknown) {
        const message =
          uploadErr instanceof Error ? uploadErr.message : 'Failed to upload rider photo to Cloudinary.';
        return NextResponse.json({ success: false, error: message }, { status: 502 });
      }
    }

    // 8. Persist Delivery Partner record in MongoDB Atlas (or MockDb in approved dev/test)
    const coords = resolveCityCoordinates(city);
    const photoUrlToSave = uploadedAsset ? uploadedAsset.secureUrl : DEFAULT_DELIVERY_PARTNER_PHOTO;

    if (!dbReady) {
      const newMock = MockDb.createDeliveryPartner({
        name,
        phone: cleanPhone,
        cnic,
        bikeNumber: bikeNumber.toUpperCase(),
        password,
        area,
        city,
        photo: photoUrlToSave,
        ...(coords
          ? {
              currentLat: coords[0] + (Math.random() - 0.5) * 0.05,
              currentLng: coords[1] + (Math.random() - 0.5) * 0.05,
            }
          : {}),
        createdByAdminId: adminAuth.adminId || 'super-admin',
      });

      const safeMock = { ...newMock };
      delete safeMock.password;
      return NextResponse.json(
        {
          success: true,
          data: safeMock,
          message: `Delivery Partner ${newMock.name} created successfully.`,
        },
        { status: 201 }
      );
    }

    const partner = await DeliveryPartner.create({
      name,
      phone: cleanPhone,
      cnic,
      bikeNumber: bikeNumber.toUpperCase(),
      password,
      area,
      city,
      photo: photoUrlToSave,
      ...(coords
        ? {
            currentLat: coords[0] + (Math.random() - 0.5) * 0.05,
            currentLng: coords[1] + (Math.random() - 0.5) * 0.05,
            lastLocationUpdate: new Date(),
          }
        : {}),
      status: DeliveryPartnerStatus.ACTIVE,
      createdByAdminId: adminAuth.adminId || 'super-admin',
    });

    const partnerObj = partner.toObject();
    delete partnerObj.password;

    return NextResponse.json(
      {
        success: true,
        data: JSON.parse(JSON.stringify(partnerObj)),
        message: `Delivery partner ${partner.name} registered.`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Clean up orphaned Cloudinary asset if DB persistence failed after upload
    if (uploadedAsset?.publicId) {
      await destroyRiderPhotoFromCloudinary(uploadedAsset.publicId);
    }

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: 'A delivery partner with this phone number already exists.' },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to register delivery partner.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/delivery-partners
 * Updates an existing Delivery Partner from multipart/form-data.
 * Preserves the previous photo when no replacement is uploaded and removePhoto is not 'true'.
 * Does not delete any previous Cloudinary asset until replacement upload AND database update succeed.
 */
export async function PATCH(req: NextRequest) {
  let uploadedAsset: { secureUrl: string; publicId: string } | null = null;

  try {
    // 1. Authenticate caller
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Enforce existing delivery partner management RBAC
    const adminAuth = await verifyDeliveryAdminAuth('delivery:partners');
    if (!adminAuth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Administrative clearance with partner management permission required.',
        },
        { status: 403 }
      );
    }

    // 3. Parse multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Request must use multipart/form-data.' },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Unable to parse multipart form payload.' },
        { status: 400 }
      );
    }

    // Never trust client-provided photo URL strings
    const rawPhotoEntry = formData.get('photo');
    const rawPhotoUrlEntry = formData.get('photoUrl');
    if (typeof rawPhotoEntry === 'string' || typeof rawPhotoUrlEntry === 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Client-provided photo URLs are not permitted. Please upload an image file.',
        },
        { status: 400 }
      );
    }

    const id = getStringField(formData, 'id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Partner ID is required.' }, { status: 400 });
    }

    const name = getStringField(formData, 'name');
    const rawPhone = getStringField(formData, 'phone');
    const cnic = getStringField(formData, 'cnic');
    const bikeNumber = getStringField(formData, 'bikeNumber');
    const area = getStringField(formData, 'area');
    const city = getStringField(formData, 'city');
    const status = getStringField(formData, 'status');
    const password = getStringField(formData, 'password');
    const removePhoto = getStringField(formData, 'removePhoto') === 'true';

    if (
      status &&
      status !== DeliveryPartnerStatus.ACTIVE &&
      status !== DeliveryPartnerStatus.INACTIVE
    ) {
      return NextResponse.json({ success: false, error: 'Invalid partner status.' }, { status: 400 });
    }

    // 4. Validate optional replacement photo independently on server
    let validatedPhotoBuffer: Buffer | null = null;
    if (rawPhotoEntry instanceof File && rawPhotoEntry.size > 0) {
      const arrayBuffer = await rawPhotoEntry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const validation = validateRiderPhotoBuffer(
        {
          name: rawPhotoEntry.name,
          type: rawPhotoEntry.type,
          size: rawPhotoEntry.size,
        },
        buffer
      );

      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error || 'Invalid rider photo upload.' },
          { status: 400 }
        );
      }

      validatedPhotoBuffer = buffer;
    }

    // 5. Connect to DB (fail closed outside approved mock env)
    await connectToDatabase();
    const dbReady = isDatabaseConnected();

    if (!dbReady && !canUseMockDatabase()) {
      return NextResponse.json(
        { success: false, error: 'Database connection unavailable. Cannot update delivery partner.' },
        { status: 503 }
      );
    }

    if (!dbReady) {
      const existingMock = MockDb.getDeliveryPartnerById(id);
      if (!existingMock) {
        return NextResponse.json({ success: false, error: 'Delivery partner not found.' }, { status: 404 });
      }

      const previousPhotoUrl = existingMock.photo;

      if (validatedPhotoBuffer) {
        try {
          uploadedAsset = await uploadRiderPhotoBufferToCloudinary(validatedPhotoBuffer);
        } catch (uploadErr: unknown) {
          const message =
            uploadErr instanceof Error ? uploadErr.message : 'Failed to upload replacement rider photo.';
          return NextResponse.json({ success: false, error: message }, { status: 502 });
        }
      }

      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (rawPhone) updates.phone = normalizePhone(rawPhone);
      if (cnic) updates.cnic = cnic;
      if (bikeNumber) updates.bikeNumber = bikeNumber.toUpperCase();
      if (area) updates.area = area;
      if (city) updates.city = city;
      if (status) updates.status = status;
      if (password) updates.password = password;
      if (uploadedAsset) {
        updates.photo = uploadedAsset.secureUrl;
      } else if (removePhoto) {
        updates.photo = '';
      }

      const updatedMock = MockDb.updateDeliveryPartner(id, updates);
      if (!updatedMock) {
        if (uploadedAsset?.publicId) {
          await destroyRiderPhotoFromCloudinary(uploadedAsset.publicId);
        }
        return NextResponse.json({ success: false, error: 'Delivery partner not found.' }, { status: 404 });
      }

      if (uploadedAsset || removePhoto) {
        const oldPublicId = extractDeliveryPartnerPublicIdFromUrl(previousPhotoUrl);
        if (oldPublicId && oldPublicId !== uploadedAsset?.publicId) {
          await destroyRiderPhotoFromCloudinary(oldPublicId);
        }
      }

      const safeMock = { ...updatedMock };
      delete safeMock.password;
      return NextResponse.json({
        success: true,
        data: safeMock,
        message: 'Delivery partner updated successfully.',
      });
    }

    const partner = await DeliveryPartner.findById(id);
    if (!partner || partner.isDeleted) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found.' }, { status: 404 });
    }

    const previousPhotoUrl = partner.photo;

    if (rawPhone) {
      const cleanPhone = normalizePhone(rawPhone);
      const conflict = await DeliveryPartner.findOne({
        _id: { $ne: partner._id },
        phone: cleanPhone,
        isDeleted: false,
      }).lean();
      if (conflict) {
        return NextResponse.json(
          { success: false, error: `Another delivery partner already uses phone ${cleanPhone}.` },
          { status: 409 }
        );
      }
      partner.phone = cleanPhone;
    }

    // Upload replacement photo AFTER validation & partner verification, BEFORE mutating partner.photo
    if (validatedPhotoBuffer) {
      try {
        uploadedAsset = await uploadRiderPhotoBufferToCloudinary(validatedPhotoBuffer);
      } catch (uploadErr: unknown) {
        const message =
          uploadErr instanceof Error ? uploadErr.message : 'Failed to upload replacement rider photo.';
        return NextResponse.json({ success: false, error: message }, { status: 502 });
      }
    }

    if (name) partner.name = name;
    if (cnic) partner.cnic = cnic;
    if (bikeNumber) partner.bikeNumber = bikeNumber.toUpperCase();
    if (area) partner.area = area;
    if (city) partner.city = city;
    if (status) partner.status = status as DeliveryPartnerStatus;
    if (password) partner.password = password;

    if (uploadedAsset) {
      partner.photo = uploadedAsset.secureUrl;
    } else if (removePhoto) {
      partner.photo = '';
    }
    // Otherwise existing partner.photo is preserved automatically

    await partner.save();

    // Only delete replaced/removed Cloudinary photo AFTER DB update succeeds
    if (uploadedAsset || removePhoto) {
      const oldPublicId = extractDeliveryPartnerPublicIdFromUrl(previousPhotoUrl);
      if (oldPublicId && oldPublicId !== uploadedAsset?.publicId) {
        await destroyRiderPhotoFromCloudinary(oldPublicId);
      }
    }

    const partnerObj = partner.toObject();
    delete partnerObj.password;

    return NextResponse.json({
      success: true,
      data: JSON.parse(JSON.stringify(partnerObj)),
      message: 'Delivery partner updated.',
    });
  } catch (error: unknown) {
    // Clean up orphaned new upload if DB update failed
    if (uploadedAsset?.publicId) {
      await destroyRiderPhotoFromCloudinary(uploadedAsset.publicId);
    }

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: 'A delivery partner with this phone number already exists.' },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to update delivery partner.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
