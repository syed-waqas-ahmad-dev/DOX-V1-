'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatPKR } from '@/lib/formatters/currency';
import type { IProduct } from '@/types';

interface GalleryClientProps {
  products: IProduct[];
}

export function GalleryClient({ products }: GalleryClientProps) {
  const [filter, setFilter] = useState('All');

  const filtered = products.filter((p) => {
    if (filter === 'All') return true;
    if (filter === 'Brown') return p.name.toLowerCase().includes('brown');
    if (filter === 'Black') return p.name.toLowerCase().includes('black');
    if (filter === 'Peshawari') return p.subCategory.toLowerCase().includes('peshawari');
    return true;
  });

  const getCloudinaryUrl = (url: string) => {
    if (!url.includes('cloudinary.com')) return url;
    // Inject transformation
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_600,h_600,c_fill/');
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {['All', 'Brown', 'Black', 'Peshawari'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${
              filter === f ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map((product, index) => (
          <div key={product._id.toString()} className="group relative flex flex-col rounded-xl overflow-hidden bg-white border border-neutral-100">
            <Link href={`/product/${product.slug}`} className="relative aspect-square w-full">
              <Image
                src={getCloudinaryUrl(product.images[0] || '')}
                alt={product.name}
                fill
                priority={index < 2}
                loading={index < 2 ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer"
                className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <span className="absolute top-2 left-2 px-2 py-1 rounded bg-amber-500 text-[10px] font-black uppercase text-neutral-950">
                Village Delivery Available
              </span>
            </Link>

            <div className="p-3 flex flex-col flex-1">
              <h3 className="font-bold text-xs text-neutral-950 line-clamp-1">{product.name}</h3>
              <p className="text-[10px] text-neutral-500 mt-0.5">{product.nameUr}</p>
              <div className="mt-auto pt-2 flex items-center justify-between">
                <span className="font-black text-xs">{formatPKR(product.price)}</span>
                <Link 
                  href={`/product/${product.slug}`}
                  className="px-3 py-1 rounded-lg bg-neutral-950 text-white text-[10px] font-bold uppercase"
                >
                  Order Now
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
