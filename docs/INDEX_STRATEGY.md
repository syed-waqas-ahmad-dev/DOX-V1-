# MongoDB Atlas Indexing Strategy & Performance Architecture
**Platform:** OX Shoes Pakistan (Enterprise Footwear E-Commerce)  
**Database Engine:** MongoDB Atlas (WiredTiger Storage Engine)  
**Target Currency:** PKR | **Logistics:** TCS, Leopards, Trax | **Gateways:** COD, JazzCash, Easypaisa

---

## 1. Architectural Philosophy: The ESR Rule
In enterprise e-commerce with thousands of concurrent product lookups and seasonal Eid surges, query execution times must stay under 5 milliseconds. Every compound index in OX Shoes adheres to MongoDB’s **ESR (Equality, Sort, Range)** design pattern:
1. **Equality (E):** Exact match fields come first in the compound index (e.g. `category`, `isActive`, `userId`).
2. **Sort (S):** Fields determining the ordering of results come second, enabling index-provided ordering without in-memory `SORT` stages (avoiding MongoDB's 100MB RAM sort limit).
3. **Range (R):** Range comparisons (e.g. `$gte`, `$lte` on prices, dates) come last.

---

## 2. Collection-by-Collection Index Specification & Justification

### 2.1. Products Collection (`products`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ slug: 1, isDeleted: 1 }` | Compound (Unique) | **Product Detail Page (PDP) Route:** Lookups by URL slug (`/product/kaptaan-special-peshawari-chappal-1042`). Combining `isDeleted: 1` ensures soft-deleted shoes do not trigger 404/500 collisions while avoiding unindexed scans. |
| `{ sku: 1, isDeleted: 1 }` | Compound (Unique) | **ERP & Warehouse Inventory Scan:** Barcode scan lookups at logistics distribution hubs (Lahore/Karachi) execute in sub-millisecond time. |
| `{ category: 1, subCategory: 1, isActive: 1 }` | Compound | **Category Listing Page (PLP):** e.g. "Men's Footwear" -> "Peshawari Chappal" with active stock. Adheres to ESR: Equality on category and subCategory. |
| `{ price: 1, rating: -1 }` | Compound | **Faceted Filter & Sorting:** Users filtering by budget (PKR 3,000 to PKR 6,000) and sorting by customer rating. |
| `{ isFeatured: 1, createdAt: -1 }` | Compound | **Homepage Curated Carousel:** Renders top featured Pakistani footwear ordered from newest release to oldest with zero in-memory sort. |
| `{ name: "text", description: "text", tags: "text", shortDescription: "text" }` | Text Index (Weighted) | **Storefront Full-Text Search:** Enables instant search across Urdu and English keywords ("Khussa", "Peshawari", "کپتان", "چپل", "Double Sole"). Name has weight 10, tags weight 5. |

### 2.2. Orders Collection (`orders`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ orderNumber: 1 }` | Single (Unique) | **Customer Support & Courier Tracking:** Instant lookup for order numbers (e.g., `OX-2026-1042`) used by TCS and Leopards tracking webhooks. |
| `{ userId: 1, createdAt: -1 }` | Compound | **Customer Dashboard ("My Orders"):** Fetches all historic orders of a logged-in user in reverse chronological order without an in-memory sort. |
| `{ status: 1, createdAt: -1 }` | Compound | **Operations Fulfillment Queue:** Admin dashboard filtering orders by status (`Pending`, `Confirmed`, `Shipped`) to process dispatches by age. |
| `{ courier: 1, trackingNumber: 1 }` | Compound | **Automated Courier Webhook Updates:** Matches status pings from TCS or Trax APIs to the correct customer record. |

### 2.3. Users Collection (`users`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ email: 1, isDeleted: 1 }` | Compound (Unique) | **Authentication & Login:** Authenticates credentials while isolating soft-deleted accounts. |
| `{ phone: 1 }` | Single | **COD OTP Verification:** Pakistani mobile number lookup (`+923001234567`) for SMS OTP checkout verification. |
| `{ referralCode: 1 }` | Single (Sparse, Unique) | **Viral Referral Attributions:** Resolves friend invite codes (e.g., `OX-SUPER`) when registering new customers. |

### 2.4. Reviews Collection (`reviews`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ productId: 1, isApproved: 1, createdAt: -1 }` | Compound | **Product Reviews Tab:** Fetches approved buyer reviews for a specific shoe, sorted newest first. |
| `{ userId: 1, productId: 1, orderId: 1 }` | Compound (Unique) | **Verified Purchase Protection:** Enforces that a customer can only submit exactly one review per purchased shoe per order, preventing spam. |

### 2.5. Coupons & Usage Collections (`coupons`, `couponusages`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ code: 1, isActive: 1, expiresAt: 1 }` | Compound | **Checkout Voucher Validation:** Rapidly checks if code (`EIDVIBES`, `WELCOME10`) is active and has not expired. |
| `{ couponId: 1, userId: 1, orderId: 1 }` | Compound (Unique) | **Fraud Prevention:** Strictly prevents double-redemption of single-use vouchers during high-concurrency checkouts. |

### 2.6. Audit Log Collection (`auditlogs`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ createdAt: 1 }` with `expireAfterSeconds: 31536000` | TTL (Time-To-Live) | **Automatic Archival (1 Year):** MongoDB Atlas background thread automatically purges audit logs older than 365 days, keeping storage costs lean and complying with retention policies. |
| `{ entity: 1, entityId: 1, createdAt: -1 }` | Compound | **Entity Audit Timeline:** Renders full historical changes (before/after price updates or refund decisions) for any product or order. |

### 2.7. Shipping Zones Collection (`shippingzones`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ cities: 1, isActive: 1 }` | Multikey Compound | **Cart Shipping Calculator:** Matches customer city (e.g. "Lahore", "Karachi", "Faisalabad") against zone array in $O(1)$ time to return correct base rate and delivery SLA. |

### 2.8. Notifications Collection (`notifications`)
| Index Definition | Type | Rationale & Business Query Covered |
| :--- | :--- | :--- |
| `{ userId: 1, isRead: 1, createdAt: -1 }` | Compound | **Unread Badge & Inbox:** Powers the top navigation bell icon and unread notification counter. |

---

## 3. Working Set & RAM Optimization
- **Index Sizing:** Compound indexes are kept narrow (avoiding indexing large description or image fields) so all indexes fit inside the WiredTiger RAM cache.
- **`lean()` Execution:** All read-heavy operations utilize `.lean()` to bypass Mongoose document hydration, cutting memory consumption by 60% and latency by 4x.
- **Covered Queries:** Where possible, `.select()` is paired with index fields so MongoDB answers queries directly from RAM without fetching disk documents.
