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
  // Dimension mappings for the logo image
  const dimensions = {
    sm: { img: 34, container: 'w-[34px] h-[34px]' },
    md: { img: 42, container: 'w-[42px] h-[42px]' },
    lg: { img: 56, container: 'w-[56px] h-[56px]' },
    xl: { img: 72, container: 'w-[72px] h-[72px]' },
  }[size];

  const isDark = theme === 'dark';

  const content = (
    <div
      className={`relative inline-flex items-center justify-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95 shrink-0 cursor-pointer ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-xl border shrink-0 shadow-xs transition-all duration-200 group-hover:shadow-md ${dimensions.container} ${
          isDark
            ? 'border-amber-500/30 bg-neutral-900 ring-1 ring-amber-500/20'
            : 'border-neutral-200 bg-black ring-1 ring-black/10'
        }`}
      >
        <Image
          src="/assets/aistudio/IMG-20261020-WA4549_1301156b.jpg"
          alt="OX Shoes"
          fill
          priority
          referrerPolicy="no-referrer"
          className="object-cover pointer-events-auto"
          sizes={`${dimensions.img}px`}
        />
      </div>
    </div>
  );

  if (withLink) {
    return (
      <Link
        href="/"
        aria-label="OX Shoes Home"
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-xl cursor-pointer pointer-events-auto"
      >
        {content}
      </Link>
    );
  }

  return content;
}
