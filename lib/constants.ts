/**
 * @file lib/constants.ts
 * @description Enterprise constants and configuration for OX Shoes Pakistan.
 * Strict TypeScript: ZERO `any`.
 */

export const APP_NAME = 'OX Shoes';
export const APP_DESCRIPTION = 'Enterprise Handcrafted Footwear & Sneakers for Pakistan';
export const CURRENCY_CODE = 'PKR';
export const GST_RATE = 0.17; // 17% Pakistani General Sales Tax
export const FREE_SHIPPING_THRESHOLD = 5000; // Free shipping over PKR 5,000
export const COD_MAX_LIMIT_WITHOUT_OTP = 10000; // Require OTP verification for COD > PKR 10,000

export const NAV_LINKS = [
  { label: 'Men', labelUr: 'مردانہ', href: '/shop?category=Men' },
  { label: 'Women', labelUr: 'زنانہ', href: '/shop?category=Women' },
  { label: 'Kids', labelUr: 'بچوں کے', href: '/shop?category=Kids' },
  { label: 'Stores', labelUr: 'اسٹورز', href: '/stores' },
  { label: 'Track', labelUr: 'ٹریکنگ', href: '/track' },
  { label: 'About Us', labelUr: 'ہمارے بارے میں', href: '/about' },
  { label: 'Sale', labelUr: 'سیل', href: '/shop?onSale=true', highlight: true },
  { label: 'Ox Shoes', labelUr: 'آکس شوز', href: '/ox-shoes' },
];

export const PAKISTAN_MAJOR_CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Peshawar',
  'Quetta',
  'Multan',
  'Faisalabad',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Bahawalpur',
  'Sargodha',
  'Abbottabad',
  'Sukkur',
  'Mardan',
  'Kasur',
  'Sheikhupura',
  'Gujrat',
  'Sahiwal',
];

export const PAYMENT_METHOD_DETAILS = {
  COD: {
    label: 'Cash on Delivery (COD)',
    labelUr: 'کیش آن ڈیلیوری',
    desc: 'Pay in cash when courier delivers to your doorstep anywhere in Pakistan. Open-box inspection allowed.',
    badge: '100% Cash on Delivery',
  },
} as const;

export const cityOptions = [
  // KPK - Top Priority (Updated with Malakand)
  { label: "Peshawar", value: "Peshawar" },
  { label: "Mardan", value: "Mardan" },
  { label: "Swat (Mingora)", value: "Mingora" },
  { label: "Abbottabad", value: "Abbottabad" },
  { label: "Mansehra", value: "Mansehra" },
  { label: "Nowshera", value: "Nowshera" },
  { label: "Charsadda", value: "Charsadda" },
  { label: "Bajaur (Khar)", value: "Bajaur" },
  { label: "Malakand (Batkhela)", value: "Malakand" },
  { label: "Bannu", value: "Bannu" },
  { label: "Kohat", value: "Kohat" },
  { label: "Dera Ismail Khan", value: "D.I. Khan" },
  // Other Pakistan
  { label: "Lahore", value: "Lahore" },
  { label: "Karachi", value: "Karachi" },
  { label: "Islamabad / Rawalpindi", value: "Islamabad" },
  { label: "Faisalabad", value: "Faisalabad" },
  { label: "Multan", value: "Multan" },
  { label: "Other (Manual Entry)", value: "Other" },
];
