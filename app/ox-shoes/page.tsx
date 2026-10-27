import { Metadata } from 'next';
import { getProducts } from '@/actions/product.actions';
import { GalleryClient } from '@/components/home/GalleryClient';

export const metadata: Metadata = {
  title: 'Ox Shoes Collection - Original Leather | Peshawar',
  description: 'Explore the Ox Shoes collection featuring original leather footwear, traditional Peshawari Chappal, and handcrafted artisan quality from Bajaur and beyond.',
  keywords: 'Ox Shoes, Peshawari Chappal, Bajaur, Original Leather',
};

export default async function OxShoesGalleryPage() {
  const res = await getProducts({ limit: 100 });
  const allProducts = res.success ? res.data.products : [];
  
  // Filter products where subCategory includes 'Ox' or name includes 'Ox'
  const filteredProducts = allProducts.filter(
    (p) => 
      p.name.toLowerCase().includes('ox') || 
      p.subCategory.toLowerCase().includes('ox') ||
      p.tags.some(tag => tag.toLowerCase().includes('ox'))
  );

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-950 mb-8">
          Ox Shoes Collection
        </h1>
        <GalleryClient products={filteredProducts} />
      </main>
    </div>
  );
}
