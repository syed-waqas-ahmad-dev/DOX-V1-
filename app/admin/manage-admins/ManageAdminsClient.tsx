'use client';

/**
 * @file app/admin/manage-admins/ManageAdminsClient.tsx
 * @description Interactive Client Component for Managing Admins in OX Shoes.
 * Features:
 * - "+ Create New Admin" button (Top Right, only visible to SUPER_ADMIN)
 * - Modal form with Full Name, Email, Password, and 8 permission checkboxes
 * - Calls Server Action createAdmin (No fetch(), no UserRole enum)
 * - Shows toast/alert notification: 'Admin created successfully'
 * - Invokes router.refresh() after success to update the admins list
 * Strict TypeScript: ZERO `any`.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { createAdmin, deleteAdmin, type AdminUserItem } from './actions';

const PRIMARY_SUPER_ADMIN_EMAIL = 'ahmadsyedwaqas4@gmail.com';
import {
  Users,
  ShieldCheck,
  Plus,
  ArrowLeft,
  Key,
  X,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
  Shield,
  Clock,
  Sparkles,
  Trash2,
} from 'lucide-react';

const PERMISSION_OPTIONS = [
  'products:read',
  'products:write',
  'products:delete',
  'orders:read',
  'orders:update_status',
  'orders:assign_courier',
  'marketing:manage',
  'finance:view_reports',
] as const;

type PermissionOption = (typeof PERMISSION_OPTIONS)[number];

interface ManageAdminsClientProps {
  initialAdmins: AdminUserItem[];
  isSuperAdmin: boolean;
}

export function ManageAdminsClient({
  initialAdmins,
  isSuperAdmin,
}: ManageAdminsClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionOption[]>([
    'products:read',
    'orders:read',
  ]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete State
  const [adminToDelete, setAdminToDelete] = useState<AdminUserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleTogglePermission = (perm: PermissionOption) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSelectAllPermissions = () => {
    if (selectedPermissions.length === PERMISSION_OPTIONS.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions([...PERMISSION_OPTIONS]);
    }
  };

  const handleOpenModal = () => {
    setName('');
    setEmail('');
    setPassword('');
    setSelectedPermissions(['products:read', 'orders:read']);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
      setFormError(null);
    }
  };

  const handleDeleteClick = (admin: AdminUserItem) => {
    if (admin.email.toLowerCase().trim() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) {
      return;
    }
    setDeleteError(null);
    setAdminToDelete(admin);
  };

  const handleConfirmDelete = async () => {
    if (!adminToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteAdmin(adminToDelete._id);
      if (res.success) {
        setToastMessage(`Admin ${adminToDelete.name || adminToDelete.email} was successfully deleted.`);
        setAdminToDelete(null);
        router.refresh();
      } else {
        setDeleteError(res.error || 'Failed to delete administrator account.');
      }
    } catch {
      setDeleteError('A network error occurred while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    // Client-side validations matching requirements
    if (!name.trim()) {
      setFormError('Full Name is required.');
      return;
    }

    if (!email.trim()) {
      setFormError('Email is required.');
      return;
    }

    if (!password || password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      // Direct Server Action invocation - NO fetch() used
      const res = await createAdmin({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        permissions: [...selectedPermissions],
      });

      if (res.success) {
        // 1. Close form/modal
        setIsModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setSelectedPermissions(['products:read', 'orders:read']);

        // 2. Show toast/alert message: 'Admin created successfully'
        setToastMessage('Admin created successfully');
        setTimeout(() => setToastMessage(null), 4500);

        // 3. Use router.refresh() to update admin list
        router.refresh();
      } else {
        setFormError(res.error || 'Failed to create administrator account.');
      }
    } catch {
      setFormError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo theme="dark" size="sm" withLink={false} />
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500 text-black uppercase tracking-widest font-mono">
            RBAC Management
          </span>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            Admin Accounts & Permissions
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/admin"
            className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Admin Console</span>
          </Link>

          {/* Top Right Header Button: Only visible to SUPER_ADMIN */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleOpenModal}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>+ Create New Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Toast / Alert Message: 'Admin created successfully' */}
        {toastMessage && (
          <div
            role="status"
            className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-300"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Hero Banner with Top-Right Action Button */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Key className="h-3.5 w-3.5" />
              <span>Super Admin Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2.5">
              <Users className="h-7 w-7 text-amber-400" />
              <span>Manage Admins</span>
            </h1>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Create and manage administrative accounts with role-based access control and granular privileges.
            </p>
          </div>

          {/* Top Right Action Button: Only visible to SUPER_ADMIN */}
          {isSuperAdmin && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleOpenModal}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>+ Create New Admin</span>
              </button>
            </div>
          )}
        </div>

        {/* Current Admins List Section */}
        <div className="rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Active System Administrators ({initialAdmins.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-neutral-400 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800">
              Roles: super_admin | admin
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-950/70 border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                  <th className="py-3.5 px-6">Administrator</th>
                  <th className="py-3.5 px-6">Official Email</th>
                  <th className="py-3.5 px-6">System Role</th>
                  <th className="py-3.5 px-6">Permissions</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  {isSuperAdmin && (
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {initialAdmins.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="py-12 text-center text-neutral-500 text-xs">
                      No administrator accounts found. Click &quot;+ Create New Admin&quot; above to onboard an administrator.
                    </td>
                  </tr>
                ) : (
                  initialAdmins.map((admin) => {
                    const isSuper = admin.role === 'super_admin';
                    const isPrimarySuperAdmin =
                      admin.email.toLowerCase().trim() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();

                    return (
                      <tr
                        key={admin._id}
                        className="hover:bg-neutral-800/40 transition-colors group"
                      >
                        <td className="py-4 px-6 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                isSuper
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                              }`}
                            >
                              {admin.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{admin.name}</span>
                                {isSuper && (
                                  <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono">
                                ID: {admin._id.slice(-8)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6 font-mono text-neutral-300">
                          {admin.email}
                        </td>

                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border ${
                              isSuper
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isSuper ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'
                              }`}
                            />
                            {admin.role}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {admin.permissions && admin.permissions.length > 0 ? (
                              admin.permissions.map((p) => (
                                <span
                                  key={p}
                                  className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-neutral-400"
                                >
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-neutral-600 italic">
                                {isSuper ? 'Full System Access' : 'No specific permissions'}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </td>

                        {isSuperAdmin && (
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              disabled={isPrimarySuperAdmin || isDeleting}
                              onClick={() => {
                                if (!isPrimarySuperAdmin) {
                                  handleDeleteClick(admin);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                isPrimarySuperAdmin
                                  ? 'bg-neutral-800/40 text-neutral-500 border border-neutral-700/40 cursor-not-allowed opacity-50'
                                  : 'bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/40 hover:border-red-600/60 cursor-pointer shadow-sm'
                              }`}
                              title={
                                isPrimarySuperAdmin
                                  ? 'Primary Super Admin account is permanently protected'
                                  : `Delete admin ${admin.name}`
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal: Create New Admin */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in-50 duration-200"
        >
          <div className="w-full max-w-xl rounded-3xl bg-neutral-900 border border-neutral-800 p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>RBAC Provisioning</span>
                </div>
                <h3 id="modal-title" className="text-lg font-black uppercase text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-400" />
                  <span>Create New Admin</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Close Modal"
                aria-label="Close Modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="space-y-5">
              <div className="space-y-4">
                {/* Field 1: Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <UserIcon className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Full Name</span>
                    <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bilal Tariq"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Field 2: Email (Unique validation) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Email</span>
                    <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@oxshoes.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-neutral-500">
                    Must be unique across all system accounts.
                  </span>
                </div>

                {/* Field 3: Password (min 8 chars) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Password</span>
                    <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-neutral-500">
                    Minimum 8 characters. Hashed securely with bcrypt before storing.
                  </span>
                </div>

                {/* Field 4: Permissions Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider text-[11px]">
                      Permissions ({selectedPermissions.length}/{PERMISSION_OPTIONS.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleSelectAllPermissions}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {selectedPermissions.length === PERMISSION_OPTIONS.length
                        ? 'Deselect All'
                        : 'Select All (8)'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 rounded-xl bg-neutral-950/70 border border-neutral-800">
                    {PERMISSION_OPTIONS.map((perm) => {
                      const isChecked = selectedPermissions.includes(perm);
                      return (
                        <button
                          key={perm}
                          type="button"
                          onClick={() => handleTogglePermission(perm)}
                          disabled={submitting}
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
              {formError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Admin...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 stroke-[3]" />
                      <span>Create Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Admin Confirmation */}
      {adminToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in-50 duration-200"
        >
          <div className="w-full max-w-md rounded-3xl bg-neutral-900 border border-red-500/30 p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-base font-black uppercase text-white">
                  Confirm Admin Deletion
                </h3>
                <p className="text-[11px] text-neutral-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <p className="text-neutral-300 font-medium">
                Are you sure you want to delete this admin?
              </p>
              <div className="font-mono text-neutral-200 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800 space-y-1">
                <div className="font-bold text-white text-xs">{adminToDelete.name}</div>
                <div className="text-[11px] text-neutral-400">{adminToDelete.email}</div>
                <div className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">
                  Role: {adminToDelete.role}
                </div>
              </div>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setAdminToDelete(null);
                    setDeleteError(null);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting Admin...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Yes, Delete Admin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
