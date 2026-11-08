'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withLink?: boolean;
  variant?: 'image' | 'inline' | 'compact';
}

/**
 * Brand Logo component for OX Shoes.
 * Renders the exclusive brand image emblem without textual clutter,
 * keeping the navigation bar sleek, responsive, and uncluttered.
 */
export function Logo({
  theme = 'auto',
  className = '',
  size = 'md',
  withLink = true,
}: LogoProps) {
  // Dimension mappings for the logo image (natural aspect ratio ~2.1:1, 653x310)
  const dimensions = {
    sm: { img: 64, container: 'w-[58px] h-[28px]' },
    md: { img: 88, container: 'w-[78px] h-[38px]' },
    lg: { img: 112, container: 'w-[105px] h-[50px]' },
    xl: { img: 144, container: 'w-[134px] h-[64px]' },
  }[size];

  const isDark = theme === 'dark';

  const content = (
    <div
      className={`relative inline-flex items-center justify-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95 shrink-0 cursor-pointer ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-md border shrink-0 shadow-xs transition-all duration-200 group-hover:shadow-md ${dimensions.container} ${
          isDark
            ? 'border-amber-500/30 bg-neutral-900 ring-1 ring-amber-500/20'
            : 'border-neutral-200 bg-neutral-950 ring-1 ring-black/10'
        }`}
      >
        <Image
          src="/assets/aistudio/IMG_20261108_081412_ec413be2.jpg"
          alt="Bajaur OX Shoes Logo"
          fill
          priority
          referrerPolicy="no-referrer"
          className="object-contain pointer-events-auto"
          sizes={`${dimensions.img}px`}
        />
      </div>
    </div>
  );

  if (withLink) {
    return (
      <Link
        href="/"
        aria-label="Bajaur OX Shoes Home"
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xl cursor-pointer pointer-events-auto"
      >
        {content}
      </Link>
    );
  }

  return content;
}
