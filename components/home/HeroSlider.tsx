'use client';

/**
 * @file components/home/HeroSlider.tsx
 * @description True horizontal sliding ecommerce hero carousel for Bajaur OX Shoes.
 * Features a 100%-width flex track with CSS transform (translateX), clean and bright
 * shoe photography (no heavy mud overlay), mobile-first controlled viewport height (54-70vh),
 * smooth horizontal transitions, touch/swipe navigation, and accessible controls.
 * Strict TypeScript: ZERO `any`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from '@/lib/store/locale';
import { useHydrated } from '@/lib/hooks/useHydrated';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  Award,
  Pause,
  Play,
} from 'lucide-react';

interface HeroSlide {
  id: string;
  kicker: string;
  kickerUr: string;
  headline: string;
  headlineUr: string;
  highlightText: string;
  highlightTextUr: string;
  description: string;
  descriptionUr: string;
  image: string;
  imageAlt: string;
  objectPositionClass: string;
  badge: string;
  badgeUr: string;
  primaryCtaText: string;
  primaryCtaTextUr: string;
  primaryCtaHref: string;
  secondaryCtaText: string;
  secondaryCtaTextUr: string;
  secondaryCtaHref: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'heritage-kaptaan',
    kicker: 'EID 2026 HERITAGE DROP',
    kickerUr: 'نئی عید ۲۰۲۶ کلیکشن',
    headline: 'CRAFTED FOR ROYALTY.',
    headlineUr: 'خالص چمڑے کی شاہی پشاوری چپل',
    highlightText: 'ENGINEERED TO ENDURE.',
    highlightTextUr: 'دیرپا اور بے مثال گرفت۔',
    description:
      'Authentic double-sole Kaptaan & Charsadda Chappals handcrafted with 100% full-grain buffalo leather and original durable tyre rubber sole.',
    descriptionUr:
      'ڈبل تلہ پشاوری چپل، روایتی ملتانی کھسے اور خالص لیدر۔ پورے پاکستان میں کیش آن ڈیلیوری دستیاب ہے۔',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'Handcrafted genuine leather footwear showcasing authentic Pakistani leathercraft',
    objectPositionClass: 'object-[center_60%] sm:object-[center_45%]',
    badge: '100% Full-Grain Cow Leather',
    badgeUr: 'خالص چمڑا · پائیدار ٹائر تلہ',
    primaryCtaText: 'Shop Heritage Chappals',
    primaryCtaTextUr: 'پشاوری چپل خریدیں',
    primaryCtaHref: '/shop?subCategory=Peshawari+Chappal',
    secondaryCtaText: 'Men Footwear',
    secondaryCtaTextUr: 'مردانہ جوتے',
    secondaryCtaHref: '/shop?category=Men',
  },
  {
    id: 'executive-oxfords',
    kicker: 'FORMAL LUXURY ATELIER',
    kickerUr: 'پریمیم فارمل کلیکشن',
    headline: 'TIMELESS ITALIAN OXFORDS.',
    headlineUr: 'لاہور ایگزیکٹو آکسفورڈ فارمل جوتے',
    highlightText: 'BOARDROOM EXCELLENCE.',
    highlightTextUr: 'باکمال وقار اور بے عیب فنش۔',
    description:
      'Closed-lacing Italian calfskin dress shoes with Goodyear-welted construction and high-shine hand patina, built for corporate distinction.',
    descriptionUr:
      'اطالوی کٹ فارمل آکسفورڈ جوتے، شاندار ہینڈ پٹینہ اور لیدر سول۔ دفتری تقریبات اور شادیوں کے لیے بہترین انتخاب۔',
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'Executive formal Oxford dress shoes in luxury hand-burnished black leather',
    objectPositionClass: 'object-[center_55%] sm:object-[center_50%]',
    badge: 'Goodyear Welted · Italian Calfskin',
    badgeUr: 'گڈ ایئر ویلٹڈ · اطالوی فنش',
    primaryCtaText: 'Shop Formal Oxfords',
    primaryCtaTextUr: 'فارمل جوتے دیکھیں',
    primaryCtaHref: '/shop?category=Men&subCategory=Formal+Shoes',
    secondaryCtaText: 'Explore All Shoes',
    secondaryCtaTextUr: 'مکمل کلیکشن',
    secondaryCtaHref: '/shop',
  },
  {
    id: 'bridal-khussa',
    kicker: 'ROYAL WEDDING COLLECTION',
    kickerUr: 'شاہی برائیڈل کلیکشن',
    headline: 'HAND-EMBROIDERED TILLA.',
    headlineUr: 'ملتانی مخملی کھسہ مع طلائی کڑھائی',
    highlightText: 'FESTIVE MAJESTY.',
    highlightTextUr: 'شادی بیاہ کی خاص رونق۔',
    description:
      'Traditional Multani velvet khussa decorated with genuine metallic Gold Tilla needlework, raw silk lining, and dual-density memory foam cushion.',
    descriptionUr:
      'اصلی طلائی تلہ کڑھائی، مخملی فنش اور دن بھر کے آرام کے لیے میموری فوم کشن۔ بارات اور ولیمہ کی تقریب کے لیے شاندار۔',
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'Exquisite bridal footwear and embroidered velvet khussa adorned with metallic gold tilla',
    objectPositionClass: 'object-[center_50%]',
    badge: 'Pure Silk Velvet · Memory Cushion',
    badgeUr: 'خالص مخمل · میموری فوم پیڈنگ',
    primaryCtaText: 'Shop Women Khussa',
    primaryCtaTextUr: 'کھسہ کلیکشن خریدیں',
    primaryCtaHref: '/shop?subCategory=Khussa',
    secondaryCtaText: 'Women Footwear',
    secondaryCtaTextUr: 'زنانہ جوتے',
    secondaryCtaHref: '/shop?category=Women',
  },
  {
    id: 'margalla-joggers',
    kicker: 'PERFORMANCE ATHLETICS',
    kickerUr: 'پرفارمنس اسپورٹس',
    headline: 'HYPER-REBOUND ENERGY.',
    headlineUr: 'مارگلہ ٹریل پرو رننگ جاگرز',
    highlightText: 'CONQUER EVERY TERRAIN.',
    highlightTextUr: 'ہر قدم پر زبردست توانائی اور آرام۔',
    description:
      'Engineered with high-rebound Hyper EVA foam and breathable knit mesh to absorb maximum impact during road running and trail cardio.',
    descriptionUr:
      'ہائی ری باؤنڈ ای وی اے فوم، شاک ایبزاربنگ ٹیکنالوجی اور دیرپا گرفت کے ساتھ بہترین رننگ اسنیکرز۔',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=2000&q=85',
    imageAlt: 'High-rebound shock-absorbing running sneakers in vibrant crimson and black',
    objectPositionClass: 'object-[center_50%]',
    badge: 'Hyper-EVA Foam · Shock Damper',
    badgeUr: 'شاک ایبزاربر · لائٹ ویٹ میش',
    primaryCtaText: 'Shop Running Joggers',
    primaryCtaTextUr: 'جاگرز خریدیں',
    primaryCtaHref: '/shop?subCategory=Joggers',
    secondaryCtaText: 'View All Shoes',
    secondaryCtaTextUr: 'تمام جوتے دیکھیں',
    secondaryCtaHref: '/shop',
  },
];

export function HeroSlider() {
  const { isUrdu } = useLocale();
  const isHydrated = useHydrated();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(true);

  // Swipe gesture tracking refs
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const totalSlides = HERO_SLIDES.length;

  const goToNextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goToPrevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // IntersectionObserver: Pause autoplay when hero is scrolled out of viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Autoplay timer (~5 seconds) with pause on hover / background / outside viewport
  useEffect(() => {
    if (isPaused || !isIntersecting) return;

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) return;
    }

    const timer = setInterval(() => {
      goToNextSlide();
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, isIntersecting, goToNextSlide]);

  // Pause when browser tab is inactive / hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Keyboard navigation when hero is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNextSlide();
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Horizontal swipe threshold: 40px and more horizontal than vertical
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0) {
        // Swiped right: move to previous slide
        goToPrevSlide();
      } else {
        // Swiped left: move to next slide
        goToNextSlide();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const currentIsUrdu = isHydrated && isUrdu;

  return (
    <section
      ref={sectionRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Bajaur OX Shoes Featured Footwear Horizontal Carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full overflow-hidden bg-neutral-950 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      {/* 1. HORIZONTAL SLIDE VIEWPORT (Mobile-First Height: 54-62svh on mobile, 70vh on desktop) */}
      <div className="relative w-full overflow-hidden h-[54svh] sm:h-[62svh] lg:h-[70vh] min-h-[420px] sm:min-h-[490px] lg:min-h-[580px] max-h-[720px]">
        {/* Horizontal Flex Track: Each slide is 100% width, sliding via translateX */}
        <div
          className="flex w-full h-full transition-transform duration-700 ease-out will-change-transform"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {HERO_SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className="relative w-full h-full flex-shrink-0 flex-grow-0 basis-full min-w-full overflow-hidden flex flex-col justify-center"
              aria-hidden={currentIndex !== index}
            >
              {/* Clean, Bright Background Image - NO heavy dark filter! */}
              <div className="absolute inset-0 z-0">
                <Image
                  src={slide.image}
                  alt={slide.imageAlt}
                  fill
                  priority={index === 0}
                  referrerPolicy="no-referrer"
                  className={`object-cover ${slide.objectPositionClass}`}
                  sizes="100vw"
                />
              </div>

              {/* Localized Subtle Gradient Scrim strictly behind text - preserves 100% natural shoe brightness! */}
              <div
                className={`absolute inset-0 z-10 pointer-events-none ${
                  currentIsUrdu
                    ? 'bg-gradient-to-l from-black/80 via-black/40 to-transparent sm:max-w-2xl sm:ml-auto'
                    : 'bg-gradient-to-r from-black/80 via-black/40 to-transparent sm:max-w-2xl'
                }`}
              />
              {/* Mobile bottom vignette so controls and text sit comfortably */}
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 to-transparent z-10 pointer-events-none sm:hidden" />

              {/* Slide Content Overlaid Directly on the Background Image */}
              <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8 sm:py-12 flex flex-col justify-center">
                <div className={`max-w-xl sm:max-w-2xl ${currentIsUrdu ? 'text-right ml-auto' : 'text-left mr-auto'}`}>
                  {/* Top Tag & Badge */}
                  <div className="inline-flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] sm:text-xs font-semibold text-amber-300 uppercase tracking-widest shadow-sm">
                      <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400 shrink-0" />
                      <span>{currentIsUrdu ? slide.kickerUr : slide.kicker}</span>
                    </div>

                    <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-medium text-neutral-300">
                      <Award className="h-3 w-3 text-amber-400 shrink-0" />
                      <span>{currentIsUrdu ? slide.badgeUr : slide.badge}</span>
                    </div>
                  </div>

                  {/* Headline with Clean Typography and Shadow */}
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-black uppercase tracking-tight text-white leading-[1.05] drop-shadow-md">
                    {currentIsUrdu ? (
                      <span dir="rtl" className="block text-xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold font-serif">
                        {slide.headlineUr} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-white">
                          {slide.highlightTextUr}
                        </span>
                      </span>
                    ) : (
                      <>
                        <span>{slide.headline}</span> <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-white">
                          {slide.highlightText}
                        </span>
                      </>
                    )}
                  </h1>

                  {/* Description: Compact line-clamp on mobile to prevent vertical sprawl */}
                  <p
                    className="mt-2.5 sm:mt-4 text-xs sm:text-sm lg:text-base text-neutral-200 font-normal leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-lg drop-shadow"
                    dir={currentIsUrdu ? 'rtl' : 'ltr'}
                  >
                    {currentIsUrdu ? slide.descriptionUr : slide.description}
                  </p>

                  {/* Action CTAs */}
                  <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3.5">
                    <Link
                      href={slide.primaryCtaHref}
                      className="px-5 sm:px-7 py-2.5 sm:py-3.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-white/10 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 group"
                    >
                      <span>{currentIsUrdu ? slide.primaryCtaTextUr : slide.primaryCtaText}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>

                    <Link
                      href={slide.secondaryCtaHref}
                      className="px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/25 hover:border-white/50 font-bold text-xs uppercase tracking-wider transition-all duration-200 backdrop-blur-md"
                    >
                      <span>{currentIsUrdu ? slide.secondaryCtaTextUr : slide.secondaryCtaText}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 2. Floating Desktop Left / Right Navigation Arrows */}
        <button
          onClick={goToPrevSlide}
          aria-label="Previous shoe slide"
          className="hidden sm:flex absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-30 h-10 w-10 lg:h-11 lg:w-11 rounded-full bg-black/40 hover:bg-black/80 border border-white/20 hover:border-amber-400/60 text-white backdrop-blur-md items-center justify-center transition-all duration-200 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={goToNextSlide}
          aria-label="Next shoe slide"
          className="hidden sm:flex absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-30 h-10 w-10 lg:h-11 lg:w-11 rounded-full bg-black/40 hover:bg-black/80 border border-white/20 hover:border-amber-400/60 text-white backdrop-blur-md items-center justify-center transition-all duration-200 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* 3. Minimal Pagination Dots & Slide Counter Bar */}
        <div className="absolute bottom-3 sm:bottom-4 inset-x-0 z-30 pointer-events-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between pointer-events-auto">
            {/* Pagination Dots */}
            <div className="flex items-center gap-1.5 sm:gap-2" role="tablist" aria-label="Hero footwear slides">
              {HERO_SLIDES.map((slide, idx) => {
                const isSelected = currentIndex === idx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(idx)}
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isSelected
                        ? 'w-7 sm:w-10 bg-amber-400 shadow-sm shadow-amber-400/50'
                        : 'w-2 sm:w-2.5 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                );
              })}
            </div>

            {/* Slide Index & Pause/Play Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-mono text-neutral-300 tracking-wider bg-black/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-white/10 backdrop-blur-sm">
                {String(currentIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
              </span>

              <button
                onClick={() => setIsPaused((prev) => !prev)}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/50 hover:bg-black/80 border border-white/20 hover:border-white/40 text-neutral-300 hover:text-white flex items-center justify-center backdrop-blur-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
                title={isPaused ? 'Resume autoplay' : 'Pause autoplay'}
              >
                {isPaused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PRESERVED QUICK MICRO STATS STRIP (Clean 4-column value props below the hero banner) */}
      <div className="border-t border-neutral-800/80 bg-neutral-950 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs text-neutral-300 font-medium">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-white font-black text-xs sm:text-sm">100% Genuine</span>
              <span className="text-[10px] sm:text-xs text-neutral-400">
                {currentIsUrdu ? 'خالص چمڑا' : 'Full-Grain Cowhide'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-white font-black text-xs sm:text-sm">Nationwide COD</span>
              <span className="text-[10px] sm:text-xs text-neutral-400">
                {currentIsUrdu ? 'کیش آن ڈیلیوری' : 'Doorstep Cash on Delivery'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-white font-black text-xs sm:text-sm">7-Day Exchange</span>
              <span className="text-[10px] sm:text-xs text-neutral-400">
                {currentIsUrdu ? 'آسان تبدیلی' : 'Size Replacement'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <span className="block text-white font-black text-xs sm:text-sm">Master Craft</span>
              <span className="text-[10px] sm:text-xs text-neutral-400">
                {currentIsUrdu ? 'ماہر کاریگر' : 'Artisan Hand-Stitched'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
