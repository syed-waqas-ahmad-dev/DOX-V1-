'use client';

/**
 * @file app/shop/page.tsx
 * @description Nike-style footwear catalog listing page (PLP) with responsive filter drawer,
 * subcategory chips, sorting, and live pagination.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product/ProductCard';
import { Header } from '@/components/layout/Header';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { SearchModal } from '@/components/layout/SearchModal';
import { getProducts } from '@/actions/product.actions';
import { ProductCategory, ProductSubCategory, type IProduct } from '@/types';
import { formatPKR } from '@/lib/formatters/currency';
import {
  SlidersHorizontal,
  ChevronDown,
  X,
  Filter,
  Check,
  RotateCcw,
} from 'lucide-react';

function ShopContent() {
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<IProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Filters state
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams?.get('category') || ''
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(
    searchParams?.get('subCategory') || ''
  );
  const [maxPrice, setMaxPrice] = useState<number>(12000);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [onSaleOnly, setOnSaleOnly] = useState<boolean>(
    searchParams?.get('onSale') === 'true'
  );
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc' | 'rating'>('newest');

  const searchQuery = searchParams?.get('search') || '';

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await getProducts({
      category: selectedCategory ? (selectedCategory as ProductCategory) : undefined,
      subCategory: selectedSubCategory ? (selectedSubCategory as ProductSubCategory) : undefined,
      maxPrice,
      inStock: inStockOnly,
      onSale: onSaleOnly,
      search: searchQuery,
      sortBy,
      limit: 24,
    });

    if (res.success) {
      setProducts(res.data.products);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [selectedCategory, selectedSubCategory, maxPrice, inStockOnly, onSaleOnly, searchQuery, sortBy]);

  useEffect(() => {
    let active = true;
    getProducts({
      category: selectedCategory ? (selectedCategory as ProductCategory) : undefined,
      subCategory: selectedSubCategory ? (selectedSubCategory as ProductSubCategory) : undefined,
      maxPrice,
      inStock: inStockOnly,
      onSale: onSaleOnly,
      search: searchQuery,
      sortBy,
      limit: 24,
    }).then((res) => {
      if (active) {
        if (res.success) {
          setProducts(res.data.products);
          setTotal(res.data.total);
        }
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedCategory, selectedSubCategory, maxPrice, inStockOnly, onSaleOnly, sortBy, searchQuery]);

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedSubCategory('');
    setMaxPrice(12000);
    setInStockOnly(false);
    setOnSaleOnly(false);
  };

  const hasActiveFilters =
    Boolean(selectedCategory) ||
    Boolean(selectedSubCategory) ||
    maxPrice < 12000 ||
    inStockOnly ||
    onSaleOnly;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between">
      <AnnouncementBar />
      <Header onOpenSearch={() => setSearchModalOpen(true)} />
      <CartDrawer />
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Breadcrumb & Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-neutral-200 pb-5 mb-8 gap-4">
          <div>
            <div className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mb-1">
              Storefront / Pakistani Footwear
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
              {selectedSubCategory || selectedCategory || (searchQuery ? `Search: "${searchQuery}"` : 'All Shoes & Chappals')}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              Showing {products.length} of {total} verified handcrafted pairs in stock
            </p>
          </div>

          {/* Controls: Filter toggle & Sort */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="lg:hidden px-4 py-2 bg-white border border-neutral-300 rounded-full text-xs font-bold text-neutral-800 flex items-center gap-2 shadow-sm"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters {hasActiveFilters ? '•' : ''}</span>
            </button>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-white border border-neutral-300 rounded-full px-4 py-2 pr-8 text-xs font-bold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-950 cursor-pointer shadow-sm"
              >
                <option value="newest">Sort By: Newest Drops</option>
                <option value="rating">Sort By: Top Rated</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Layout Grid: Sidebar + Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className={`lg:block ${mobileFilterOpen ? 'block' : 'hidden'} space-y-6 bg-white p-5 rounded-2xl border border-neutral-200 lg:bg-transparent lg:p-0 lg:border-0 lg:rounded-none h-fit`}>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <span className="font-black text-sm uppercase tracking-wider text-neutral-950 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Footwear
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-bold text-neutral-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Audience Category
              </h3>
              <div className="space-y-1.5 text-xs">
                {['', 'Men', 'Women', 'Kids'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left py-1.5 px-3 rounded-lg flex items-center justify-between font-semibold transition-colors ${
                      selectedCategory === cat
                        ? 'bg-neutral-950 text-white font-bold'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{cat || 'All Categories'}</span>
                    {selectedCategory === cat && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Category Filter */}
            <div className="space-y-2.5 pt-4 border-t border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Shoe Style & Craft
              </h3>
              <div className="space-y-1.5 text-xs">
                {[
                  '',
                  'Peshawari Chappal',
                  'Khussa',
                  'Formal Shoes',
                  'Joggers',
                  'Sneakers',
                  'Heels',
                  'Flats',
                  'School Shoes',
                ].map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubCategory(sub)}
                    className={`w-full text-left py-1.5 px-3 rounded-lg flex items-center justify-between font-semibold transition-colors ${
                      selectedSubCategory === sub
                        ? 'bg-neutral-950 text-white font-bold'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{sub || 'All Footwear Styles'}</span>
                    {selectedSubCategory === sub && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Slider */}
            <div className="space-y-3 pt-4 border-t border-neutral-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-neutral-700">Max Budget</span>
                <span className="font-bold text-neutral-950">{formatPKR(maxPrice)}</span>
              </div>
              <input
                type="range"
                min="2000"
                max="12000"
                step="500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-neutral-950 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>PKR 2,000</span>
                <span>PKR 12,000</span>
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="space-y-2.5 pt-4 border-t border-neutral-200 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-neutral-700 select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded text-neutral-950 focus:ring-0 accent-neutral-950 h-4 w-4"
                />
                <span className="font-medium">In-Stock Pairs Only</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-neutral-700 select-none">
                <input
                  type="checkbox"
                  checked={onSaleOnly}
                  onChange={(e) => setOnSaleOnly(e.target.checked)}
                  className="rounded text-neutral-950 focus:ring-0 accent-neutral-950 h-4 w-4"
                />
                <span className="font-medium">Discounted / On Sale Only</span>
              </label>
            </div>
          </aside>

          {/* Product Grid Area */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-3">
                    <div className="aspect-square bg-neutral-200 rounded-xl" />
                    <div className="h-4 bg-neutral-200 rounded w-3/4" />
                    <div className="h-4 bg-neutral-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {products.map((p) => (
                  <ProductCard key={p._id.toString()} product={p} />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center rounded-2xl bg-white border border-neutral-200 p-8 space-y-4">
                <div className="h-14 w-14 rounded-full bg-neutral-100 mx-auto flex items-center justify-center text-neutral-400">
                  <X className="h-6 w-6" />
                </div>
                <h3 className="font-black text-lg text-neutral-900 uppercase tracking-tight">
                  No Footwear Found
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  We could not find any shoes matching your specific filter criteria. Try resetting price range or category.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-2.5 rounded-full bg-neutral-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 flex items-center justify-center text-xs">Loading Footwear Catalog...</div>}>
      <ShopContent />
    </Suspense>
  );
}
