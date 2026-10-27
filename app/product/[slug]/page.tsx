'use client';

/**
 * @file app/product/[slug]/page.tsx
 * @description High-conversion Nike-inspired Product Detail Page (PDP).
 * Multi-photo gallery, color swatches, size selector, COD delivery checker,
 * full specifications, and verified review list.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { SearchModal } from '@/components/layout/SearchModal';
import { getProductBySlug } from '@/actions/product.actions';
import { getProductReviews, createReviewAction } from '@/actions/review.actions';
import { useCartStore } from '@/lib/store/cart';
import { useWishlistStore } from '@/lib/store/wishlist';
import { useRecentlyViewedStore } from '@/lib/store/recently-viewed';
import { useLocale } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { formatPKR } from '@/lib/formatters/currency';
import { PAKISTAN_MAJOR_CITIES } from '@/lib/constants';
import type { IProduct, IReview } from '@/types';
import {
  Star,
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Ruler,
  Check,
  ChevronRight,
  Info,
  Clock,
  Send,
  Sparkles,
} from 'lucide-react';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => {
      setResolvedSlug(decodeURIComponent(p.slug));
    });
  }, [params]);

  const [product, setProduct] = useState<IProduct | null>(null);
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // COD Checker state
  const [checkCity, setCheckCity] = useState('');
  const [cityResult, setCityResult] = useState<string | null>(null);

  // New review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const { addItem } = useCartStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const { addProduct: trackRecent } = useRecentlyViewedStore();
  const { isUrdu } = useLocale();
  const isHydrated = useHydrated();

  useEffect(() => {
    if (!resolvedSlug) return;
    async function loadData() {
      setLoading(true);
      try {
        const res = await getProductBySlug(resolvedSlug!);
        if (res.success && res.data) {
          setProduct(res.data);
          setSelectedImage(res.data.images?.[0] || '');
          setSelectedSize(res.data.sizes?.[0] || '41');
          setSelectedColor(res.data.colors?.[0]?.name || 'Standard');

          // Track recently viewed
          trackRecent({
            productId: res.data._id.toString(),
            name: res.data.name,
            nameUr: res.data.nameUr,
            image: res.data.images?.[0] || '',
            price: res.data.price,
            originalPrice: res.data.originalPrice,
            slug: res.data.slug,
            subCategory: res.data.subCategory,
          });

          // Load reviews
          const revRes = await getProductReviews(res.data._id.toString());
          if (revRes.success) {
            setReviews(revRes.data);
          }
        } else {
          console.error('Failed to fetch product:', 'error' in res ? res.error : 'Unknown error');
          setProduct(null);
        }
      } catch (e) {
        console.error('Error loading product:', e);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [resolvedSlug, trackRecent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm font-semibold text-neutral-600">
        Loading product details...
      </div>
    );
  }

  if (!product) {
    return notFound();
  }

  const isSaved = isHydrated && isInWishlist(product._id.toString());

  const handleAddToCart = () => {
    addItem({
      productId: product._id.toString(),
      name: product.name,
      nameUr: product.nameUr,
      image: selectedImage || product.images[0] || '',
      size: selectedSize,
      color: selectedColor,
      price: product.price,
      originalPrice: product.originalPrice,
      sku: product.sku,
      weight: product.weight || 750,
      quantity: 1,
    });
  };

  const handleCheckCityDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkCity) return;
    const lower = checkCity.toLowerCase();
    if (lower.includes('lahore')) {
      setCityResult('Lahore Urban: 1-2 Working Days (TCS Express) • COD Available');
    } else if (lower.includes('karachi') || lower.includes('hyderabad')) {
      setCityResult('Karachi / Sindh: 2-3 Working Days (TCS Air Cargo) • COD Available');
    } else if (lower.includes('islamabad') || lower.includes('rawalpindi')) {
      setCityResult('Twin Cities: 1-2 Working Days (TCS Express) • COD Available');
    } else {
      setCityResult('Nationwide: 3-4 Working Days (TCS / Leopards) • COD Available');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;

    setReviewSubmitting(true);
    // Temporary demo order ID / verified purchase ID
    const demoOrderId = '660e1234567890abcdef1234';
    const demoUserId = '660e1234567890abcdef1000';

    const res = await createReviewAction(demoUserId, {
      productId: product._id.toString(),
      orderId: demoOrderId,
      rating: reviewRating,
      comment: reviewComment,
      images: [],
    });

    setReviewSubmitting(false);
    if (res.success) {
      setReviewSuccess(true);
      setReviewComment('');
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => setSearchModalOpen(true)} />
      <CartDrawer />
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full flex-1">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 font-medium mb-8">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/shop?category=${product.category}`} className="hover:text-black">{product.category}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/shop?subCategory=${encodeURIComponent(product.subCategory)}`} className="hover:text-black">{product.subCategory}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-neutral-900 font-bold truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product Master Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Left Column: Multi-Angle Gallery */}
          <div className="lg:col-span-7 space-y-4">
            {/* Primary Large Image */}
            <div className="relative aspect-square w-full rounded-2xl bg-neutral-100 overflow-hidden border border-neutral-200">
              <Image
                src={selectedImage || product.images[0]}
                alt={product.name}
                fill
                priority
                referrerPolicy="no-referrer"
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />

              {product.discount > 0 && (
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-neutral-950 text-white text-xs font-black uppercase tracking-wider">
                  Save {product.discount}%
                </div>
              )}
            </div>

            {/* Thumbnail Row */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(img)}
                    className={`relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border-2 transition-all ${
                      selectedImage === img
                        ? 'border-neutral-950 ring-2 ring-neutral-950/10'
                        : 'border-transparent hover:border-neutral-300'
                    }`}
                  >
                    <Image src={img} alt={`${product.name} angle ${i + 1}`} fill referrerPolicy="no-referrer" className="object-cover" sizes="120px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Buying Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                <span>{product.brand} • {product.subCategory}</span>
                <span className="text-emerald-600 font-black">In Stock</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-neutral-950 uppercase tracking-tight">
                {product.name}
              </h1>

              {product.nameUr && (
                <p className="text-sm text-neutral-500 font-medium mt-1 font-serif" dir="rtl">
                  {product.nameUr}
                </p>
              )}

              {/* Rating summary */}
              <div className="flex items-center gap-2 mt-3 text-xs">
                <div className="flex items-center text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.round(product.rating || 5)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-neutral-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-neutral-900">{product.rating.toFixed(1)}</span>
                <span className="text-neutral-400">({product.numReviews} Verified Reviews)</span>
              </div>
            </div>

            {/* Price Row */}
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-neutral-500 uppercase font-bold block mb-0.5">Price (PKR)</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-neutral-950">
                    {formatPKR(product.price)}
                  </span>
                  {product.originalPrice > product.price && (
                    <span className="text-sm text-neutral-400 line-through">
                      {formatPKR(product.originalPrice)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-neutral-600 bg-white px-2.5 py-1 rounded-full border border-neutral-200">
                17% GST Included
              </span>
            </div>

            {/* Color Swatches */}
            {product.colors && product.colors.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs font-bold text-neutral-900">
                  <span>Selected Color: <strong className="text-neutral-600">{selectedColor}</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name)}
                      className={`h-9 px-3 rounded-full border text-xs font-bold flex items-center gap-2 transition-all ${
                        selectedColor === c.name
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow'
                          : 'border-neutral-300 hover:border-neutral-400 text-neutral-800'
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full border border-white/40 shrink-0" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shoe Size Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-900">Select Shoe Size (Pakistani / EU)</span>
                <button
                  onClick={() => setSizeGuideOpen(!sizeGuideOpen)}
                  className="font-bold text-neutral-600 hover:text-black flex items-center gap-1 underline"
                >
                  <Ruler className="h-3.5 w-3.5" />
                  Size Chart Guide
                </button>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`py-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      selectedSize === sz
                        ? 'border-neutral-950 bg-neutral-950 text-white shadow'
                        : 'border-neutral-200 hover:border-neutral-400 text-neutral-800'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Guide Modal (Inline Preview) */}
            {sizeGuideOpen && (
              <div className="p-4 rounded-xl bg-neutral-900 text-white text-xs space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between font-bold border-b border-neutral-800 pb-2">
                  <span>Shoe Size Conversions</span>
                  <button onClick={() => setSizeGuideOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-1">
                  <div><strong className="block text-amber-400">EU/PK</strong>40 | 41 | 42 | 43</div>
                  <div><strong className="block text-amber-400">UK</strong>6.5 | 7.5 | 8 | 9</div>
                  <div><strong className="block text-amber-400">US</strong>7.5 | 8.5 | 9 | 10</div>
                  <div><strong className="block text-amber-400">Foot CM</strong>25.0 | 25.8 | 26.5 | 27.2</div>
                </div>
              </div>
            )}

            {/* CTAs: Add to Bag + Wishlist */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleAddToCart}
                className="flex-1 py-4 px-6 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-neutral-950/20 transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>{isUrdu ? 'کارٹ میں شامل کریں' : 'Add to Bag'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleWishlist({
                    productId: product._id.toString(),
                    name: product.name,
                    nameUr: product.nameUr,
                    image: selectedImage || product.images[0] || '',
                    price: product.price,
                    originalPrice: product.originalPrice,
                    slug: product.slug,
                    subCategory: product.subCategory,
                  });
                }}
                className={`p-4 rounded-full border transition-colors ${
                  isSaved
                    ? 'border-red-600 bg-red-50 text-red-600'
                    : 'border-neutral-300 hover:border-neutral-950 text-neutral-800'
                }`}
                aria-label="Wishlist"
              >
                <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* COD Delivery SLA Checker */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-neutral-900 tracking-wider">
                <Truck className="h-4 w-4 text-amber-600" />
                <span>Check Delivery Time & COD by City</span>
              </div>
              <form onSubmit={handleCheckCityDelivery} className="flex gap-2">
                <select
                  value={checkCity}
                  onChange={(e) => setCheckCity(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-950"
                >
                  <option value="">Select your city...</option>
                  {PAKISTAN_MAJOR_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!checkCity}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                >
                  Check
                </button>
              </form>

              {cityResult && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{cityResult}</span>
                </div>
              )}
            </div>

            {/* Value Guarantees */}
            <div className="grid grid-cols-2 gap-3 text-xs text-neutral-600 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-neutral-950 shrink-0" />
                <span>100% Full Grain Leather</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-950 shrink-0" />
                <span>7-Day Return / Sizing Exchange</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Description & Specifications */}
        <section className="mt-16 pt-12 border-t border-neutral-200 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tight text-neutral-950">
              Product Overview & Craftsmanship
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed">
              {product.description}
            </p>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-950">
              Detailed Specifications
            </h3>
            <div className="border border-neutral-200 rounded-xl overflow-hidden text-xs">
              <div className="divide-y divide-neutral-200">
                <div className="py-2.5 px-4 flex justify-between bg-neutral-50/50">
                  <span className="text-neutral-500 font-medium">Category</span>
                  <span className="font-bold text-neutral-950">{product.category} ({product.subCategory})</span>
                </div>
                <div className="py-2.5 px-4 flex justify-between">
                  <span className="text-neutral-500 font-medium">Weight</span>
                  <span className="font-bold text-neutral-950">{product.weight} grams</span>
                </div>
                <div className="py-2.5 px-4 flex justify-between bg-neutral-50/50">
                  <span className="text-neutral-500 font-medium">Master SKU</span>
                  <span className="font-mono font-bold text-neutral-950">{product.sku}</span>
                </div>
                <div className="py-2.5 px-4 flex justify-between">
                  <span className="text-neutral-500 font-medium">Origin</span>
                  <span className="font-bold text-neutral-950">Artisan Handcrafted, Pakistan</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Reviews Section */}
        <section className="mt-16 pt-12 border-t border-neutral-200 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-neutral-950">
                Verified Customer Reviews ({reviews.length})
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Feedback from verified buyers who wore this pair across Pakistan
              </p>
            </div>
          </div>

          {/* Review List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((rev) => (
              <div key={rev._id.toString()} className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-neutral-400">Verified Buyer</span>
                </div>
                {rev.title && <h4 className="font-bold text-sm text-neutral-950">{rev.title}</h4>}
                <p className="text-xs text-neutral-600 leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>

          {/* Add Review Box */}
          <div className="p-6 rounded-2xl bg-neutral-100 border border-neutral-200 max-w-xl">
            <h3 className="font-bold text-sm text-neutral-950 uppercase tracking-wider mb-2">
              Write a Review
            </h3>
            {reviewSuccess ? (
              <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 py-2">
                <Check className="h-4 w-4" />
                Thank you! Your feedback has been recorded.
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-neutral-700">Rating:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className={`p-1 ${reviewRating >= star ? 'text-amber-400' : 'text-neutral-300'}`}
                      >
                        <Star className="h-4 w-4 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={3}
                  placeholder="How was the leather fit, sole comfort, and delivery? Share your experience..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                  className="w-full p-3 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-950"
                />
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-5 py-2.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  <span>Submit Review</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
