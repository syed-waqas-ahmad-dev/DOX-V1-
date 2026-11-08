'use client';

/**
 * @file components/layout/Header.tsx
 * @description Nike-inspired minimalist e-commerce navigation header for OX Shoes.
 * Clean monochrome palette, visual image logo without textual clutter,
 * menu icon shifted to right side on mobile, fully responsive with zero overflow.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/lib/store/cart';
import { useWishlistStore } from '@/lib/store/wishlist';
import { useLocaleStore } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { NAV_LINKS } from '@/lib/constants';
import { Logo } from '@/components/layout/Logo';
import { useSession, signOut } from 'next-auth/react';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Globe,
  Menu,
  X,
  Compass,
  ChevronRight,
  Bell,
  ShieldCheck,
  LogOut,
  LogIn,
  Package,
  MapPin,
  ArrowUpRight,
  Shield,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
}

export function Header({ onOpenSearch }: HeaderProps) {
  const { openCart, getTotalItems } = useCartStore();
  const { items: wishlistItems } = useWishlistStore();
  const { isUrdu, toggleLocale } = useLocaleStore();
  const isHydrated = useHydrated();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const { data: session } = useSession();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    }

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  useEffect(() => {
    let active = true;
    fetch('/api/notifications/list')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && typeof data.unreadCount === 'number') {
          setUnreadNotifCount(data.unreadCount);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const totalCartCount = isHydrated ? getTotalItems() : 0;
  const wishlistCount = isHydrated ? wishlistItems.length : 0;
  const currentIsUrdu = isHydrated ? isUrdu : false;

  const userInitial = session?.user?.name
    ? session.user.name.trim().charAt(0).toUpperCase()
    : session?.user?.email
    ? session.user.email.trim().charAt(0).toUpperCase()
    : null;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-neutral-200 text-neutral-900 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Left: Brand Image Logo ONLY (no text, no left menu) */}
          <div className="flex items-center shrink-0">
            <Logo size="md" />
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-7 text-sm font-semibold tracking-tight">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors py-2 relative hover:text-neutral-950 ${
                  link.highlight
                    ? 'text-red-600 hover:text-red-700 font-bold'
                    : 'text-neutral-700 hover:text-black'
                }`}
              >
                {currentIsUrdu ? link.labelUr : link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action Icons & Mobile Menu Button (shifted to right side) */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
            {/* Search Trigger (Desktop only) */}
            <button
              onClick={onOpenSearch}
              className="hidden lg:flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium transition-colors"
              title="Search shoes (Cmd + K)"
              aria-label="Search shoes"
            >
              <Search className="h-4 w-4 text-neutral-600 shrink-0" />
              <span className="hidden md:inline-block">
                {currentIsUrdu ? 'تلاش کریں...' : 'Search...'}
              </span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-white border border-neutral-300 rounded font-mono text-neutral-500">
                ⌘K
              </kbd>
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLocale}
              className="hidden sm:flex px-2.5 py-1.5 rounded-full hover:bg-neutral-100 text-neutral-700 text-xs font-bold transition-colors items-center gap-1 border border-neutral-200 shrink-0"
              title="Switch Language / زبان تبدیل کریں"
              aria-label="Switch Language"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{currentIsUrdu ? 'EN' : 'اردو'}</span>
            </button>

            {/* Wishlist Link (Desktop only) */}
            <Link
              href="/wishlist"
              className="hidden lg:flex p-2 rounded-full hover:bg-neutral-100 text-neutral-700 transition-colors relative shrink-0"
              aria-label="Wishlist"
              title="Saved Shoes"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* In-App Notifications Bell */}
            <Link
              href="/account/notifications"
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-700 transition-colors relative shrink-0"
              aria-label="Notifications"
              title="Customer Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-amber-500 text-black rounded-full text-[10px] font-black flex items-center justify-center animate-in zoom-in-50 shadow-sm">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </Link>

            {/* Cart Drawer Launcher - Intact Bag Icon (Desktop only) */}
            <button
              onClick={openCart}
              className="hidden lg:flex p-2 rounded-full hover:bg-neutral-100 text-neutral-900 transition-colors relative shrink-0 cursor-pointer items-center justify-center"
              aria-label="Shopping Cart"
              title="Cart Drawer"
            >
              <ShoppingBag className="h-5 w-5" />
              {totalCartCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 bg-neutral-950 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown with Green Circle & Chevron */}
            <div className="relative shrink-0" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                aria-label="User Profile Menu"
                aria-expanded={profileDropdownOpen}
              >
                <div className="w-9 h-9 rounded-full bg-[#0a4d2e] text-white font-bold flex items-center justify-center text-sm shadow-sm select-none">
                  {userInitial ? userInitial : <User className="h-4 w-4 text-white" />}
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-neutral-600 transition-transform duration-200 ${
                    profileDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-neutral-100 p-2 z-50">
                  {/* Header: User's name (bold text-lg) and email (text-sm text-neutral-500) */}
                  <div className="px-3 py-2.5">
                    <div className="font-bold text-lg text-neutral-900 truncate">
                      {session?.user?.name || (session?.user ? 'User' : 'Guest')}
                    </div>
                    <div className="text-sm text-neutral-500 truncate">
                      {session?.user?.email || (session?.user ? '' : 'Sign in to your account')}
                    </div>
                  </div>

                  {/* Thin divider below */}
                  <div className="h-px bg-neutral-100 my-1" />

                  {/* Menu Items */}
                  <div className="py-1 text-sm font-medium text-neutral-700 space-y-0.5">
                    <Link
                      href="/dashboard/orders"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors"
                    >
                      <Package className="h-4 w-4 text-neutral-500 shrink-0" />
                      <span>My Orders</span>
                    </Link>

                    <Link
                      href="/dashboard/addresses"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors"
                    >
                      <MapPin className="h-4 w-4 text-neutral-500 shrink-0" />
                      <span>Addresses</span>
                    </Link>

                    <Link
                      href="/shop"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors"
                    >
                      <ArrowUpRight className="h-4 w-4 text-neutral-500 shrink-0" />
                      <span>Products</span>
                    </Link>

                    <Link
                      href="/shop?onSale=true"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-colors"
                    >
                      <ArrowUpRight className="h-4 w-4 text-neutral-500 shrink-0" />
                      <span>Deals</span>
                    </Link>

                    {/* Admin Panel (RBAC): Shield icon, text-amber-700 (#b45309). Render ONLY if session.user.role === 'admin' or 'super_admin' */}
                    {(session?.user?.role === 'admin' || session?.user?.role === 'super_admin') && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-amber-50 text-[#b45309] font-semibold transition-colors"
                      >
                        <Shield className="h-4 w-4 text-[#b45309] shrink-0" />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    {/* Rider Terminal (RBAC): If role === 'rider', show a 'Rider Terminal' link that uses window.open('/delivery', '_blank') */}
                    {session?.user?.role === 'rider' && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          if (typeof window !== 'undefined') {
                            window.open('/delivery', '_blank');
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 text-emerald-700 font-semibold transition-colors cursor-pointer text-left"
                      >
                        <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Rider Terminal</span>
                      </button>
                    )}
                  </div>

                  {/* Divider, then Logout: LogOut icon, text-red-600 */}
                  <div className="h-px bg-neutral-100 my-1" />

                  {session ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        signOut({ callbackUrl: '/login' });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 text-red-600 shrink-0" />
                      <span>Logout</span>
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-50 text-neutral-800 text-sm font-semibold transition-colors"
                    >
                      <LogIn className="h-4 w-4 text-neutral-600 shrink-0" />
                      <span>Sign In</span>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle Button (SHIFTED TO RIGHT SIDE) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-neutral-100 text-neutral-800 transition-colors shrink-0"
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Second Mobile Bar: Wishlist (left), Search box (center, flexible), Cart (right) */}
      <div className="lg:hidden bg-white border-t border-neutral-100">
        <div className="flex items-center justify-between gap-2.5 w-full px-3 py-2">
          {/* Wishlist wrapper */}
          <div className="flex shrink-0 items-center justify-center">
            <Link
              href="/wishlist"
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-800 transition-colors relative"
              aria-label="Wishlist"
              title="Saved Shoes"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </div>

          {/* Search wrapper */}
          <div className="flex-1 min-w-0">
            <button
              onClick={onOpenSearch}
              className="w-full rounded-full bg-neutral-100 hover:bg-neutral-200/70 px-3.5 py-2 outline-none flex items-center gap-2 text-neutral-500 text-sm transition-colors text-left cursor-pointer"
              aria-label="Search shoes"
            >
              <Search className="h-4 w-4 text-neutral-500 shrink-0" />
              <span className="truncate">
                {currentIsUrdu ? 'تلاش کریں...' : 'Search...'}
              </span>
            </button>
          </div>

          {/* Cart wrapper */}
          <div className="flex shrink-0 items-center justify-center">
            <button
              onClick={openCart}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-900 transition-colors relative cursor-pointer"
              aria-label="Shopping Cart"
              title="Cart Drawer"
            >
              <ShoppingBag className="h-5 w-5" />
              {totalCartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-neutral-950 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 bg-white px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200 shadow-lg">
          {/* Mobile Profile & Admin Quick Access */}
          <div className="flex flex-col gap-2 pb-3 border-b border-neutral-100">
            {/* Mobile Admin Quick Access - strictly visible to authorized admin and super_admin */}
            {(session?.user?.role === 'admin' || session?.user?.role === 'super_admin') && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950 text-amber-400 hover:bg-neutral-900 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-400">Admin Panel</div>
                    <div className="text-[10px] text-neutral-400">Manage Products, Orders & Stock</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </Link>
            )}

            {session ? (
              <>
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-900">
                        {session.user?.name || (currentIsUrdu ? 'میرا اکاؤنٹ' : 'My Account')}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                        {session.user?.email || (currentIsUrdu ? 'پروفائل، آرڈرز اور پتہ' : 'Orders, Wishlist & Profile')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-red-700">
                        {currentIsUrdu ? 'اکاؤنٹ سے لاگ آؤٹ کریں' : 'Log Out'}
                      </div>
                      <div className="text-[11px] text-red-500">
                        {session.user?.email || (currentIsUrdu ? 'سیشن ختم کریں' : 'End active session')}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-red-400" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 text-white hover:bg-black transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center">
                    <LogIn className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {currentIsUrdu ? 'سائن ان کریں' : 'Sign In / Register'}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {currentIsUrdu ? 'اپنے اکاؤنٹ میں داخل ہوں' : 'Access your account & orders'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            )}

            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-xs font-medium text-neutral-600 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-neutral-500" />
                {currentIsUrdu ? 'زبان منتخب کریں' : 'Language'}
              </span>
              <button
                onClick={toggleLocale}
                className="px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-800 border border-neutral-200 transition-colors"
              >
                {currentIsUrdu ? 'English میں دیکھیں' : 'اردو میں دیکھیں'}
              </button>
            </div>
          </div>

          {/* Navigation Category Links */}
          <div className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2 px-2 rounded-lg text-sm font-semibold transition-colors ${
                  link.highlight
                    ? 'text-red-600 bg-red-50/50 hover:bg-red-50'
                    : 'text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                {currentIsUrdu ? link.labelUr : link.label}
              </Link>
            ))}
          </div>

          {/* Auxiliary Links */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
            <Link
              href="/dashboard/orders"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-1.5 hover:text-neutral-950 font-medium py-1"
            >
              <Compass className="h-4 w-4 text-amber-600" />
              {isUrdu ? 'آرڈر ٹریک کریں' : 'Track Order'}
            </Link>

            <Link
              href="/wishlist"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-1.5 hover:text-neutral-950 font-medium py-1"
            >
              <Heart className="h-4 w-4 text-red-500" />
              {isUrdu ? 'پسندیدہ اشیاء' : 'Wishlist'} ({wishlistCount})
            </Link>

            <Link
              href="/account/notifications"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-1.5 hover:text-neutral-950 font-medium py-1"
            >
              <Bell className="h-4 w-4 text-amber-500" />
              <span>{isUrdu ? 'اطلاعات' : 'Alerts'}</span>
              {unreadNotifCount > 0 && (
                <span className="h-4 px-1.5 bg-amber-500 text-black rounded-full text-[10px] font-black flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
