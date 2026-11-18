/**
 * @file scripts/delivery-partner-photo-test.ts
 * @description Comprehensive unit & integration harness for Delivery Partner Rider Photo Upload.
 * Tests client/server validation, RBAC enforcement, multipart route handling, Cloudinary
 * upload failure handling, DB save failure orphan cleanup, edit photo preservation/replacement,
 * and zero secret exposure without modifying production MongoDB or making live Cloudinary calls.
 * Strict TypeScript: ZERO `any`.
 */

import Module from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { NextRequest } from 'next/server';

// Configure isolated offline test environment BEFORE loading project modules
delete process.env.MONGODB_URI;
delete process.env.MONGODB_DB_NAME;
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
process.env.ALLOW_OFFLINE_MOCK_AUTH = 'true';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud-name';
process.env.CLOUDINARY_API_KEY = 'test-api-key-123';
process.env.CLOUDINARY_API_SECRET = 'super-secret-test-value-never-leak';

let mockSession: unknown = null;

const moduleRuntime = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalModuleLoad = moduleRuntime._load;
moduleRuntime._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean
): unknown {
  if (request === 'server-only') {
    return {};
  }
  if (request === 'next-auth' || request === 'next-auth/next') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return {
      ...actual,
      getServerSession: async () => mockSession,
    };
  }
  if (request === 'next/headers') {
    const actual = originalModuleLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return {
      ...actual,
      headers: async () => new Map([['x-forwarded-for', '127.0.0.1']]),
      cookies: async () => ({
        get: () => undefined,
        getAll: () => [],
      }),
    };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

// Realistic minimal binary magic headers for JPG, PNG, WEBP
function makeJpegFile(name = 'rider.jpg', sizePadding = 32): File {
  const bytes = new Uint8Array(12 + sizePadding);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return new File([bytes], name, { type: 'image/jpeg' });
}

function makePngFile(name = 'rider.png', sizePadding = 32): File {
  const bytes = new Uint8Array(12 + sizePadding);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return new File([bytes], name, { type: 'image/png' });
}

function makeWebpFile(name = 'rider.webp', sizePadding = 32): File {
  const bytes = new Uint8Array(12 + sizePadding);
  // RIFF....WEBP
  bytes.set([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], 0);
  return new File([bytes], name, { type: 'image/webp' });
}

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${total}. ${label}`);
    if (detail) console.log(`         ${detail}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${total}. ${label}`);
    if (detail) console.error(`         ${detail}`);
  }
}

async function runTests() {
  const {
    DELIVERY_PARTNER_CLOUDINARY_FOLDER,
    DELIVERY_PARTNER_PHOTO_MAX_SIZE_BYTES,
    validateRiderPhotoBuffer,
    validateRiderPhotoFileMeta,
  } = await import('../lib/delivery-partner-photo-validation');
  const { cloudinary } = await import('../lib/cloudinary');
  const { MockDb } = await import('../lib/db/mock-store');
  const { POST, PATCH } = await import('../app/api/admin/delivery-partners/route');
  const { UserRole, Department } = await import('../types');

  console.log('\n======================================================================');
  console.log('OX SHOES — DELIVERY PARTNER RIDER PHOTO UPLOAD VERIFICATION SUITE');
  console.log('======================================================================\n');

  // -----------------------------------------------------------------------
  // 1. Client & Server Photo Validation (JPG, PNG, WEBP, Unsupported, Size)
  // -----------------------------------------------------------------------
  console.log('--- 1. Image Format & File Size Validation ---');

  const jpgFile = makeJpegFile('rider.jpg');
  const pngFile = makePngFile('rider.png');
  const webpFile = makeWebpFile('rider.webp');

  assert(
    validateRiderPhotoFileMeta(jpgFile).valid &&
      validateRiderPhotoBuffer(jpgFile, new Uint8Array(await jpgFile.arrayBuffer())).valid,
    'Accepts valid JPG image (meta + magic bytes)'
  );
  assert(
    validateRiderPhotoFileMeta(pngFile).valid &&
      validateRiderPhotoBuffer(pngFile, new Uint8Array(await pngFile.arrayBuffer())).valid,
    'Accepts valid PNG image (meta + magic bytes)'
  );
  assert(
    validateRiderPhotoFileMeta(webpFile).valid &&
      validateRiderPhotoBuffer(webpFile, new Uint8Array(await webpFile.arrayBuffer())).valid,
    'Accepts valid WEBP image (meta + magic bytes)'
  );

  const svgFile = new File(['<svg></svg>'], 'evil.svg', { type: 'image/svg+xml' });
  assert(
    !validateRiderPhotoFileMeta(svgFile).valid,
    'Rejects unsupported SVG file type'
  );

  const pdfFile = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });
  assert(
    !validateRiderPhotoFileMeta(pdfFile).valid,
    'Rejects unsupported PDF file type'
  );

  const spoofedJpg = new File(['<html>not a jpeg</html>'], 'fake.jpg', { type: 'image/jpeg' });
  assert(
    !validateRiderPhotoBuffer(spoofedJpg, new Uint8Array(await spoofedJpg.arrayBuffer())).valid,
    'Server magic-byte inspection rejects spoofed HTML pretending to be JPG'
  );

  const oversizedResult = validateRiderPhotoFileMeta({
    name: 'huge.jpg',
    type: 'image/jpeg',
    size: DELIVERY_PARTNER_PHOTO_MAX_SIZE_BYTES + 1,
  });
  assert(
    !oversizedResult.valid && (oversizedResult.error || '').includes('10MB'),
    'Rejects oversized image file (> 10MB)'
  );

  // Track mocked Cloudinary uploader invocations
  let uploadShouldFail = false;
  let lastUploadedFolder = '';
  let lastUploadedPublicId = '';
  const destroyedPublicIds: string[] = [];
  let uploadCounter = 0;

  const uploaderMock = cloudinary.uploader as unknown as {
    upload_stream: (
      options: Record<string, unknown>,
      callback: (err: unknown, result?: { secure_url: string; public_id: string }) => void
    ) => Writable;
    destroy: (publicId: string, options?: Record<string, unknown>) => Promise<{ result: string }>;
  };

  uploaderMock.upload_stream = (options, callback) => {
    lastUploadedFolder = String(options.folder || '');
    lastUploadedPublicId = String(options.public_id || '');
    const chunks: Buffer[] = [];
    return new Writable({
      write(chunk, _enc, next) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        next();
      },
      final(done) {
        done();
        if (uploadShouldFail) {
          callback(new Error('Simulated Cloudinary outage'));
          return;
        }
        uploadCounter += 1;
        const publicId = `${lastUploadedFolder}/${lastUploadedPublicId}`;
        callback(null, {
          secure_url: `https://res.cloudinary.com/test-cloud-name/image/upload/v173180000${uploadCounter}/${publicId}.jpg`,
          public_id: publicId,
        });
      },
    });
  };

  uploaderMock.destroy = async (publicId: string) => {
    destroyedPublicIds.push(publicId);
    return { result: 'ok' };
  };

  // Seed MockDb users for RBAC checks (matches lib/auth-guard.ts MockDb ids)
  const adminUser = MockDb.getUserById('admin_id');
  const customerUser = MockDb.getUserById('660e1234567890abcdef1000');

  const buildPartnerFormData = (overrides: Record<string, string | File | null> = {}): FormData => {
    const fd = new FormData();
    const defaults: Record<string, string | File | null> = {
      name: 'Tariq Mahmood',
      phone: '03009998877',
      password: 'password123',
      cnic: '17301-9988776-1',
      bikeNumber: 'PSH-9001',
      city: 'Peshawar',
      area: 'University Town',
      ...overrides,
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (v !== null) fd.append(k, v);
    }
    return fd;
  };

  // -----------------------------------------------------------------------
  // 2. Authentication & RBAC Enforcement
  // -----------------------------------------------------------------------
  console.log('\n--- 2. Authentication & RBAC Enforcement ---');

  mockSession = null;
  const unauthRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ photo: jpgFile }),
    })
  );
  assert(
    unauthRes.status === 401,
    'Unauthenticated caller cannot upload photo or register partner (HTTP 401)'
  );

  if (customerUser) {
    mockSession = { user: { id: customerUser._id.toString(), role: UserRole.CUSTOMER } };
    const custRes = await POST(
      new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
        method: 'POST',
        body: buildPartnerFormData({ photo: jpgFile }),
      })
    );
    assert(
      custRes.status === 403,
      'Customer role cannot upload rider photo or register partner (HTTP 403)'
    );
  }

  // Non-delivery department manager must be rejected (HTTP 403)
  mockSession = { user: { id: 'manager_inventory_id', role: UserRole.MANAGER } };
  const invMgrRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005559901', photo: jpgFile }),
    })
  );
  assert(
    invMgrRes.status === 403,
    'Non-delivery department manager (INVENTORY) is rejected (HTTP 403)'
  );

  // Authorized DELIVERY department manager with delivery:partners permission succeeds
  const deliveryMgrId = 'manager_delivery_photo_test_id';
  MockDb.addUser({
    _id: deliveryMgrId,
    role: UserRole.MANAGER,
    department: Department.DELIVERY,
    permissions: ['delivery:read', 'delivery:write', 'delivery:partners'],
    isDeleted: false,
  });
  mockSession = { user: { id: deliveryMgrId, role: UserRole.MANAGER } };
  const delMgrRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005559902', photo: makeJpegFile('mgr.jpg') }),
    })
  );
  assert(
    delMgrRes.status === 201,
    'Authorized DELIVERY manager with delivery:partners permission can upload photo & create partner (HTTP 201)'
  );

  // Reject client-supplied photo URL strings even as admin
  if (adminUser) {
    mockSession = { user: { id: adminUser._id.toString(), role: adminUser.role } };
  }

  const spoofUrlFd = buildPartnerFormData({ photo: 'https://evil.example.com/fake.jpg' });
  const spoofUrlRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: spoofUrlFd,
    })
  );
  assert(
    spoofUrlRes.status === 400,
    'Rejects client-provided photo URL string (HTTP 400)'
  );

  // -----------------------------------------------------------------------
  // 3. Valid JPG / PNG / WEBP Upload + Optional Photo + Folder/PublicId
  // -----------------------------------------------------------------------
  console.log('\n--- 3. Authorized Admin Partner Creation With & Without Photo ---');

  const createJpgRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551101', photo: makeJpegFile('ali.jpg') }),
    })
  );
  const createJpgJson = (await createJpgRes.json()) as {
    success?: boolean;
    data?: { _id: string; photo: string };
  };
  assert(
    createJpgRes.status === 201 &&
      createJpgJson.success === true &&
      typeof createJpgJson.data?.photo === 'string' &&
      createJpgJson.data.photo.startsWith('https://res.cloudinary.com/') &&
      createJpgJson.data.photo.includes(DELIVERY_PARTNER_CLOUDINARY_FOLDER) &&
      lastUploadedFolder === DELIVERY_PARTNER_CLOUDINARY_FOLDER &&
      lastUploadedPublicId.startsWith('rider-'),
    'Authorized admin creates partner with JPG upload -> Cloudinary HTTPS URL saved in partner.photo',
    `Saved photo URL: ${createJpgJson.data?.photo}`
  );

  const createPngRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551102', photo: makePngFile('zain.png') }),
    })
  );
  const createPngJson = (await createPngRes.json()) as { success?: boolean; data?: { photo: string } };
  assert(
    createPngRes.status === 201 && Boolean(createPngJson.data?.photo.startsWith('https://res.cloudinary.com/')),
    'Authorized admin creates partner with valid PNG upload'
  );

  const createWebpRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551103', photo: makeWebpFile('umer.webp') }),
    })
  );
  const createWebpJson = (await createWebpRes.json()) as { success?: boolean; data?: { photo: string } };
  assert(
    createWebpRes.status === 201 && Boolean(createWebpJson.data?.photo.startsWith('https://res.cloudinary.com/')),
    'Authorized admin creates partner with valid WEBP upload'
  );

  const createNoPhotoRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551104', photo: null }),
    })
  );
  const createNoPhotoJson = (await createNoPhotoRes.json()) as {
    success?: boolean;
    data?: { photo: string };
  };
  assert(
    createNoPhotoRes.status === 201 &&
      createNoPhotoJson.success === true &&
      typeof createNoPhotoJson.data?.photo === 'string',
    'Partner creation without optional photo succeeds using schema default'
  );

  // -----------------------------------------------------------------------
  // 4. Failure Paths: Unsupported, Cloudinary Failure, DB Failure Orphan Cleanup
  // -----------------------------------------------------------------------
  console.log('\n--- 4. Failure Handling & Orphan Asset Cleanup ---');

  const countBeforeInvalid = MockDb.getDeliveryPartners().length;
  const badUploadRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551105', photo: svgFile }),
    })
  );
  assert(
    badUploadRes.status === 400 && MockDb.getDeliveryPartners().length === countBeforeInvalid,
    'Unsupported file rejected on server without creating partner'
  );

  uploadShouldFail = true;
  const cldFailRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551106', photo: makeJpegFile() }),
    })
  );
  uploadShouldFail = false;
  assert(
    cldFailRes.status === 502 && MockDb.getDeliveryPartners().length === countBeforeInvalid,
    'Cloudinary upload failure fails closed (HTTP 502) without creating partner or fake URL'
  );

  // Simulate DB save failure AFTER Cloudinary upload succeeds -> must destroy uploaded asset
  const originalCreatePartner = MockDb.createDeliveryPartner.bind(MockDb);
  MockDb.createDeliveryPartner = () => {
    throw new Error('Simulated DB write error');
  };
  const destroyedBefore = destroyedPublicIds.length;
  const dbFailRes = await POST(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'POST',
      body: buildPartnerFormData({ phone: '03005551107', photo: makeJpegFile() }),
    })
  );
  MockDb.createDeliveryPartner = originalCreatePartner;
  assert(
    dbFailRes.status === 500 && destroyedPublicIds.length === destroyedBefore + 1,
    'Database save failure after Cloudinary upload destroys orphaned Cloudinary asset',
    `Cleaned up publicId: ${destroyedPublicIds[destroyedPublicIds.length - 1]}`
  );

  // -----------------------------------------------------------------------
  // 5. Edit Partner Photo Preservation, Replacement, Removal & Security Scan
  // -----------------------------------------------------------------------
  console.log('\n--- 5. Edit Partner Photo Preservation & Secret Hygiene ---');

  const createdPartnerId = createJpgJson.data!._id;
  const originalPhotoUrl = createJpgJson.data!.photo;

  const editKeepFd = new FormData();
  editKeepFd.append('id', createdPartnerId);
  editKeepFd.append('name', 'Tariq Mahmood Updated');
  const editKeepRes = await PATCH(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'PATCH',
      body: editKeepFd,
    })
  );
  const editKeepJson = (await editKeepRes.json()) as {
    success?: boolean;
    data?: { name: string; photo: string };
  };
  assert(
    editKeepRes.status === 200 &&
      editKeepJson.data?.name === 'Tariq Mahmood Updated' &&
      editKeepJson.data?.photo === originalPhotoUrl,
    'Editing partner without selecting replacement preserves existing Cloudinary photo'
  );

  // Simulate Cloudinary failure during edit -> preserves existing DB photo
  uploadShouldFail = true;
  const editFailFd = new FormData();
  editFailFd.append('id', createdPartnerId);
  editFailFd.append('photo', makePngFile('new.png'));
  const editFailRes = await PATCH(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'PATCH',
      body: editFailFd,
    })
  );
  uploadShouldFail = false;
  assert(
    editFailRes.status === 502 &&
      MockDb.getDeliveryPartnerById(createdPartnerId)?.photo === originalPhotoUrl,
    'Replacement Cloudinary upload failure leaves existing partner photo intact'
  );

  // Successful replacement -> saves new URL and destroys previous Cloudinary asset ONLY AFTER DB save
  const destroyedBeforeReplace = destroyedPublicIds.length;
  const editReplaceFd = new FormData();
  editReplaceFd.append('id', createdPartnerId);
  editReplaceFd.append('photo', makePngFile('replacement.png'));
  const editReplaceRes = await PATCH(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'PATCH',
      body: editReplaceFd,
    })
  );
  const editReplaceJson = (await editReplaceRes.json()) as {
    success?: boolean;
    data?: { photo: string };
  };
  assert(
    editReplaceRes.status === 200 &&
      Boolean(editReplaceJson.data?.photo) &&
      editReplaceJson.data?.photo !== originalPhotoUrl &&
      destroyedPublicIds.length === destroyedBeforeReplace + 1,
    'Replacement photo updates DB URL and cleans up old Cloudinary asset after save succeeds'
  );

  // Removing photo via removePhoto=true resets to default and destroys old Cloudinary asset after DB save
  const destroyedBeforeRemove = destroyedPublicIds.length;
  const editRemoveFd = new FormData();
  editRemoveFd.append('id', createdPartnerId);
  editRemoveFd.append('removePhoto', 'true');
  const editRemoveRes = await PATCH(
    new NextRequest('http://localhost:3000/api/admin/delivery-partners', {
      method: 'PATCH',
      body: editRemoveFd,
    })
  );
  const editRemoveJson = (await editRemoveRes.json()) as {
    success?: boolean;
    data?: { photo: string };
  };
  assert(
    editRemoveRes.status === 200 &&
      typeof editRemoveJson.data?.photo === 'string' &&
      !editRemoveJson.data.photo.includes(DELIVERY_PARTNER_CLOUDINARY_FOLDER) &&
      destroyedPublicIds.length === destroyedBeforeRemove + 1,
    'removePhoto=true resets partner photo to default and destroys previous Cloudinary asset'
  );

  // Verify no Cloudinary secret or credentials exist in client code or JSON responses
  const clientCode = [
    fs.readFileSync(path.resolve(__dirname, '../components/admin/delivery-partners/RiderPhotoUploadField.tsx'), 'utf8'),
    fs.readFileSync(path.resolve(__dirname, '../app/admin/delivery-partners/DeliveryPartnersClient.tsx'), 'utf8'),
    fs.readFileSync(path.resolve(__dirname, '../lib/delivery-partner-photo-validation.ts'), 'utf8'),
  ].join('\n');

  const responseText = JSON.stringify({ createJpgJson, editReplaceJson });
  assert(
    !clientCode.includes('CLOUDINARY_API_SECRET') &&
      !clientCode.includes('CLOUDINARY_API_KEY') &&
      !clientCode.includes('NEXT_PUBLIC_CLOUDINARY') &&
      !responseText.includes('super-secret-test-value-never-leak') &&
      !responseText.includes('test-api-key-123'),
    'Zero Cloudinary secrets or credentials exposed in frontend code or API responses'
  );

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed}/${total} assertions passed (${failed} failed)`);
  console.log('NOTE: Mocked DB/Session/Cloudinary harness only. Live Atlas & browser not run.');
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
