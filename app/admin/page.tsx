'use client';

/**
 * @file app/admin/page.tsx
 * @description Enterprise Operations & Command Console for OX Shoes Pakistan.
 * Complete Modern Suite:
 *  - Executive Analytics & Revenue Velocity Visualizer
 *  - Full Footwear Inventory CRUD (Add, Edit, Delete, Stock Update)
 *  - Fulfillment & Consignment Logistics with 1-click WhatsApp (wa.me) & Shipping Labels
 *  - Promotional Coupons & Promo Codes Engine (Full CRUD)
 *  - Storefront Hero Banners & Announcements (Full CRUD)
 *  - Customers Directory & Lifetime Value (LTV)
 *  - In-App Customer Notification Hub (Broadcast & Single Send)
 *  - FBR Tax Invoices & Thermal Print
 *  - 12 Free Stack Environment Keys Configurator
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { createAdmin } from './manage-admins/actions';
import { getAdminMetrics } from '@/actions/dashboard.actions';
import { type AdminDashboardMetrics } from '@/types';
import { getAllOrders, updateOrderStatus, getOrderById } from '@/actions/order.actions';
import {
  getAllAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/actions/product.actions';
import {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '@/actions/coupon.actions';
import {
  getAllAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '@/actions/banner.actions';
import {
  getAllDeliveryAssignments,
  getActiveRidersForCity,
  assignOrderToPartner,
  reassignOrder,
  unassignOrder,
} from '@/actions/delivery.actions';
import { formatPKR } from '@/lib/formatters/currency';
import { formatDate } from '@/lib/formatters/date';
import { Logo } from '@/components/layout/Logo';
import {
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  ProductSubCategory,
  ProductBrand,
  CouponType,
  BannerPosition,
  type IOrder,
  type IProduct,
  type ICoupon,
  type IBanner,
  type IDeliveryPartner,
  type IDeliveryAssignment,
} from '@/types';
import {
  Package,
  TrendingUp,
  Truck,
  Bike,
  Users,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  FileText,
  Printer,
  Compass,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Clock,
  Filter,
  Download,
  Tag,
  X,
  Key,
  Save,
  Check,
  Copy,
  Eye,
  EyeOff,
  Database,
  Globe,
  Lock,
  Bell,
  Share2,
  Plus,
  Edit2,
  Trash2,
  LayoutDashboard,
  Ticket,
  Image as ImageIcon,
  CheckCheck,
  Send,
  Sparkles,
  BarChart3,
  AlertCircle,
  ShoppingBag,
  Archive,
  Upload,
  UserPlus,
  Loader2,
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'products'
  | 'coupons'
  | 'banners'
  | 'customers'
  | 'notifications'
  | 'invoices'
  | 'settings';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState<boolean>(true);

  // Core Data
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [coupons, setCoupons] = useState<ICoupon[]>([]);
  const [banners, setBanners] = useState<IBanner[]>([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');

  // Modals & Action States
  const [selectedLabelOrder, setSelectedLabelOrder] = useState<IOrder | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<IProduct | null>(null);
  const [showAddCouponModal, setShowAddCouponModal] = useState<boolean>(false);
  const [showAddBannerModal, setShowAddBannerModal] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delivery Fleet & Rider Assignment States
  const [deliveryAssignments, setDeliveryAssignments] = useState<IDeliveryAssignment[]>([]);
  const [assigningOrder, setAssigningOrder] = useState<IOrder | null>(null);
  const [candidateRiders, setCandidateRiders] = useState<Array<IDeliveryPartner & { distanceKm?: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState('');
  const [candidateRidersLoading, setCandidateRidersLoading] = useState<boolean>(false);
  const [reassigningAssignment, setReassigningAssignment] = useState<IDeliveryAssignment | null>(null);

  // Free Stack Environment Variables Configuration (12 Keys Only)
  const [envConfig, setEnvConfig] = useState({
    MONGODB_URI: '',
    MONGODB_DB_NAME: 'shoes_app_db',
    NEXTAUTH_SECRET: '',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXT_PUBLIC_APP_URL: 'https://ox-shoes-inayat.vercel.app',
    ADMIN_ACCESS_KEY: '',
    CRON_SECRET: '',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
  });
  const [savingEnv, setSavingEnv] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<boolean>(false);
  const [copiedEnv, setCopiedEnv] = useState<boolean>(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, onUpload: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    // Show local preview instantly
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    
    try {
      const formDataCloud = new FormData();
      formDataCloud.append('file', file);
      formDataCloud.append('upload_preset', 'ox_shoes_unsigned');
      formDataCloud.append('folder', 'ox-shoes-products');
      
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formDataCloud,
        }
      );
      
      const data = await res.json();
      
      if (data.secure_url) {
        onUpload(data.secure_url);
        setPreview(data.secure_url);
        console.log('Cloudinary URL:', data.secure_url);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      alert('Image upload failed! Try again.');
      setPreview('');
    } finally {
      setUploading(false);
    }
  };

  // Form states for Add Product
  const [newProduct, setNewProduct] = useState({
    name: '',
    nameUr: '',
    category: ProductCategory.MEN,
    subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
    price: 3950,
    originalPrice: 4950,
    stock: 25,
    weight: 850,
    sku: 'OX-KAP-009',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
    description: 'Authentic handcrafted Pakistani leather footwear with premium tyre sole and contrast hand-stitching.',
    isFeatured: true,
  });

  // Form state for Add Coupon
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: CouponType.PERCENTAGE,
    value: 15,
    minOrderAmount: 3000,
    maxDiscountAmount: 1500,
    usageLimit: 100,
  });

  // Form state for Add Banner
  const [newBanner, setNewBanner] = useState({
    title: '',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1600&q=80',
    link: '/shop',
    position: BannerPosition.HERO,
    order: 1,
  });

  // Notification form state
  const [notifTarget, setNotifTarget] = useState<'all' | 'single'>('all');
  const [notifUserId, setNotifUserId] = useState<string>('');
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifMessage, setNotifMessage] = useState<string>('');
  const [sendingNotif, setSendingNotif] = useState<boolean>(false);

  // Session & RBAC Super Admin Verification
  const { data: session } = useSession();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = sessionRole === 'super_admin';

  // Super Admin: Create Admin Modal Form States
  const ADMIN_PERMISSION_OPTIONS = [
    'products:read',
    'products:write',
    'products:delete',
    'orders:read',
    'orders:update_status',
    'orders:assign_courier',
    'marketing:manage',
    'finance:view_reports',
  ] as const;

  type AdminPermissionOption = (typeof ADMIN_PERMISSION_OPTIONS)[number];

  const [showCreateAdminModal, setShowCreateAdminModal] = useState<boolean>(false);
  const [adminName, setAdminName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissionOption[]>([
    'products:read',
    'orders:read',
  ]);
  const [creatingAdmin, setCreatingAdmin] = useState<boolean>(false);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminPassword(pwd);
  };

  const handleToggleAdminPermission = (perm: AdminPermissionOption) => {
    setAdminPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingAdmin) return;
    setCreateAdminError(null);

    if (!adminName.trim()) {
      setCreateAdminError('Full Name is required.');
      return;
    }
    if (!adminEmail.trim()) {
      setCreateAdminError('Email is required.');
      return;
    }
    if (!adminPassword || adminPassword.length < 8) {
      setCreateAdminError('Password must be at least 8 characters long.');
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await createAdmin({
        name: adminName.trim(),
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
        permissions: adminPermissions,
      });

      if (res.success) {
        setShowCreateAdminModal(false);
        setAdminName('');
        setAdminEmail('');
        setAdminPassword('');
        setAdminPermissions(['products:read', 'orders:read']);
        showNotification('Admin created successfully', 'success');
      } else {
        setCreateAdminError(res.error || 'Failed to create administrator account.');
      }
    } catch {
      setCreateAdminError('A network error occurred while creating admin.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, text });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Initial Data Load
  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminMetrics(),
      getAllOrders(),
      getAllAdminProducts(),
      getAllCoupons(),
      getAllAdminBanners(),
      getAllDeliveryAssignments(),
    ])
      .then(([metricsRes, ordersRes, productsRes, couponsRes, bannersRes, deliveryRes]) => {
        if (!active) return;
        if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data);
        if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
        if (productsRes.success && productsRes.data) setProducts(productsRes.data);
        if (couponsRes.success && couponsRes.data) setCoupons(couponsRes.data);
        if (bannersRes.success && bannersRes.data) setBanners(bannersRes.data);
        if (deliveryRes.success && deliveryRes.data) setDeliveryAssignments(deliveryRes.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch Environment variables
  useEffect(() => {
    fetch('/api/admin/env')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setEnvConfig((prev) => ({ ...prev, ...res.data }));
        }
      })
      .catch(() => {});
  }, []);

  const refreshAllData = async () => {
    setLoading(true);
    const [metricsRes, ordersRes, productsRes, couponsRes, bannersRes, deliveryRes] = await Promise.all([
      getAdminMetrics(),
      getAllOrders(),
      getAllAdminProducts(),
      getAllCoupons(),
      getAllAdminBanners(),
      getAllDeliveryAssignments(),
    ]);
    if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data);
    if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
    if (productsRes.success && productsRes.data) setProducts(productsRes.data);
    if (couponsRes.success && couponsRes.data) setCoupons(couponsRes.data);
    if (bannersRes.success && bannersRes.data) setBanners(bannersRes.data);
    if (deliveryRes.success && deliveryRes.data) setDeliveryAssignments(deliveryRes.data);
    setLoading(false);
    showNotification('All dashboard data refreshed!');
  };

  // Delivery Partner Assignment Modal
  const handleOpenAssignModal = async (order: IOrder, existingAssignment?: IDeliveryAssignment) => {
    setAssigningOrder(order);
    setReassigningAssignment(existingAssignment || null);
    setCandidateRidersLoading(true);
    const shipAddr = order.shippingAddress as unknown as Record<string, string> | undefined;
    const city = shipAddr?.city || 'Peshawar';
    try {
      const res = await getActiveRidersForCity(city);
      if (res.success && res.data) {
        setCandidateRiders(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setCandidateRidersLoading(false);
    }
  };

  const handleConfirmAssign = async (riderId: string) => {
    if (!assigningOrder) return;
    try {
      if (reassigningAssignment) {
        // Fetch order to get current version for OCC
        const orderRes = await getOrderById(reassigningAssignment.orderId.toString());
        if (!orderRes.success || !orderRes.data) {
          showNotification('Order not found', 'error');
          return;
        }
        const expectedVersion = orderRes.data.version ?? 0;
        const res = await reassignOrder(reassigningAssignment._id.toString(), riderId, expectedVersion);
        if (res.success) {
          showNotification('Consignment successfully reassigned to new fleet rider!', 'success');
          setAssigningOrder(null);
          setReassigningAssignment(null);
          refreshAllData();
        } else {
          showNotification(res.error || 'Failed to reassign order.', 'error');
        }
      } else {
        const res = await assignOrderToPartner({
          orderId: assigningOrder._id.toString(),
          partnerId: riderId,
          expectedVersion: assigningOrder.version ?? 0,
        });
        if (res.success) {
          showNotification('Consignment assigned to private fleet rider! Order marked as SHIPPED.', 'success');
          setAssigningOrder(null);
          refreshAllData();
        } else {
          showNotification(res.error || 'Failed to assign order.', 'error');
        }
      }
    } catch {
      showNotification('Error performing rider assignment.', 'error');
    }
  };

  const handleUnassignOrder = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to unassign this rider? The order will be unlinked and returned to open dispatch.')) return;
    try {
      // Need to find the order id for this assignment — check if assignment object is available in scope;
      const assignmentObj = deliveryAssignments.find((a) => a._id.toString() === assignmentId);
      if (!assignmentObj) { showNotification('Assignment not found', 'error'); return; }
      const orderRes = await getOrderById(assignmentObj.orderId.toString());
      if (!orderRes.success || !orderRes.data) { showNotification('Order not found', 'error'); return; }
      const expectedVersion = orderRes.data.version ?? 0;
      const res = await unassignOrder(assignmentId, expectedVersion);
      if (res.success) {
        showNotification('Order unassigned from rider.', 'success');
        refreshAllData();
      } else {
        showNotification(res.error || 'Failed to unassign order.', 'error');
      }
    } catch {
      showNotification('Error unassigning rider.', 'error');
    }
  };

  // Orders Status Update
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const res = await updateOrderStatus(orderId, { status: newStatus });
    if (res.success) {
      setOrders((prev) =>
        prev.map((o) => (o._id.toString() === orderId ? (res.data as IOrder) : o))
      );
      showNotification(`Order status updated to ${newStatus}. Customer in-app alert created!`);
    } else {
      showNotification(res.error || 'Failed to update order status', 'error');
    }
  };

  // Archive Delivered Order (Frees Atlas storage)
  const handleArchiveOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/admin/orders/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.filter((o) => o._id.toString() !== orderId));
        showNotification('Delivered order archived successfully! MongoDB Atlas space saved.');
      } else {
        showNotification(data.error || 'Failed to archive order.', 'error');
      }
    } catch {
      showNotification('Network error while archiving order.', 'error');
    }
  };

  // Product CRUD
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.nameUr) {
      showNotification('Please enter both English and Urdu product names.', 'error');
      return;
    }
    const res = await createProduct({
      name: newProduct.name,
      nameUr: newProduct.nameUr,
      category: newProduct.category,
      subCategory: newProduct.subCategory,
      brand: ProductBrand.LOCAL,
      price: Number(newProduct.price),
      originalPrice: Number(newProduct.originalPrice),
      stock: Number(newProduct.stock),
      weight: Number(newProduct.weight),
      sku: newProduct.sku,
      images: [newProduct.image],
      description: newProduct.description,
      isFeatured: newProduct.isFeatured,
      isActive: true,
      sizes: ['39', '40', '41', '42', '43', '44'],
      colors: [{ name: 'Mustard Brown', hex: '#8B4513' }],
    });

    if (res.success) {
      setProducts([res.data, ...products]);
      setShowAddProductModal(false);
      showNotification(`"${newProduct.name}" added to catalog successfully!`);
      setNewProduct({
        name: '',
        nameUr: '',
        category: ProductCategory.MEN,
        subCategory: ProductSubCategory.PESHAWARI_CHAPPAL,
        price: 3950,
        originalPrice: 4950,
        stock: 25,
        weight: 850,
        sku: 'OX-KAP-009',
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
        description: 'Authentic handcrafted Pakistani leather footwear with premium tyre sole and contrast hand-stitching.',
        isFeatured: true,
      });
    } else {
      showNotification(res.error || 'Failed to create product', 'error');
    }
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<IProduct>) => {
    const res = await updateProduct(productId, updates);
    if (res.success) {
      setProducts((prev) =>
        prev.map((p) => (p._id.toString() === productId ? (res.data as IProduct) : p))
      );
      setEditingProduct(null);
      showNotification('Product updated successfully!');
    } else {
      showNotification(res.error || 'Failed to update product', 'error');
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) return;
    const res = await deleteProduct(productId);
    if (res.success) {
      setProducts((prev) => prev.filter((p) => p._id.toString() !== productId));
      showNotification(`"${productName}" removed from catalog.`);
    } else {
      showNotification(res.error || 'Failed to delete product', 'error');
    }
  };

  // Coupon CRUD
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) {
      showNotification('Coupon code is required.', 'error');
      return;
    }
    const res = await createCoupon({
      code: newCoupon.code.trim().toUpperCase(),
      type: newCoupon.type,
      value: Number(newCoupon.value),
      minOrderAmount: Number(newCoupon.minOrderAmount),
      maxDiscountAmount: newCoupon.maxDiscountAmount ? Number(newCoupon.maxDiscountAmount) : undefined,
      usageLimit: Number(newCoupon.usageLimit),
      isActive: true,
    });
    if (res.success) {
      setCoupons([res.data, ...coupons]);
      setShowAddCouponModal(false);
      setNewCoupon({
        code: '',
        type: CouponType.PERCENTAGE,
        value: 15,
        minOrderAmount: 3000,
        maxDiscountAmount: 1500,
        usageLimit: 100,
      });
      showNotification(`Coupon ${res.data.code} created successfully!`);
    } else {
      showNotification(res.error || 'Failed to create coupon', 'error');
    }
  };

  const handleToggleCoupon = async (couponId: string, currentStatus: boolean) => {
    const res = await updateCoupon(couponId, { isActive: !currentStatus });
    if (res.success) {
      setCoupons((prev) =>
        prev.map((c) => (c._id.toString() === couponId ? (res.data as ICoupon) : c))
      );
      showNotification(`Coupon ${!currentStatus ? 'activated' : 'paused'}!`);
    }
  };

  const handleDeleteCoupon = async (couponId: string, code: string) => {
    if (!confirm(`Delete coupon ${code}?`)) return;
    const res = await deleteCoupon(couponId);
    if (res.success) {
      setCoupons((prev) => prev.filter((c) => c._id.toString() !== couponId));
      showNotification(`Coupon ${code} deleted.`);
    }
  };

  // Banner CRUD
  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanner.title.trim()) {
      showNotification('Banner title is required.', 'error');
      return;
    }
    const res = await createBanner({
      title: newBanner.title.trim(),
      image: newBanner.image.trim(),
      link: newBanner.link.trim(),
      position: newBanner.position,
      order: Number(newBanner.order),
      isActive: true,
    });
    if (res.success && res.data) {
      setBanners([res.data, ...banners]);
      setShowAddBannerModal(false);
      setNewBanner({
        title: '',
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1600&q=80',
        link: '/shop',
        position: BannerPosition.HERO,
        order: 1,
      });
      showNotification('Storefront banner added successfully!');
    }
  };

  const handleToggleBanner = async (bannerId: string, currentStatus: boolean) => {
    const res = await updateBanner(bannerId, { isActive: !currentStatus });
    if (res.success && res.data) {
      setBanners((prev) =>
        prev.map((b) => (b._id.toString() === bannerId ? (res.data as IBanner) : b))
      );
      showNotification(`Banner ${!currentStatus ? 'activated' : 'paused'}!`);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!confirm('Delete this banner?')) return;
    const res = await deleteBanner(bannerId);
    if (res.success) {
      setBanners((prev) => prev.filter((b) => b._id.toString() !== bannerId));
      showNotification('Banner removed.');
    }
  };

  // Notification Send
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showNotification('Title and message body are required.', 'error');
      return;
    }
    setSendingNotif(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: notifTarget,
          userId: notifTarget === 'single' ? notifUserId.trim() : undefined,
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          type: 'promotion',
          link: '/shop',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(
          notifTarget === 'all'
            ? 'Broadcast notification dispatched to all customers!'
            : `Notification sent to customer ${notifUserId}!`
        );
        setNotifTitle('');
        setNotifMessage('');
        setNotifUserId('');
      } else {
        showNotification(data.error || 'Failed to dispatch notification', 'error');
      }
    } catch {
      showNotification('Network error while dispatching notification', 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  // Save Environment Configuration
  const handleSaveEnv = async () => {
    setSavingEnv(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/admin/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envConfig),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('Environment variables saved successfully to .env.local!');
      } else {
        setSaveStatus(data.error || 'Failed to save environment variables.');
      }
    } catch {
      setSaveStatus('Network error while saving environment.');
    } finally {
      setSavingEnv(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const handleCopyEnv = () => {
    const lines = Object.entries(envConfig)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n');
    navigator.clipboard.writeText(lines);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleExportCSV = () => {
    if (!orders.length) return;
    const headers = [
      'Order Number',
      'Date',
      'Customer Name',
      'Phone',
      'City',
      'Payment Method',
      'Payment Status',
      'Fulfillment Status',
      'Total Amount (PKR)',
      'Tracking Number',
    ];
    const rows = orders.map((ord) => {
      const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
      return [
        `"${ord.orderNumber}"`,
        `"${new Date(ord.createdAt).toLocaleDateString('en-PK')}"`,
        `"${(shipAddr?.fullName || 'Customer').replace(/"/g, '""')}"`,
        `"${(shipAddr?.phone || '').replace(/"/g, '""')}"`,
        `"${(shipAddr?.city || 'Pakistan').replace(/"/g, '""')}"`,
        `"${ord.paymentMethod}"`,
        `"${ord.paymentStatus}"`,
        `"${ord.status}"`,
        ord.totalAmount,
        `"${ord.trackingNumber || 'N/A'}"`,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OX_Shoes_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Orders
  const filteredOrders = orders.filter((ord) => {
    const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
    const matchesSearch =
      !searchTerm ||
      ord.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shipAddr?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shipAddr?.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ord.trackingNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPayment =
      paymentFilter === 'all' ||
      (paymentFilter === 'paid' && ord.paymentStatus === PaymentStatus.PAID) ||
      (paymentFilter === 'pending' && ord.paymentStatus !== PaymentStatus.PAID);

    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;

    return matchesSearch && matchesPayment && matchesStatus;
  });

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nameUr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      productCategoryFilter === 'all' || p.category === productCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Admin Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest font-mono">
            Command ERP 2026
          </span>
          <span className="hidden md:inline text-xs text-neutral-500">
            {metrics?.totalProducts || products.length} Shoes Listed · {orders.length} Consignments
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/admin/archived-orders"
            className="text-amber-400 hover:text-amber-300 font-bold transition-colors flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archived Orders</span>
          </Link>
          <Link
            href="/stores"
            className="text-neutral-400 hover:text-white transition-colors hidden sm:flex items-center gap-1"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Store Locator</span>
          </Link>
          <Link
            href="/"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Storefront ↗
          </Link>
          <button
            type="button"
            onClick={handleExportCSV}
            className="text-black font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-sm"
            title="Export Orders to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            type="button"
            onClick={refreshAllData}
            disabled={loading}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors border border-neutral-700"
            title="Refresh All Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </header>

      {/* Action Toast Notification */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
          <div
            className={`px-4 py-3 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2.5 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-950 border border-red-500/40 text-red-300'
            }`}
          >
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout (Sidebar + Viewport) */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1500px] mx-auto">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-800/80 bg-neutral-900/40 p-4 space-y-6 shrink-0">
          {/* Super Admin: Create Admin Action Box */}
          {isSuperAdmin && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block font-mono">
                  Super Admin
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-black font-black uppercase font-mono">
                  RBAC
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-amber-500/20 cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 stroke-[2.5]" />
                  <span>Create Admin</span>
                </button>
                <Link
                  href="/admin/manage-admins"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-amber-400" />
                    <span>Manage Admins</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
                <Link
                  href="/admin/about"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span>About Page & Media</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 block">
              Core Operations
            </span>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Executive Overview</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'orders'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4" />
                  <span>Orders & Courier</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    activeTab === 'orders' ? 'bg-black text-amber-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {orders.length}
                </span>
              </button>

              <Link
                href="/admin/archived-orders"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-neutral-300 hover:bg-neutral-800/60 hover:text-white group"
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="h-4 w-4 text-amber-400 group-hover:text-amber-300" />
                  <span>Archived Orders</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                  Atlas Storage
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'products'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="h-4 w-4" />
                  <span>Products Catalog</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    activeTab === 'products' ? 'bg-black text-amber-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {products.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('coupons')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'coupons'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Ticket className="h-4 w-4" />
                  <span>Promo Coupons</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    activeTab === 'coupons' ? 'bg-black text-amber-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {coupons.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('banners')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'banners'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="h-4 w-4" />
                  <span>Storefront Banners</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    activeTab === 'banners' ? 'bg-black text-amber-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {banners.length}
                </span>
              </button>
            </nav>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 block">
              Fleet & Couriers (Free Stack)
            </span>
            <nav className="space-y-1">
              <Link
                href="/admin/delivery-partners"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
              >
                <div className="flex items-center gap-2.5">
                  <Bike className="h-4 w-4 text-emerald-400" />
                  <span>Fleet Dispatch & Map</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Radar Live
                </span>
              </Link>

              <Link
                href="/delivery"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-neutral-300 hover:bg-neutral-800/60 hover:text-white group"
              >
                <div className="flex items-center gap-2.5">
                  <Bike className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Rider Terminal App</span>
                </div>
                <span className="text-[9px] font-bold text-amber-400">Terminal →</span>
              </Link>
            </nav>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 block">
              Customer Outreach
            </span>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('customers')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'customers'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4" />
                  <span>Customers Directory</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'notifications'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4" />
                  <span>In-App Alerts & SMS</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'invoices'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4" />
                  <span>FBR Tax Invoices</span>
                </div>
              </button>
            </nav>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 block">
              Configuration
            </span>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'settings'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Key className="h-4 w-4" />
                  <span>Environment (12 Keys)</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Quick Metrics Badge */}
          <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Total COD Balance</span>
              <span className="text-emerald-400 font-mono font-bold">
                {formatPKR(metrics?.totalRevenuePKR || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">AOV</span>
              <span className="text-white font-mono font-bold">
                {formatPKR(metrics?.aovPKR || 4200)}
              </span>
            </div>
          </div>
        </aside>

        {/* Primary Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {/* TAB 1: EXECUTIVE OVERVIEW & ANALYTICS */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                    <span>Executive Analytics & Sales Velocity</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Live telemetry across Pakistani fulfillment hubs, TCS consignments, and revenue metrics
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 transition-colors shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New Shoe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-800 text-neutral-200 font-bold text-xs flex items-center gap-1.5 hover:bg-neutral-700 transition-colors border border-neutral-700"
                  >
                    <span>View Orders →</span>
                  </button>
                </div>
              </div>

              {/* KPI Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Gross Revenue (PKR)</span>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {formatPKR(metrics?.totalRevenuePKR || 0)}
                  </div>
                  <span className="text-[11px] text-neutral-500 block">100% Cash on Delivery reconciled</span>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Total Orders</span>
                  <div className="text-2xl font-black font-mono text-white">
                    {metrics?.totalOrders || orders.length}
                  </div>
                  <span className="text-[11px] text-amber-400 block font-bold">
                    {metrics?.pendingOrders || 0} Pending Dispatch
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Average Order Value (AOV)</span>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {formatPKR(metrics?.aovPKR || 4200)}
                  </div>
                  <span className="text-[11px] text-neutral-500 block">Per checkout parcel</span>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Active Footwear SKUs</span>
                  <div className="text-2xl font-black font-mono text-sky-400">
                    {metrics?.totalProducts || products.length}
                  </div>
                  <span className="text-[11px] text-red-400 block font-bold">
                    {metrics?.lowStockProducts || 0} Low Stock Alert
                  </span>
                </div>
              </div>

              {/* Analytics Visualizer: 7-Day Revenue Trend & City Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-Day Sales Velocity Visualizer */}
                <div className="lg:col-span-2 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-amber-400" />
                      <span>Weekly Sales Velocity (PKR)</span>
                    </h3>
                    <span className="text-[11px] text-neutral-400">Nationwide Orders Dispatched</span>
                  </div>

                  <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
                    {(metrics?.revenueTrend || [
                      { label: 'Mon', amount: 9000, count: 2 },
                      { label: 'Tue', amount: 15000, count: 3 },
                      { label: 'Wed', amount: 12000, count: 2 },
                      { label: 'Thu', amount: 18000, count: 4 },
                      { label: 'Fri', amount: 24000, count: 5 },
                      { label: 'Sat', amount: 28000, count: 6 },
                      { label: 'Sun', amount: 21000, count: 4 },
                    ]).map((day, idx) => {
                      const max = 30000;
                      const heightPct = Math.min(100, Math.max(15, Math.round((day.amount / max) * 100)));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                          <span className="text-[10px] font-mono text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatPKR(day.amount)}
                          </span>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full rounded-t-xl bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-amber-300 transition-all shadow-md"
                          />
                          <span className="text-xs font-bold text-neutral-400 group-hover:text-white">
                            {day.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* City Distribution */}
                <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      <span>Top Dispatch Cities</span>
                    </h3>
                    <span className="text-[11px] text-neutral-400">By Revenue</span>
                  </div>

                  <div className="space-y-3">
                    {(metrics?.cityDistribution || [
                      { city: 'Karachi', count: 6, totalPKR: 28500 },
                      { city: 'Lahore', count: 5, totalPKR: 22000 },
                      { city: 'Islamabad', count: 3, totalPKR: 13500 },
                      { city: 'Peshawar', count: 2, totalPKR: 9000 },
                    ]).map((c, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{c.city}</span>
                          <span className="font-mono text-emerald-400 font-bold">{formatPKR(c.totalPKR)}</span>
                        </div>
                        <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.round((c.totalPKR / (metrics?.totalRevenuePKR || 50000)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Orders Snapshot */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span>Recent Customer Orders</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-amber-400 hover:underline font-bold"
                  >
                    View All Orders →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400">
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Quick Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 font-medium">
                      {orders.slice(0, 5).map((ord) => {
                        const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                        const phone = (shipAddr?.phone || '').replace(/\D/g, '');
                        const cleanPhone = phone.startsWith('03') ? '92' + phone.slice(1) : phone || '923001234567';
                        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${shipAddr?.fullName || 'Customer'}, your order ${ord.orderNumber} is ${ord.status} - OX Shoes`)}`;

                        return (
                          <tr key={ord._id.toString()} className="hover:bg-neutral-800/40">
                            <td className="py-3 px-3 font-mono font-bold text-white">
                              <Link href={`/admin/orders/${ord._id}`} className="hover:text-amber-400">
                                {ord.orderNumber}
                              </Link>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-white font-bold">{shipAddr?.fullName || 'Customer'}</span>
                              <span className="text-[11px] text-neutral-400 block">{shipAddr?.city || 'Pakistan'}</span>
                            </td>
                            <td className="py-3 px-3 text-neutral-300">
                              {ord.paymentMethod}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              {formatPKR(ord.totalAmount)}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  ord.status === OrderStatus.DELIVERED
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : ord.status === OrderStatus.SHIPPED
                                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold text-[11px] transition-colors border border-emerald-500/20 shadow-sm"
                              >
                                <Share2 className="h-3 w-3" />
                                <span>WhatsApp</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS & FULFILLMENT */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-500" />
                    <span>Live Consignment & Dispatch Queue ({filteredOrders.length})</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Update fulfillment status, print FBR tax invoices, generate TCS shipping labels, and send 1-click WhatsApp alerts
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/admin/archived-orders"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition-colors shadow-sm"
                    title="View archived orders and free database storage"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Archived Orders</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700 flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by order #, customer name, phone, city, or tracking..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none focus:border-amber-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value={OrderStatus.CONFIRMED}>Confirmed</option>
                    <option value={OrderStatus.PROCESSING}>Processing</option>
                    <option value={OrderStatus.SHIPPED}>Shipped</option>
                    <option value={OrderStatus.DELIVERED}>Delivered</option>
                    <option value={OrderStatus.CANCELLED}>Cancelled</option>
                  </select>

                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none focus:border-amber-500"
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Paid (Prepaid)</option>
                    <option value="pending">Pending (COD)</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3">Order #</th>
                        <th className="py-3 px-3">Recipient & City</th>
                        <th className="py-3 px-3">Amount (PKR)</th>
                        <th className="py-3 px-3">Fulfillment Status</th>
                        <th className="py-3 px-3">Fleet Rider</th>
                        <th className="py-3 px-3">Courier Tracking</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 font-medium">
                      {filteredOrders.length > 0 ? (
                        filteredOrders.map((ord) => {
                          const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                          const phone = (shipAddr?.phone || '').replace(/\D/g, '');
                          const cleanPhone = phone.startsWith('03') ? '92' + phone.slice(1) : phone || '923001234567';
                          const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${shipAddr?.fullName || 'Customer'}, your order ${ord.orderNumber} is ${ord.status} - OX Shoes`)}`;
                          const assignment = deliveryAssignments.find(
                            (a) => a.orderId.toString() === ord._id.toString()
                          );

                          return (
                            <tr key={ord._id.toString()} className="hover:bg-neutral-800/40 transition-colors">
                              <td className="py-3.5 px-3 font-mono font-bold text-white">
                                <Link href={`/admin/orders/${ord._id}`} className="hover:text-amber-400">
                                  {ord.orderNumber}
                                </Link>
                                <span className="text-[10px] text-neutral-500 block">
                                  {formatDate(ord.createdAt)}
                                </span>
                              </td>
                              <td className="py-3.5 px-3">
                                <span className="text-white font-bold block">{shipAddr?.fullName || 'Customer'}</span>
                                <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-amber-500" />
                                  {shipAddr?.city || 'Lahore'}, Pakistan
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-bold text-emerald-400 font-mono">
                                {formatPKR(ord.totalAmount)}
                              </td>
                              <td className="py-3.5 px-3">
                                <select
                                  value={ord.status}
                                  onChange={(e) => handleUpdateStatus(ord._id.toString(), e.target.value as OrderStatus)}
                                  className="bg-neutral-800 border border-neutral-700 text-neutral-200 rounded px-2.5 py-1 text-[11px] font-bold outline-none focus:border-amber-500"
                                >
                                  <option value={OrderStatus.CONFIRMED}>CONFIRMED</option>
                                  <option value={OrderStatus.PROCESSING}>PROCESSING</option>
                                  <option value={OrderStatus.SHIPPED}>SHIPPED (TCS)</option>
                                  <option value={OrderStatus.DELIVERED}>DELIVERED</option>
                                  <option value={OrderStatus.CANCELLED}>CANCELLED</option>
                                </select>
                              </td>
                              <td className="py-3.5 px-3">
                                {assignment ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                                      <Bike className="h-3 w-3 shrink-0" />
                                      <span className="truncate max-w-[100px]">{assignment.partnerName}</span>
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAssignModal(ord, assignment)}
                                        className="text-amber-400 hover:text-amber-300 font-bold underline"
                                      >
                                        Reassign
                                      </button>
                                      <span className="text-neutral-600">·</span>
                                      <button
                                        type="button"
                                        onClick={() => handleUnassignOrder(assignment._id.toString())}
                                        className="text-red-400 hover:text-red-300 underline"
                                      >
                                        Unassign
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignModal(ord)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black font-bold text-[11px] transition-colors border border-amber-500/20 shadow-sm"
                                    title="Assign this order to private fleet rider in this city"
                                  >
                                    <Bike className="h-3 w-3" />
                                    <span>Assign Rider</span>
                                  </button>
                                )}
                              </td>
                              <td className="py-3.5 px-3">
                                <Link
                                  href={`/track?order=${ord.orderNumber}`}
                                  className="font-mono text-[11px] text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                                >
                                  <Truck className="h-3 w-3" />
                                  <span>{ord.trackingNumber || 'Track Delivery'}</span>
                                </Link>
                              </td>
                              <td className="py-3.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold text-[11px] transition-colors border border-emerald-500/20 shadow-sm"
                                  title="Send WhatsApp update to customer"
                                >
                                  <Share2 className="h-3 w-3" />
                                  <span>WhatsApp</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setSelectedLabelOrder(ord)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-400 font-bold text-[11px] transition-colors border border-neutral-700"
                                  title="Generate Shipping Label"
                                >
                                  <Tag className="h-3 w-3" />
                                  <span>Label</span>
                                </button>
                                <Link
                                  href={`/invoice/${ord._id}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-[11px] transition-colors border border-neutral-700"
                                  title="Tax Invoice"
                                >
                                  <Printer className="h-3 w-3" />
                                  <span>Invoice</span>
                                </Link>
                                {ord.status === OrderStatus.DELIVERED && (
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveOrder(ord._id.toString())}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black font-bold text-[11px] transition-colors border border-amber-500/30 shadow-sm"
                                    title="Archive delivered order to save Atlas 512MB space"
                                  >
                                    <Archive className="h-3 w-3" />
                                    <span>Archive</span>
                                  </button>
                                )}
                                <Link
                                  href={`/admin/orders/${ord._id}`}
                                  className="text-neutral-400 hover:text-white font-bold text-[11px]"
                                >
                                  Details →
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-neutral-500">
                            No orders found matching the filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCT CATALOG CRUD */}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-amber-500" />
                    <span>Footwear Catalog Management ({filteredProducts.length})</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Create new footwear models, update pricing and inventory, manage stock levels, and toggle featured releases
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add New Footwear</span>
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by shoe name, Urdu title, SKU..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none focus:border-amber-500"
                >
                  <option value="all">All Categories</option>
                  <option value={ProductCategory.MEN}>Men</option>
                  <option value={ProductCategory.WOMEN}>Women</option>
                  <option value={ProductCategory.KIDS}>Kids</option>
                </select>
              </div>

              {/* Products Table */}
              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3">Footwear</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Price (PKR)</th>
                        <th className="py-3 px-3">Stock Level</th>
                        <th className="py-3 px-3">Featured</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 font-medium">
                      {filteredProducts.map((prod) => (
                        <tr key={prod._id.toString()} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3.5 px-3 flex items-center gap-3">
                            <div className="relative h-12 w-12 rounded-xl bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
                              {prod.images && prod.images[0] && (
                                <Image
                                  src={prod.images[0]}
                                  alt={prod.name}
                                  fill
                                  referrerPolicy="no-referrer"
                                  className="object-cover"
                                  sizes="50px"
                                />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-white block text-sm">{prod.name}</span>
                              <span className="text-[11px] text-amber-500 font-urdu block">{prod.nameUr}</span>
                              <span className="text-[10px] text-neutral-500 font-mono">SKU: {prod.sku}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="text-neutral-200 block font-bold">{prod.category}</span>
                            <span className="text-[11px] text-neutral-500">{prod.subCategory}</span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-mono text-emerald-400 font-bold block">{formatPKR(prod.price)}</span>
                            {prod.originalPrice > prod.price && (
                              <span className="text-[10px] text-neutral-500 line-through">
                                {formatPKR(prod.originalPrice)}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono font-bold ${
                                  prod.stock <= 5 ? 'text-red-400' : 'text-neutral-200'
                                }`}
                              >
                                {prod.stock} units
                              </span>
                              <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-800 text-[10px] overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateProduct(prod._id.toString(), {
                                      stock: Math.max(0, prod.stock - 1),
                                    })
                                  }
                                  className="px-2 py-0.5 hover:bg-neutral-700 text-neutral-300"
                                  title="Decrease Stock"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateProduct(prod._id.toString(), {
                                      stock: prod.stock + 1,
                                    })
                                  }
                                  className="px-2 py-0.5 hover:bg-neutral-700 text-neutral-300"
                                  title="Increase Stock"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateProduct(prod._id.toString(), {
                                  isFeatured: !prod.isFeatured,
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                prod.isFeatured
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : 'bg-neutral-800 text-neutral-500'
                              }`}
                            >
                              {prod.isFeatured ? 'Featured' : 'Standard'}
                            </button>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingProduct(prod)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 transition-colors"
                                title="Edit Shoe"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(prod._id.toString(), prod.name)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 transition-colors"
                                title="Delete Shoe"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <Link
                                href={`/product/${prod.slug}`}
                                target="_blank"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                                title="View on Storefront"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COUPONS & PROMOS CRUD */}
          {activeTab === 'coupons' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-amber-500" />
                    <span>Promotional Coupons & Deals ({coupons.length})</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Create percentage or fixed PKR discount vouchers, set minimum order values, and limit usage counts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddCouponModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Coupon</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coupons.map((coupon) => (
                  <div
                    key={coupon._id.toString()}
                    className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-black text-amber-400 tracking-wider">
                        {coupon.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleCoupon(coupon._id.toString(), coupon.isActive)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          coupon.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        {coupon.isActive ? 'Active' : 'Paused'}
                      </button>
                    </div>

                    <div className="text-2xl font-black text-white font-mono">
                      {coupon.type === CouponType.PERCENTAGE
                        ? `${coupon.value}% OFF`
                        : `${formatPKR(coupon.value)} OFF`}
                    </div>

                    <div className="text-xs text-neutral-400 space-y-1">
                      <div>Min Spend: <strong className="text-neutral-200">{formatPKR(coupon.minOrderAmount)}</strong></div>
                      <div>Redeemed: <strong className="text-neutral-200">{coupon.usedCount || 0} times</strong> (Limit: {coupon.usageLimit})</div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">
                        Expires: {formatDate(coupon.expiresAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(coupon._id.toString(), coupon.code)}
                        className="text-neutral-500 hover:text-red-400 text-xs font-bold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: BANNERS CRUD */}
          {activeTab === 'banners' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-amber-500" />
                    <span>Storefront Promotional Banners ({banners.length})</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Control hero showcase headers, discount strips, and seasonal campaign cards
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddBannerModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Banner</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {banners.map((banner) => (
                  <div
                    key={banner._id.toString()}
                    className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 overflow-hidden"
                  >
                    {banner.image && (
                      <div className="relative h-40 w-full rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800">
                        <Image
                          src={banner.image}
                          alt={banner.title}
                          fill
                          referrerPolicy="no-referrer"
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold font-mono uppercase text-amber-400">
                          {banner.position}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleBanner(banner._id.toString(), banner.isActive)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            banner.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-500'
                          }`}
                        >
                          {banner.isActive ? 'Active' : 'Paused'}
                        </button>
                      </div>
                      <h4 className="font-bold text-white text-sm">{banner.title}</h4>
                      <span className="text-xs text-neutral-400 font-mono block">Link: {banner.link}</span>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500 font-mono">Order: #{banner.order}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteBanner(banner._id.toString())}
                        className="text-neutral-500 hover:text-red-400 text-xs font-bold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CUSTOMERS DIRECTORY */}
          {activeTab === 'customers' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-500" />
                    <span>Pakistani Customer Directory</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Engage with customers directly via 1-click WhatsApp wa.me or in-app alerts
                  </p>
                </div>

                <Link
                  href="/admin/customers"
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700"
                >
                  Dedicated Customer View ↗
                </Link>
              </div>

              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Contact & City</th>
                        <th className="py-3 px-3">Orders</th>
                        <th className="py-3 px-3">Total Spend</th>
                        <th className="py-3 px-3 text-right">Direct Outreach</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 font-medium">
                      {orders.slice(0, 10).map((ord, idx) => {
                        const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                        const phone = (shipAddr?.phone || '').replace(/\D/g, '');
                        const cleanPhone = phone.startsWith('03') ? '92' + phone.slice(1) : phone || '923001234567';
                        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${shipAddr?.fullName || 'Customer'}, your order ${ord.orderNumber} is ${ord.status} - OX Shoes`)}`;

                        return (
                          <tr key={idx} className="hover:bg-neutral-800/40 transition-colors">
                            <td className="py-3 px-3">
                              <span className="font-bold text-white block">{shipAddr?.fullName || 'Customer'}</span>
                              <span className="text-[10px] text-neutral-500 font-mono">Last Order: #{ord.orderNumber}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono text-neutral-200 block">{shipAddr?.phone || 'No phone'}</span>
                              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {shipAddr?.city || 'Pakistan'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 font-bold text-[11px]">
                                1 order
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              {formatPKR(ord.totalAmount)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black font-bold text-xs transition-all border border-emerald-500/30 shadow-sm"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: IN-APP NOTIFICATIONS HUB */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Bell className="h-5 w-5 text-amber-500" />
                    <span>Customer Notification Hub</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Dispatch free in-app alerts directly to customer notification bells without third-party fees
                  </p>
                </div>

                <Link
                  href="/admin/notifications"
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 border border-neutral-700"
                >
                  Full Template Suite ↗
                </Link>
              </div>

              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 max-w-2xl">
                <form onSubmit={handleSendNotification} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 block">Dispatch Target</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNotifTarget('all')}
                        className={`p-2.5 rounded-xl border text-xs font-bold ${
                          notifTarget === 'all'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        Send to All Customers
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifTarget('single')}
                        className={`p-2.5 rounded-xl border text-xs font-bold ${
                          notifTarget === 'single'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        Single Customer
                      </button>
                    </div>
                  </div>

                  {notifTarget === 'single' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-300 block">Customer ID / Phone</label>
                      <input
                        type="text"
                        value={notifUserId}
                        onChange={(e) => setNotifUserId(e.target.value)}
                        placeholder="e.g. 03001234567 or user ID"
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-300 block">Alert Headline</label>
                    <input
                      type="text"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="e.g. Eid Footwear Drop Live!"
                      className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-300 block">Message Body</label>
                    <textarea
                      rows={3}
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="Write message content for customer notification inbox..."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sendingNotif}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>{sendingNotif ? 'Dispatching...' : 'Dispatch In-App Alert'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 8: TAX INVOICES */}
          {activeTab === 'invoices' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-500" />
                    <span>FBR Tax Invoices (17% Sales Tax)</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Compliant sales tax invoices generated automatically for every Pakistani retail consignment
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-3">Invoice #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">FBR 17% GST</th>
                        <th className="py-3 px-3">Total Payable</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800 font-medium">
                      {orders.map((ord) => {
                        const shipAddr = ord.shippingAddress as unknown as Record<string, string> | undefined;
                        return (
                          <tr key={ord._id.toString()} className="hover:bg-neutral-800/40">
                            <td className="py-3 px-3 font-mono font-bold text-white">
                              INV-{ord.orderNumber}
                            </td>
                            <td className="py-3 px-3 text-neutral-400 font-mono">
                              {formatDate(ord.createdAt)}
                            </td>
                            <td className="py-3 px-3 text-white font-bold">
                              {shipAddr?.fullName || 'Customer'}
                            </td>
                            <td className="py-3 px-3 font-mono text-neutral-300">
                              {formatPKR(ord.taxAmount || Math.round(ord.totalAmount * 0.17))}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              {formatPKR(ord.totalAmount)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Link
                                href={`/invoice/${ord._id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs transition-colors border border-neutral-700"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Print Invoice</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: ENVIRONMENT & CONFIGURATION (12 KEYS) */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Key className="h-5 w-5 text-amber-500" />
                    <span>Free Stack Environment Configuration (12 Keys)</span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Manage all 12 zero-cost stack credentials synchronized directly with <code className="text-amber-400 font-mono">.env.local</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 border border-neutral-700 flex items-center gap-1.5"
                  >
                    {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showSecrets ? 'Hide Secrets' : 'Reveal Secrets'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyEnv}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 border border-neutral-700 flex items-center gap-1.5"
                  >
                    {copiedEnv ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedEnv ? 'Copied!' : 'Copy .env'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEnv}
                    disabled={savingEnv}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{savingEnv ? 'Saving...' : 'Save Keys'}</span>
                  </button>
                </div>
              </div>

              {saveStatus && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    saveStatus.includes('successfully')
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/60 border border-red-500/40 text-red-300'
                  }`}
                >
                  {saveStatus.includes('successfully') ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <span>{saveStatus}</span>
                </div>
              )}

              {/* 12 Key Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(envConfig).map(([key, value]) => {
                  const isSecret = key.includes('SECRET') || key.includes('KEY') || key.includes('URI');
                  return (
                    <div
                      key={key}
                      className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1.5"
                    >
                      <label className="text-xs font-mono font-bold text-amber-400 block">{key}</label>
                      <input
                        type={isSecret && !showSecrets ? 'password' : 'text'}
                        value={value}
                        onChange={(e) =>
                          setEnvConfig((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-500" />
                <span>Add Footwear to Catalog</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Shoe Name (English) *</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g. Peshawar Kaptaan Heritage Chappal"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">نام (Urdu Title) *</label>
                  <input
                    type="text"
                    value={newProduct.nameUr}
                    onChange={(e) => setNewProduct({ ...newProduct, nameUr: e.target.value })}
                    placeholder="مثال: کپتان کلاسک ڈبل تلوہ چپل"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-urdu focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={ProductCategory.MEN}>Men</option>
                    <option value={ProductCategory.WOMEN}>Women</option>
                    <option value={ProductCategory.KIDS}>Kids</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Sub-Category</label>
                  <select
                    value={newProduct.subCategory}
                    onChange={(e) => setNewProduct({ ...newProduct, subCategory: e.target.value as ProductSubCategory })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={ProductSubCategory.PESHAWARI_CHAPPAL}>Peshawari Chappal</option>
                    <option value={ProductSubCategory.NOWSHERI_CHAPPAL}>Nowsheri Chappal</option>
                    <option value={ProductSubCategory.KHUSSA}>Traditional Khussa</option>
                    <option value={ProductSubCategory.FORMAL_SHOES}>Formal Shoes</option>
                    <option value={ProductSubCategory.SNEAKERS}>Sneakers</option>
                    <option value={ProductSubCategory.JOGGERS}>Joggers</option>
                    <option value={ProductSubCategory.FLATS}>Flats & Sandals</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">SKU Code</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Selling Price (PKR) *</label>
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Original Retail (PKR)</label>
                  <input
                    type="number"
                    value={newProduct.originalPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, originalPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Initial Stock</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Weight (Grams)</label>
                  <input
                    type="number"
                    value={newProduct.weight}
                    onChange={(e) => setNewProduct({ ...newProduct, weight: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Shoe Image URL</label>
                <div style={{display: 'flex', gap: '10px'}}>
                  <input 
                    type="text" 
                    value={newProduct.image || ''} 
                    onChange={(e) => { 
                      setNewProduct({...newProduct, image: e.target.value});
                      // Assuming preview state exists in the component or need to define one
                      // If preview is not available in newProduct scope, I need to check where to put it.
                      // Since this is inside a function component, I should add the upload state.
                    }}
                    placeholder="Or paste image URL / auto-filled from upload"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <label className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors border border-neutral-800">
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, (url) => setNewProduct({...newProduct, image: url}))} style={{display: 'none'}} />
                  </label>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview && <img src={preview} alt="preview" style={{width: '100px', height: '100px', objectFit: 'cover', marginTop: '10px', borderRadius: '8px'}} />}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Craftsmanship Details / Description</label>
                <textarea
                  rows={3}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProduct.isFeatured}
                    onChange={(e) => setNewProduct({ ...newProduct, isFeatured: e.target.checked })}
                    className="rounded bg-neutral-950 border-neutral-800 text-amber-500"
                  />
                  <span>Feature in Storefront Hero Collection</span>
                </label>

                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs shadow-md"
                >
                  Save Shoe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black uppercase text-white">
                Edit: {editingProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Shoe Image URL</label>
                <div style={{display: 'flex', gap: '10px'}}>
                  <input 
                    type="text" 
                    value={editingProduct.images[0] || ''} 
                    onChange={(e) => setEditingProduct({...editingProduct, images: [e.target.value]})}
                    placeholder="Or paste image URL"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                  <label className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors border border-neutral-800">
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, (url) => setEditingProduct({...editingProduct, images: [url]}))} style={{display: 'none'}} />
                  </label>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(editingProduct.images[0]) && <img src={editingProduct.images[0]} alt="preview" style={{width: '100px', height: '100px', objectFit: 'cover', marginTop: '10px', borderRadius: '8px'}} />}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Price (PKR)</label>
                <input
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, price: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>

              {/* Size-wise Variant Inventory */}
              {editingProduct.variants && editingProduct.variants.length > 0 ? (
                <div className="space-y-2 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase tracking-wider text-amber-500 text-[11px]">
                      Size-Wise Inventory
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      Total: <strong className="text-white">{editingProduct.stock}</strong> units
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {editingProduct.variants.map((v, idx) => (
                      <div key={v.sku || `${v.size}-${idx}`} className="flex items-center justify-between bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-xl">
                        <span className="font-bold text-neutral-300 text-xs">
                          Size {v.size}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) => {
                            const newStock = Math.max(0, Number(e.target.value));
                            const updatedVars = [...editingProduct.variants];
                            updatedVars[idx] = { ...updatedVars[idx], stock: newStock };
                            const sum = updatedVars.reduce((acc, item) => acc + (item.stock || 0), 0);
                            setEditingProduct({
                              ...editingProduct,
                              variants: updatedVars,
                              stock: sum,
                            });
                          }}
                          className="w-16 px-2 py-1 text-center rounded-lg bg-neutral-950 border border-neutral-700 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Stock Units</label>
                  <input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.isFeatured}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })
                    }
                  />
                  <span>Featured Collection</span>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateProduct(editingProduct._id.toString(), {
                      price: editingProduct.price,
                      stock: editingProduct.stock,
                      variants: editingProduct.variants,
                      isFeatured: editingProduct.isFeatured,
                      images: editingProduct.images,
                    })
                  }
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD COUPON */}
      {showAddCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                <Ticket className="h-4 w-4 text-amber-500" />
                <span>Create Promotional Coupon</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCouponModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Coupon Code *</label>
                <input
                  type="text"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. EID2026, RAMADAN15"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Discount Type</label>
                  <select
                    value={newCoupon.type}
                    onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value as CouponType })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white"
                  >
                    <option value={CouponType.PERCENTAGE}>Percentage (%)</option>
                    <option value={CouponType.FIXED}>Fixed PKR Amount</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Discount Value *</label>
                  <input
                    type="number"
                    value={newCoupon.value}
                    onChange={(e) => setNewCoupon({ ...newCoupon, value: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Min Order Spend (PKR)</label>
                  <input
                    type="number"
                    value={newCoupon.minOrderAmount}
                    onChange={(e) => setNewCoupon({ ...newCoupon, minOrderAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Usage Limit</label>
                  <input
                    type="number"
                    value={newCoupon.usageLimit}
                    onChange={(e) => setNewCoupon({ ...newCoupon, usageLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs shadow-md mt-2"
              >
                Create Promo Code
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BANNER */}
      {showAddBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-amber-500" />
                <span>Add Storefront Banner</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBannerModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBanner} className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Banner Title *</label>
                <input
                  type="text"
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  placeholder="e.g. Grand Eid Drop — Up to 30% Off"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Image URL *</label>
                <input
                  type="text"
                  value={newBanner.image}
                  onChange={(e) => setNewBanner({ ...newBanner, image: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Position</label>
                  <select
                    value={newBanner.position}
                    onChange={(e) => setNewBanner({ ...newBanner, position: e.target.value as BannerPosition })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white"
                  >
                    <option value={BannerPosition.HERO}>Hero Slider</option>
                    <option value={BannerPosition.TOP_STRIP}>Top Strip Banner</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-300">Order Priority</label>
                  <input
                    type="number"
                    value={newBanner.order}
                    onChange={(e) => setNewBanner({ ...newBanner, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-300">Destination Link</label>
                <input
                  type="text"
                  value={newBanner.link}
                  onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider text-xs shadow-md mt-2"
              >
                Publish Banner
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SHIPPING LABEL */}
      {selectedLabelOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white text-black rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl font-mono text-xs border border-neutral-300">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-black text-sm tracking-wider">TCS EXPRESS LOGISTICS</div>
              <button
                type="button"
                onClick={() => setSelectedLabelOrder(null)}
                className="text-neutral-500 hover:text-black font-sans text-base"
              >
                ✕
              </button>
            </div>

            <div className="text-center py-2 border-b">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block">CONSIGNMENT TRACKING</span>
              <span className="text-lg font-black tracking-widest">
                {selectedLabelOrder.trackingNumber || `TCS-${selectedLabelOrder.orderNumber}`}
              </span>
              <div className="h-10 bg-neutral-950 text-white flex items-center justify-center text-[10px] tracking-[6px] font-bold mt-1.5">
                ||||| | |||| ||| ||||| || |
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div>
                <strong>TO:</strong> {selectedLabelOrder.shippingAddress?.fullName}
              </div>
              <div>
                <strong>PHONE:</strong> {selectedLabelOrder.shippingAddress?.phone}
              </div>
              <div>
                <strong>ADDRESS:</strong> {selectedLabelOrder.shippingAddress?.address || 'Street Address'}
              </div>
              <div>
                <strong>CITY:</strong> {selectedLabelOrder.shippingAddress?.city}, Pakistan
              </div>
            </div>

            <div className="pt-2 border-t flex items-center justify-between text-sm font-black">
              <span>COD AMOUNT DUE:</span>
              <span className="text-emerald-700">{formatPKR(selectedLabelOrder.totalAmount)}</span>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2 bg-neutral-900 text-white rounded-xl font-bold uppercase tracking-wider text-xs"
            >
              Print Thermal Label
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN ORDER TO RIDER (WITH HAVERSINE DISTANCE) */}
      {assigningOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Bike className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase">
                    {reassigningAssignment ? 'Re-assign Consignment' : 'Dispatch & Assign Rider'}
                  </h3>
                  <span className="text-xs text-neutral-400 font-mono">
                    Order #{assigningOrder.orderNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssigningOrder(null);
                  setReassigningAssignment(null);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Destination Snapshot */}
            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Recipient:</span>
                <span className="text-white font-bold">
                  {(assigningOrder.shippingAddress as unknown as Record<string, string>)?.fullName || 'Customer'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">City Hub:</span>
                <span className="text-amber-400 font-bold">
                  {(assigningOrder.shippingAddress as unknown as Record<string, string>)?.city || 'Pakistan'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Address:</span>
                <span className="text-neutral-200 text-right truncate max-w-[220px]">
                  {(assigningOrder.shippingAddress as unknown as Record<string, string>)?.street ||
                    (assigningOrder.shippingAddress as unknown as Record<string, string>)?.address ||
                    'Standard Delivery'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-neutral-800 font-bold">
                <span className="text-neutral-400">COD Payable:</span>
                <span className="text-emerald-400 font-mono">
                  {formatPKR(assigningOrder.totalAmount)}
                </span>
              </div>
            </div>

            {/* Candidate Riders List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Active Riders in {(assigningOrder.shippingAddress as unknown as Record<string, string>)?.city || 'City'} ({candidateRiders.length})
                </span>
                <Link
                  href="/admin/delivery-partners"
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Fleet Radar</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {candidateRidersLoading ? (
                <div className="p-6 text-center text-xs text-neutral-400 space-y-2">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-400" />
                  <span>Calculating proximity (Haversine formula) & loading fleet...</span>
                </div>
              ) : candidateRiders.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 space-y-2.5">
                  <AlertCircle className="h-6 w-6 text-amber-400 mx-auto" />
                  <p>No active riders currently available for {(assigningOrder.shippingAddress as unknown as Record<string, string>)?.city || 'this city'}.</p>
                  <Link
                    href="/admin/delivery-partners"
                    className="inline-block px-3.5 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs"
                  >
                    + Register New Rider in Fleet Panel
                  </Link>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {candidateRiders.map((rider) => (
                    <div
                      key={rider._id.toString()}
                      className="p-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800/60 border border-neutral-800 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700 shrink-0">
                          <Image
                            src={
                              rider.photo ||
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                            }
                            alt={rider.name}
                            fill
                            referrerPolicy="no-referrer"
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{rider.name}</span>
                            <span className="text-[10px] text-amber-400 font-mono">
                              {rider.bikeNumber}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                            <span>{rider.area || rider.city}</span>
                            {typeof rider.distanceKm === 'number' && (
                              <span className="text-emerald-400 font-mono font-bold">
                                ~{rider.distanceKm} km away (Haversine)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleConfirmAssign(rider._id.toString())}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shrink-0 shadow-sm"
                      >
                        {reassigningAssignment ? 'Reassign' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Admin (Super Admin) */}
      {showCreateAdminModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-admin-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in-50 duration-200"
        >
          <div className="w-full max-w-xl rounded-3xl bg-neutral-900 border border-neutral-800 p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Super Admin RBAC</span>
                </div>
                <h3 id="create-admin-modal-title" className="text-lg font-black uppercase text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-amber-400" />
                  <span>Create New Admin</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!creatingAdmin) setShowCreateAdminModal(false);
                }}
                disabled={creatingAdmin}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAdminSubmit} className="space-y-5">
              <div className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <span>Full Name</span>
                    <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bilal Tariq"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    disabled={creatingAdmin}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <span>Email Address</span>
                    <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@oxshoes.pk"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    disabled={creatingAdmin}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-neutral-500">
                    Must be a unique email address.
                  </span>
                </div>

                {/* Password with Auto-Generate Option */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                      <span>Password</span>
                      <span className="text-amber-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Auto-Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    disabled={creatingAdmin}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-neutral-500">
                    Hashed securely with bcrypt before saving to MongoDB.
                  </span>
                </div>

                {/* Permissions Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider text-[11px]">
                      Permissions ({adminPermissions.length}/8)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (adminPermissions.length === ADMIN_PERMISSION_OPTIONS.length) {
                          setAdminPermissions([]);
                        } else {
                          setAdminPermissions([...ADMIN_PERMISSION_OPTIONS]);
                        }
                      }}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {adminPermissions.length === ADMIN_PERMISSION_OPTIONS.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 rounded-xl bg-neutral-950/70 border border-neutral-800">
                    {ADMIN_PERMISSION_OPTIONS.map((perm) => {
                      const isChecked = adminPermissions.includes(perm);
                      return (
                        <button
                          key={perm}
                          type="button"
                          onClick={() => handleToggleAdminPermission(perm)}
                          disabled={creatingAdmin}
                          className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center gap-2 cursor-pointer ${
                            isChecked
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800/60'
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                              isChecked
                                ? 'bg-amber-500 border-amber-500 text-black'
                                : 'border-neutral-700 bg-neutral-950'
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="font-mono text-[11px] truncate">{perm}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Error Notice */}
              {createAdminError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{createAdminError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateAdminModal(false)}
                  disabled={creatingAdmin}
                  className="px-4 py-2 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {creatingAdmin ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Admin...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 stroke-[2.5]" />
                      <span>Create Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
