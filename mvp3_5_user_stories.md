# MVP 3.5 — Analytics and Insights (Single-Outlet, Online-Only)
## User Story Breakdown with Tasks and Subtasks

**Version:** 1.0  
**Based on:** MVP 3.5 PRD (Single Source of Truth)  
**Depends on:** MVP 1, MVP 2, and MVP 3 fully deployed and stable  
**Last Updated:** 2026-05-21

---

## How to Read This Document

Each **User Story** represents a complete, shippable piece of value from the user's perspective.  
Each **Task** is a discrete unit of work — labelled `[BE]` (backend) or `[FE]` (frontend).  
Each **Subtask** is a specific, actionable implementation step with instructions, expected output, and acceptance criteria.  
Complete tasks in the order listed within each story.

**IndexedDB rule:** All client-side persistence uses the Zustand + persist middleware + `indexedDBStorage` adapter pattern. No direct IndexedDB calls anywhere. The existing `lib/indexedDbStorage.ts` is used unchanged.

**Critical MVP 3.5 context:**
- This is a **read-only** system. No analytics computation modifies invoices, stock, deficits, or any other entity.
- In MVP 3.5, every tenant has exactly one outlet. No outlet selector is needed. The outlet is always the tenant's default outlet.
- All invoices are server-confirmed (no offline-pending invoices exist yet — that is MVP 5). Today's live query includes all invoices.
- Two types of data: **historical** (precomputed nightly into `DailyProductSales` and `DailyRevenueSummary`) and **today's data** (computed live on demand from the Invoice table).

---

## Story Map Overview

| # | User Story | Type | Priority |
|---|---|---|---|
| US-01 | Precomputed Tables — Schema, nightly job, backfill | BE | Must have |
| US-02 | Analytics API — Stock insights endpoints | BE | Must have |
| US-03 | Analytics API — Revenue overview endpoints | BE | Must have |
| US-04 | Navigation — Analytics nav item and low stock badge | FE | Must have |
| US-05 | Stock Insights Screen — Low stock alerts | FE | Must have |
| US-06 | Stock Insights Screen — Product health categories | FE | Must have |
| US-07 | Stock Insights Screen — Deficit summary widget | FE | Must have |
| US-08 | Revenue Overview Screen — Overview cards and time period selector | FE | Must have |
| US-09 | Revenue Overview Screen — Revenue bar chart | FE | Must have |
| US-10 | Revenue Overview Screen — Top products, payment breakdown, GST summary | FE | Must have |

---

---

## US-01 — Precomputed Tables: Schema, Nightly Job, and Backfill

**As a developer, I need two precomputed tables that store daily analytics aggregations so that historical analytics queries are fast and do not put load on the invoices table at runtime.**

**Scope:** Backend only.  
**Dependency:** Must be complete before US-02 and US-03.

---

### T-01.1 — `[BE]` Create the `DailyProductSales` table

**What:** A precomputed table that stores per-product, per-day aggregated sales data. One row per (outletId, productId, date) combination.

**Schema:**

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, auto-generated | — |
| tenantId | UUID | FK → Tenant, required | — |
| outletId | UUID | FK → Outlet, required | — |
| productId | UUID | FK → Product, required | — |
| date | date | YYYY-MM-DD format, required | Server date in IST at time of computation |
| unitsSold | integer | >= 0 | Total units sold across all SALE invoices on this date for this product |
| refundedUnits | integer | >= 0 | Total units returned via REFUND invoices on this date for this product |
| netUnitsSold | integer | >= 0, clamped (never negative) | `MAX(0, unitsSold - refundedUnits)` |
| grossRevenue | decimal | >= 0 | SUM of `(unitPrice × quantity)` before any discounts |
| discountAmount | decimal | >= 0 | SUM of `itemDiscountAmount` for this product + proportional share of `billDiscountAmount` |
| netRevenue | decimal | >= 0 | `grossRevenue - discountAmount` |
| gstAmount | decimal | >= 0 | SUM of `gstAmount` for this product across all invoices that day |

**Unique constraint:** `UNIQUE(outletId, productId, date)` — one row per product per outlet per day.

**Index:** Add a composite index on `(tenantId, outletId, date)` for efficient date-range queries. Add a composite index on `(tenantId, outletId, productId)` for per-product queries.

**How `discountAmount` is calculated per product per invoice:**
- `itemDiscountAmount` for this product is taken directly from the invoice item's stored `itemDiscountAmount` field.
- The product's proportional share of `billDiscountAmount` = `(product lineTotal / invoice subtotal) × billDiscountAmount`.
- Sum these across all invoices for the day.

**Expected output:** Table created. Unique constraint and indexes are in place. Inserting two rows with the same (outletId, productId, date) fails with a unique constraint error.

---

- [ ] **ST-01.1.1** Create the `DailyProductSales` model/schema with all fields listed above. Ensure the `date` field stores only the date part (not a datetime).
  - **Expected output:** Model file created. Migration runs without errors. Table/collection exists with correct schema.

- [ ] **ST-01.1.2** Add the unique constraint on `(outletId, productId, date)`. Test by attempting to insert a duplicate row.
  - **Expected output:** Second insert with same (outletId, productId, date) fails with a unique/duplicate key error.

- [ ] **ST-01.1.3** Add composite indexes: `(tenantId, outletId, date)` for date-range queries and `(tenantId, outletId, productId)` for product-specific queries.
  - **Expected output:** Indexes are visible in the database. A query filtered by `(tenantId, outletId)` with a date range uses the index (check with query explain/analyze).

---

### T-01.2 — `[BE]` Create the `DailyRevenueSummary` table

**What:** A precomputed table that stores per-outlet, per-day revenue totals. One row per (outletId, date) combination.

**Schema:**

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, auto-generated | — |
| tenantId | UUID | FK → Tenant, required | — |
| outletId | UUID | FK → Outlet, required | — |
| date | date | YYYY-MM-DD, required | — |
| totalInvoices | integer | >= 0 | Count of SALE invoices (not REFUND) on this date |
| totalRefunds | integer | >= 0 | Count of REFUND invoices on this date |
| grossRevenue | decimal | >= 0 | SUM of subtotals before discounts across all SALE invoices |
| totalDiscounts | decimal | >= 0 | SUM of all discount amounts (item + bill) across all SALE invoices |
| netRevenue | decimal | >= 0 | `grossRevenue - totalDiscounts` |
| totalGstAmount | decimal | >= 0 | SUM of `totalGstAmount` across all SALE invoices |
| grandTotal | decimal | >= 0 | `netRevenue + totalGstAmount` |

**Note on refunds:** REFUND invoices are counted in `totalRefunds` but their negative amounts are NOT subtracted from `grossRevenue`, `netRevenue`, or `grandTotal` in this table. The revenue figures here are SALE-only. Refund impact is visible separately via the `totalRefunds` count and the refund amounts shown in the Revenue Overview cards (computed from live queries or `DailyProductSales`). This simplifies the nightly job significantly.

**Unique constraint:** `UNIQUE(outletId, date)`.

**Index:** Composite index on `(tenantId, outletId, date)`.

**Expected output:** Table created with correct schema, unique constraint, and index.

---

- [ ] **ST-01.2.1** Create the `DailyRevenueSummary` model/schema with all fields. Add unique constraint on `(outletId, date)` and index on `(tenantId, outletId, date)`.
  - **Expected output:** Table exists. Duplicate (outletId, date) insert fails. Migration runs cleanly.

---

### T-01.3 — `[BE]` Implement the nightly computation job

**What:** A background job that runs daily at 00:01 IST and computes `DailyProductSales` and `DailyRevenueSummary` rows for the previous day.

**Schedule:** `00:01 IST` = `18:31 UTC` of the previous day. This ensures all invoices created on the previous IST day are captured before computation begins.

**How to implement the schedule:**  
Use the project's existing job scheduling mechanism (e.g. node-cron, agenda, bull, or a cron expression in a serverless scheduler). The cron expression for 00:01 IST (18:31 UTC) is: `31 18 * * *`.

**Job algorithm (step by step):**

**Step 1: Determine the target date.**
```
targetDate = yesterday in IST (UTC - today's date at midnight IST = previous calendar day)
targetDateString = format as "YYYY-MM-DD"
```

IST is UTC+5:30. To get yesterday in IST:
```
const now = new Date();
const istOffset = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + istOffset);
const yesterday = new Date(istNow);
yesterday.setUTCDate(istNow.getUTCDate() - 1);
targetDateString = `${yesterday.getUTCFullYear()}-${pad(yesterday.getUTCMonth()+1)}-${pad(yesterday.getUTCDate())}`;
```

**Step 2: Find all active (tenantId, outletId) pairs with invoice activity on targetDate.**
```sql
SELECT DISTINCT tenantId, outletId 
FROM invoices 
WHERE DATE(createdAt AT TIME ZONE 'Asia/Kolkata') = targetDate
  AND isDeleted = false
```

**Step 3: For each (tenantId, outletId) pair, compute `DailyProductSales`.**

For each distinct `productId` that appears in any invoice item for this (tenantId, outletId) on targetDate:

```
unitsSold = SUM(item.quantity) for SALE invoices
refundedUnits = SUM(item.quantity) for REFUND invoices
netUnitsSold = MAX(0, unitsSold - refundedUnits)

grossRevenue = SUM(item.unitPrice × item.quantity) from SALE invoices
itemDiscountTotal = SUM(item.itemDiscountAmount) from SALE invoices
billDiscountShare = SUM( (item.lineTotal / invoice.subtotal) × invoice.billDiscountAmount ) from SALE invoices
discountAmount = itemDiscountTotal + billDiscountShare
netRevenue = grossRevenue - discountAmount
gstAmount = SUM(item.gstAmount) from SALE invoices
```

Upsert into `DailyProductSales`: if a row for (outletId, productId, date) already exists, update it. If not, insert it. This makes the job idempotent.

**Step 4: For each (tenantId, outletId) pair, compute `DailyRevenueSummary`.**

```
totalInvoices = COUNT of SALE invoices for this (outletId, date)
totalRefunds = COUNT of REFUND invoices for this (outletId, date)
grossRevenue = SUM(invoice.subtotal) from SALE invoices (subtotal = pre-discount sum)
totalDiscounts = SUM(invoice.billDiscountAmount + SUM(item.itemDiscountAmount)) from SALE invoices
netRevenue = grossRevenue - totalDiscounts
totalGstAmount = SUM(invoice.totalGstAmount) from SALE invoices
grandTotal = netRevenue + totalGstAmount
```

Upsert into `DailyRevenueSummary`.

**Step 5: Log job completion** — log the targetDate, number of (tenantId, outletId) pairs processed, and any errors.

**Failure handling:**
- If the job fails entirely: log the error. A retry mechanism runs the job again every hour until it succeeds for the missed date.
- If processing one (tenantId, outletId) pair fails: log the error, continue processing other pairs. Mark that pair for retry.
- The job is idempotent — running it twice for the same date produces the same result (upsert behavior).

**Expected output:** Job file exists. Running the job manually for yesterday computes correct rows in `DailyProductSales` and `DailyRevenueSummary`. Running it again for the same date updates the rows without duplicating them.

---

- [ ] **ST-01.3.1** Create the job file (`jobs/analytics-nightly.ts` or equivalent). Implement the IST date calculation to determine `targetDate`. Log start and completion.
  - **Expected output:** Job file exists. Running it manually logs the correct `targetDate` (yesterday in IST).

- [ ] **ST-01.3.2** Implement Step 2: query distinct (tenantId, outletId) pairs with invoice activity on `targetDate`. Use IST-aware date filtering.
  - **Expected output:** For a test day with invoices, the query returns the correct pairs. For a day with no invoices, it returns an empty array (job exits cleanly).

- [ ] **ST-01.3.3** Implement Step 3: compute `DailyProductSales` for each (tenantId, outletId) pair. Implement the `billDiscountShare` proportional calculation. Upsert each row.
  - **Expected output:** After running the job for a day that had invoices, `DailyProductSales` contains correct rows. Key values to verify: `netUnitsSold` is never negative, `netRevenue` is `grossRevenue - discountAmount`.

- [ ] **ST-01.3.4** Implement Step 4: compute `DailyRevenueSummary` for each (tenantId, outletId) pair. Upsert each row.
  - **Expected output:** After running the job, `DailyRevenueSummary` has one row per (outletId, date) pair processed. Values match the sum of all SALE invoices for that day.

- [ ] **ST-01.3.5** Implement failure handling: wrap each (tenantId, outletId) processing block in a try-catch. Log errors per pair without stopping the job. Implement the hourly retry for completely missed dates.
  - **Expected output:** Simulating a failure for one tenant's data does not prevent other tenants from being processed. The job logs the error and continues.

- [ ] **ST-01.3.6** Schedule the job using the project's scheduler at `18:31 UTC` (`31 18 * * *` cron expression). Verify the schedule is registered on server startup.
  - **Expected output:** Job is registered. It runs automatically at 00:01 IST daily. Manual trigger also works for testing.

---

### T-01.4 — `[BE]` Implement the one-time historical backfill job

**What:** A one-time job that, on first deployment of MVP 3.5, computes `DailyProductSales` and `DailyRevenueSummary` for ALL historical invoice data since MVP 1 launch.

**How:**  
The backfill job is essentially the nightly job but run for every historical date that has invoice data, not just yesterday. It must be run in batches to avoid overloading the database.

**Algorithm:**
1. Find the earliest invoice `createdAt` date in the database (IST-adjusted).
2. Generate a list of all dates from that date to yesterday (inclusive).
3. For each date in the list (in batches of 7 days to limit DB load):
   - Run the same computation as the nightly job (Steps 2–4 from T-01.3).
   - Add a 500ms delay between batches to avoid database saturation.
4. Log progress: "Processed {N} of {total} days".

**Triggering the backfill:**  
Expose a protected admin API endpoint: `POST /admin/analytics/backfill`. This endpoint is called once by the developer after MVP 3.5 deployment. It is protected by a secret key in the request header (not tenant auth). The job runs asynchronously — the endpoint returns immediately with `{ message: "Backfill started" }` and the job runs in the background.

**Idempotency:** The backfill is safe to run multiple times. Rows that already exist are updated (upsert), not duplicated.

**Expected output:** Running the backfill endpoint processes all historical dates. After completion, `DailyProductSales` and `DailyRevenueSummary` contain rows for every day that had invoice activity since MVP 1 launch.

---

- [ ] **ST-01.4.1** Create the backfill job file (`jobs/analytics-backfill.ts`). Implement the date range generation (from earliest invoice date to yesterday, IST-adjusted). Implement batch processing with 500ms delays between batches.
  - **Expected output:** Job runs without crashing. Progress is logged. For a test database with 90 days of data, all 90 days are processed.

- [ ] **ST-01.4.2** Create the `POST /admin/analytics/backfill` endpoint. Protect it with a secret header check (`X-Admin-Secret: {ADMIN_SECRET}` from environment variable). Trigger the backfill job asynchronously. Return immediately with `{ message: "Backfill started" }`.
  - **Expected output:** Calling the endpoint without the secret header returns 403. Calling with the correct secret starts the backfill and returns 202 immediately.

---

---

## US-02 — Analytics API: Stock Insights Endpoints

**As a developer, I need API endpoints that serve the stock insights data — low stock products, product health categories, and deficit summary — so the frontend can render the Stock Insights screen.**

**Scope:** Backend only.  
**Dependency:** US-01 must be complete.

---

### T-02.1 — `[BE]` Create the Low Stock endpoint

**What:** `GET /tenants/:tenantId/analytics/low-stock` — returns all products where `StockRecord.quantity <= 10`, sorted by quantity ascending.

**Query logic:**
1. Fetch all `StockRecord` rows for this tenant's default outlet where `quantity <= 10`.
2. For each, fetch the associated product name.
3. Sort by `quantity` ascending (lowest stock first — 0 and negative before small positives).

**Response shape:**
```json
{
  "lowStockProducts": [
    {
      "productId": "uuid",
      "productName": "Rice 1kg",
      "currentStock": -2,
      "stockStatus": "NEGATIVE"
    },
    {
      "productId": "uuid",
      "productName": "Sugar 1kg",
      "currentStock": 0,
      "stockStatus": "OUT_OF_STOCK"
    },
    {
      "productId": "uuid",
      "productName": "Salt 500g",
      "currentStock": 7,
      "stockStatus": "LOW"
    }
  ],
  "count": 3
}
```

**`stockStatus` values:**
- `NEGATIVE`: `quantity < 0`
- `OUT_OF_STOCK`: `quantity = 0`
- `LOW`: `1 <= quantity <= 10`

**Note:** Only non-deleted products are included (`product.isDeleted = false`).

**Expected output:** Endpoint returns correct products. Sorted by quantity ascending. Only non-deleted products. Returns empty array if no products are below threshold.

---

- [ ] **ST-02.1.1** Create route `GET /tenants/:tenantId/analytics/low-stock`. Authenticate. Get the tenant's default outlet. Query StockRecords with `quantity <= 10` joined with Products where `isDeleted = false`. Sort ascending.
  - **Expected output:** Returns correct products in correct order. Empty array when no products are low stock.

- [ ] **ST-02.1.2** Compute `stockStatus` per product (`NEGATIVE`, `OUT_OF_STOCK`, or `LOW`) and include in response. Include `count` field.
  - **Expected output:** Each product in the response has the correct `stockStatus`. `count` equals `lowStockProducts.length`.

---

### T-02.2 — `[BE]` Create the Product Health Categories endpoint

**What:** `GET /tenants/:tenantId/analytics/product-health?window=30` — computes product health categories (Fast Selling, Slow Selling, Dead Stock, Normal) for the given time window.

**Query parameter:** `window` — integer, one of `7`, `30`, or `90`. Default: `30`.

**Algorithm (implement exactly as specified in PRD Section 7.2):**

**Step 1: Compute `avgDailySales` for each product.**
```
For the given window (e.g. 30 days):
  startDate = today IST - window days
  endDate = yesterday IST (today's data comes from live query, merged below)

  historicalSales = DailyProductSales WHERE outletId = X AND date BETWEEN startDate AND endDate
  
  For today: run live aggregation on Invoice table for today's date (same logic as nightly job but for today only)
  
  Merge historical + today into a product map:
    productMap[productId] = {
      totalNetUnitsSold: sum of netUnitsSold across all days (historical + today),
      daysWithSales: count of days where netUnitsSold > 0,
      lastSaleDate: most recent date with netUnitsSold > 0,
    }
  
  avgDailySales[productId] = totalNetUnitsSold / window
```

**Step 2: Check minimum data requirements.**
```
productsWithAnySales = count of products where totalNetUnitsSold > 0

If productsWithAnySales < 5:
  return { categories: null, reason: "INSUFFICIENT_PRODUCTS" }

maxAvgDaily = max(avgDailySales values)
minAvgDaily = min(avgDailySales values among products with any sales)

If (maxAvgDaily - minAvgDaily) <= 2:
  return { categories: null, reason: "INSUFFICIENT_DIFFERENTIATION" }
```

**Step 3: Assign categories.**
```
Sort products by avgDailySales descending

totalProductsWithSales = count
top20PercentCount = Math.ceil(totalProductsWithSales × 0.2)
bottom20PercentCount = Math.ceil(totalProductsWithSales × 0.2)

fastSelling = top [top20PercentCount] products (including ties at the boundary)
slowSelling = bottom [bottom20PercentCount] products that have avgDailySales > 0
            AND are not already in fastSelling
            AND do NOT qualify for deadStock

daysSinceLastSale = today IST - lastSaleDate (in days)

deadStock = products where avgDailySales = 0 AND daysSinceLastSale >= 30

normal = all remaining products with avgDailySales > 0 not in fast/slow
```

**Tie handling for category boundaries:**
- If the product at position `top20PercentCount` has the same `avgDailySales` as the product at position `top20PercentCount + 1`, include ALL tied products in Fast Selling (boundary expands to include all ties).
- Apply the same logic to the Slow Selling boundary.

**Response shape:**
```json
{
  "window": 30,
  "categoriesAvailable": true,
  "insufficientReason": null,
  "fastSelling": [
    {
      "productId": "uuid",
      "productName": "Rice 1kg",
      "avgDailySales": 12.4,
      "totalSoldInWindow": 372
    }
  ],
  "slowSelling": [
    {
      "productId": "uuid",
      "productName": "Old Spice",
      "avgDailySales": 0.3,
      "daysSinceLastSale": 5
    }
  ],
  "deadStock": [
    {
      "productId": "uuid",
      "productName": "Expired Cream",
      "daysSinceLastSale": 47,
      "currentStock": 12
    }
  ],
  "normal": [
    { "productId": "uuid", "productName": "Sugar 1kg", "avgDailySales": 3.2, "totalSoldInWindow": 96 }
  ]
}
```

When `categoriesAvailable = false`, the array fields are all empty and `insufficientReason` is `"INSUFFICIENT_PRODUCTS"` or `"INSUFFICIENT_DIFFERENTIATION"`.

**Expected output:** Endpoint returns correct categorized product lists. Minimum data checks work. Dead stock takes precedence over slow selling.

---

- [ ] **ST-02.2.1** Create route `GET /tenants/:tenantId/analytics/product-health`. Parse and validate `window` query param (default 30, must be 7/30/90). Get tenant's default outlet.
  - **Expected output:** Invalid window values return 400. Valid values proceed.

- [ ] **ST-02.2.2** Implement the historical data query: fetch from `DailyProductSales` for (outletId, date range). Build the product map.
  - **Expected output:** Product map is populated from historical data. Products with no sales in the window have zero totals.

- [ ] **ST-02.2.3** Implement the today's live data query: aggregate today's invoices for the outlet (same productId-level breakdown as the nightly job). Merge into the product map.
  - **Expected output:** Today's sales are included in `totalNetUnitsSold` and reflected in `avgDailySales`.

- [ ] **ST-02.2.4** Implement the minimum data checks (insufficient products and insufficient differentiation). Return early with the correct `insufficientReason` when conditions are not met.
  - **Expected output:** With 3 products having sales, returns `{ categoriesAvailable: false, insufficientReason: "INSUFFICIENT_PRODUCTS" }`. With 5 products all selling 3 units/day, returns `INSUFFICIENT_DIFFERENTIATION`.

- [ ] **ST-02.2.5** Implement the category assignment algorithm exactly as specified: compute `avgDailySales`, sort descending, assign top/bottom 20% to fast/slow, apply tie-boundary expansion, assign dead stock (with precedence over slow selling), assign normal.
  - **Expected output:** Products are correctly categorized. A product with 0 sales for 35 days appears in Dead Stock, not Slow Selling even if it would rank in bottom 20%.

- [ ] **ST-02.2.6** Build and return the full response JSON. Include `currentStock` for dead stock products (fetched from StockRecord).
  - **Expected output:** Response shape matches the spec exactly. All four category arrays are present.

---

### T-02.3 — `[BE]` Create the Deficit Summary endpoint

**What:** `GET /tenants/:tenantId/analytics/deficit-summary` — returns a compact summary of pending deficits for the Stock Insights screen widget.

**Response shape:**
```json
{
  "pendingProductCount": 3,
  "totalPendingQuantity": 45,
  "hasDeficits": true
}
```

**Query logic:**
- Count distinct `productId` values in DeficitRecords where `status = PENDING` and `tenantId = X` and `outletId = default outlet`.
- Sum all `quantity` values from those records.

**Expected output:** Fast endpoint (simple aggregation). Returns zero counts when no deficits exist.

---

- [ ] **ST-02.3.1** Create route `GET /tenants/:tenantId/analytics/deficit-summary`. Aggregate DeficitRecords for the tenant's default outlet with `status = PENDING`. Return the counts.
  - **Expected output:** Returns `{ pendingProductCount: 3, totalPendingQuantity: 45, hasDeficits: true }` for a tenant with deficits. Returns `{ pendingProductCount: 0, totalPendingQuantity: 0, hasDeficits: false }` for clean state.

---

---

## US-03 — Analytics API: Revenue Overview Endpoints

**As a developer, I need API endpoints that serve the revenue overview data — summary cards, chart data, top products, payment breakdown, and GST summary — for the given time period.**

**Scope:** Backend only.  
**Dependency:** US-01 must be complete.

---

### T-03.1 — `[BE]` Create the Revenue Summary endpoint

**What:** `GET /tenants/:tenantId/analytics/revenue-summary?period=last30days` — returns the four summary card values for the given period.

**Query parameters:**
- `period`: one of `today`, `this_week`, `this_month`, `last7days`, `last30days`, `last90days`
- `dateFrom` and `dateTo`: ISO date strings, used when `period = custom`

**Period resolution logic (all dates in IST):**
```
today           → startDate = today, endDate = today
this_week       → startDate = most recent Monday, endDate = today
this_month      → startDate = 1st of current month, endDate = today
last7days       → startDate = today - 6 days, endDate = today
last30days      → startDate = today - 29 days, endDate = today
last90days      → startDate = today - 89 days, endDate = today
custom          → startDate = dateFrom, endDate = dateTo (validate start <= end)
```

**Data strategy:**
- For all dates BEFORE today: read from `DailyRevenueSummary`. If a date's row is missing (nightly job hadn't run yet), fall back to live Invoice query for that specific date.
- For today: always use a live Invoice query.

**Response shape:**
```json
{
  "period": "last30days",
  "startDate": "2026-03-27",
  "endDate": "2026-04-25",
  "totalNetRevenue": 125430.50,
  "totalInvoices": 342,
  "totalRefundsCount": 12,
  "totalRefundsAmount": -8450.00,
  "avgInvoiceValue": 366.75
}
```

**Calculations:**
- `totalNetRevenue` = SUM of `netRevenue` from `DailyRevenueSummary` rows (or live fallback)
- `totalInvoices` = SUM of `totalInvoices`
- `totalRefundsCount` = SUM of `totalRefunds`
- `totalRefundsAmount` = SUM of `grandTotal` from REFUND invoices in the period (negative value, from live Invoice query — not in precomputed table)
- `avgInvoiceValue` = `totalNetRevenue / totalInvoices` (0 if totalInvoices = 0)

**Expected output:** Endpoint returns correct values for each period type. Today uses live query. Historical uses precomputed table. Custom date validation works.

---

- [ ] **ST-03.1.1** Create route `GET /tenants/:tenantId/analytics/revenue-summary`. Parse `period` and optional `dateFrom`/`dateTo`. Implement the period-to-date-range resolution logic (IST-aware).
  - **Expected output:** `period=last30days` correctly produces a 30-day date range ending today. `period=custom` with invalid range returns 400.

- [ ] **ST-03.1.2** Implement the data fetch: query `DailyRevenueSummary` for the date range. For any missing dates (including today), fall back to live Invoice aggregation.
  - **Expected output:** For a period spanning yesterday and today, yesterday's data comes from the precomputed table and today's data from the live query.

- [ ] **ST-03.1.3** Compute `totalRefundsAmount` from a live REFUND invoice query for the period (since refunds are not in `DailyRevenueSummary`). Compute `avgInvoiceValue`.
  - **Expected output:** `totalRefundsAmount` is the sum of REFUND invoice `grandTotal` values (negative numbers). `avgInvoiceValue` is correct.

---

### T-03.2 — `[BE]` Create the Revenue Chart Data endpoint

**What:** `GET /tenants/:tenantId/analytics/revenue-chart?period=last30days` — returns daily (or weekly/hourly) revenue data for the bar chart.

**Aggregation logic:**
- **Period <= 30 days:** Return one data point per day. Each point: `{ date: "YYYY-MM-DD", netRevenue: 1234.50, grossRevenue: 1400, discounts: 165.50, invoiceCount: 8 }`.
- **Period > 30 days (last90days, custom ranges > 30 days):** Return one data point per week. Each point: `{ weekStartDate: "YYYY-MM-DD", netRevenue: ..., grossRevenue: ..., discounts: ..., invoiceCount: ... }`.
- **Period = today:** Return one data point per hour (8am–10pm IST, plus any hours outside this range that have actual sales). Each point: `{ hour: "08:00", netRevenue: ..., invoiceCount: ... }`.

**Data source:**
- For historical days (before today): read from `DailyRevenueSummary` (daily rows). For weekly aggregation, GROUP BY week in the query.
- For today: live Invoice query grouped by `HOUR(createdAt AT TIME ZONE 'Asia/Kolkata')`.
- For missing historical days: include a zero-value data point (to maintain chart continuity).

**Response shape:**
```json
{
  "aggregation": "daily",
  "dataPoints": [
    {
      "label": "2026-03-27",
      "netRevenue": 4230.00,
      "grossRevenue": 4800.00,
      "discounts": 570.00,
      "invoiceCount": 12
    }
  ]
}
```

**Expected output:** Endpoint returns data points in chronological order. Zero-value days are included. The `aggregation` field correctly reflects whether data is `daily`, `weekly`, or `hourly`.

---

- [ ] **ST-03.2.1** Create route `GET /tenants/:tenantId/analytics/revenue-chart`. Parse `period`. Determine aggregation type (daily/weekly/hourly) based on period length.
  - **Expected output:** `last7days` → daily. `last90days` → weekly. `today` → hourly. Route exists and authenticates.

- [ ] **ST-03.2.2** For daily aggregation: query `DailyRevenueSummary` for the date range. Fill in zero-value data points for dates with no rows. Merge today's live data.
  - **Expected output:** 30 data points for `last30days`. Days with no sales have `netRevenue: 0, invoiceCount: 0`.

- [ ] **ST-03.2.3** For weekly aggregation: query `DailyRevenueSummary` and group by ISO week. Each week's `netRevenue` is the sum of its constituent days.
  - **Expected output:** 13 data points for `last90days` (13 complete weeks). Each point's label is the Monday start date of the week.

- [ ] **ST-03.2.4** For hourly aggregation (today only): query Invoices created today in IST, grouped by hour. Generate data points for hours 8–22 regardless of whether sales occurred in that hour.
  - **Expected output:** 15 data points (8am to 10pm). Hours without sales show `netRevenue: 0`. Hours with sales show correct values.

---

### T-03.3 — `[BE]` Create the Top Products endpoint

**What:** `GET /tenants/:tenantId/analytics/top-products?period=last30days` — returns the top 10 products by net revenue in the given period.

**Query logic:**
- For historical days: SUM `netRevenue` and `netUnitsSold` from `DailyProductSales` grouped by `productId`.
- For today: live aggregation from Invoice table.
- Merge historical + today per productId.
- Sort by total `netRevenue` descending. Take top 10.
- Compute `percentOfTotal = (product.netRevenue / totalNetRevenue) × 100`.

**Response shape:**
```json
{
  "topProducts": [
    {
      "rank": 1,
      "productId": "uuid",
      "productName": "Rice 1kg",
      "netRevenue": 22400.00,
      "unitsSold": 560,
      "percentOfTotal": 17.84
    }
  ],
  "totalNetRevenue": 125430.50
}
```

**Expected output:** Top 10 products sorted by `netRevenue` descending. `percentOfTotal` sums to approximately 100% across all products (not just top 10). Top 10 percentages can be less than 100%.

---

- [ ] **ST-03.3.1** Create route `GET /tenants/:tenantId/analytics/top-products`. Query `DailyProductSales` for the period, SUM by productId. Merge today's live data. Sort descending, take top 10. Compute `percentOfTotal`.
  - **Expected output:** Returns up to 10 products. Correct ranking and revenue figures. `percentOfTotal` is computed against the total of ALL products, not just the top 10.

---

### T-03.4 — `[BE]` Create the Payment Method Breakdown endpoint

**What:** `GET /tenants/:tenantId/analytics/payment-breakdown?period=last30days` — returns invoice counts and revenue amounts grouped by payment method.

**Query logic:**  
Live query from Invoice table (SALE invoices only) for the given period, grouped by `paymentMethod`. Return count and sum of `grandTotal` per payment method.

**Note:** This is always a live query — not precomputed. It is a simple aggregation query on a filtered set of invoices.

**Response shape:**
```json
{
  "breakdown": [
    { "method": "CASH", "invoiceCount": 180, "totalAmount": 65430.00, "percentage": 52.17 },
    { "method": "CARD", "invoiceCount": 85, "totalAmount": 38200.50, "percentage": 30.46 },
    { "method": "UPI", "invoiceCount": 77, "totalAmount": 21800.00, "percentage": 17.37 }
  ],
  "totalInvoices": 342
}
```

**`percentage`** is percentage of total invoice count (not revenue).

**Expected output:** All three payment methods are always present in the response (even if count = 0). Percentages sum to 100%.

---

- [ ] **ST-03.4.1** Create route `GET /tenants/:tenantId/analytics/payment-breakdown`. Query SALE invoices for the period, group by `paymentMethod`. Ensure all three methods (CASH, CARD, UPI) appear even if count is 0. Compute percentages.
  - **Expected output:** All three methods always in response. Correct counts and amounts. Percentages computed correctly.

---

### T-03.5 — `[BE]` Create the GST Summary endpoint

**What:** `GET /tenants/:tenantId/analytics/gst-summary?period=last30days` — returns GST collected in the period, plus a count of GST vs non-GST invoices.

**Query logic:**
- SUM `totalGstAmount` from `DailyRevenueSummary` for the date range (plus today's live data).
- Count of SALE invoices with `isGstInvoice = true` vs `isGstInvoice = false` for the period (live query on Invoice table — not precomputed).

**Visibility rule:** This endpoint is always callable but the frontend only displays the GST section when the tenant has ever had GST enabled (`tenant.gstEnabled = true` OR any historical invoice has `isGstInvoice = true`). The backend always returns the data; the frontend decides whether to show it.

**Response shape:**
```json
{
  "totalGstCollected": 18540.00,
  "gstInvoiceCount": 220,
  "nonGstInvoiceCount": 122,
  "hasGstData": true
}
```

**`hasGstData`:** `true` if `totalGstCollected > 0` OR `gstInvoiceCount > 0`.

**Expected output:** Returns correct GST totals. `hasGstData` is `false` for tenants who have never used GST.

---

- [ ] **ST-03.5.1** Create route `GET /tenants/:tenantId/analytics/gst-summary`. Query `DailyRevenueSummary` for `totalGstAmount` sum. Count GST vs non-GST SALE invoices in the period. Compute `hasGstData`.
  - **Expected output:** Returns correct values. A tenant with no GST invoices gets `hasGstData: false` and zero counts.

---

---

## US-04 — Navigation: Analytics Nav Item and Low Stock Badge

**As a shopkeeper, I want to see an Analytics option in the navigation so I can access insights at any time, and a badge that immediately tells me when products are low on stock.**

**Scope:** Frontend only.  
**Dependency:** US-02 (low stock endpoint) must be complete for the badge. The nav item itself can be added before the backend is ready.

---

### T-04.1 — `[FE]` Add Analytics nav item

**What:** Add an "Analytics" link to the main navigation sidebar/bar that navigates to `/analytics/stock`.

**How:**  
Locate the navigation component (e.g. `components/shell/sidebar.tsx` or `components/shell/nav.tsx`). Add a new nav item after the existing items.

**Nav item:**
- Label: "Analytics"
- Icon: a chart/bar icon from the project's icon library (lucide-react: `BarChart2` or `TrendingUp`)
- Link: `/analytics/stock`
- Active state: highlight when the current path starts with `/analytics/`

**Expected output:** "Analytics" appears in the nav. Clicking it navigates to `/analytics/stock`. The item is highlighted when on any analytics page.

---

- [ ] **ST-04.1.1** Add the "Analytics" nav item to the navigation component. Use the correct icon. Link to `/analytics/stock`. Apply the active state when `pathname.startsWith('/analytics')`.
  - **Expected output:** Nav item is visible. Navigation works. Active state is correct on both analytics pages.

---

### T-04.2 — `[FE]` Add low stock badge to Analytics nav item (optional but included)

**What:** A count badge on the Analytics nav item showing the number of low-stock products. Refreshed every 5 minutes. Hidden when count is 0.

**How:**  
Create a client component that wraps the nav item. It fetches the low stock count on mount and every 5 minutes.

**Implementation:**

```typescript
// components/shell/low-stock-badge.tsx
"use client";
import { useState, useEffect } from "react";
import clientAxios from "@/lib/axios/client";
import { useInterval } from "@/hooks/use-interval"; // or implement inline

export function LowStockBadge({ tenantId }: { tenantId: string }) {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const { data } = await clientAxios.get(
        `/tenants/${tenantId}/analytics/low-stock`
      );
      setCount(data.count);
    } catch {
      // Silently fail — badge is non-critical
    }
  };

  useEffect(() => {
    fetchCount();
  }, []);

  // Refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className="badge-red">{count > 99 ? "99+" : count}</span>
  );
}
```

**Note:** The badge does NOT use a Zustand store — it is transient UI state that does not need to persist. Local component state is correct here.

**Expected output:** Badge appears next to "Analytics" nav item when any product has stock <= 10. Disappears when all products are above threshold. Refreshes every 5 minutes automatically.

---

- [ ] **ST-04.2.1** Create `components/shell/low-stock-badge.tsx` with the implementation above. Fetch on mount and every 5 minutes. Render nothing when count is 0.
  - **Expected output:** Badge appears when low stock products exist. Badge disappears when count reaches 0. No errors in console when the endpoint is unavailable.

- [ ] **ST-04.2.2** Integrate `<LowStockBadge>` into the Analytics nav item. Pass `tenantId` from the layout's server-fetched tenant data.
  - **Expected output:** Badge is positioned correctly on the nav item. Visible only when low stock count > 0.

---

---

## US-05 — Stock Insights Screen: Low Stock Alerts

**As a shopkeeper, I want to see at a glance which products are running low so I know what to restock immediately.**

**Scope:** Frontend only.  
**Dependency:** US-02 T-02.1 (low stock endpoint) must be complete.

---

### T-05.1 — `[FE]` Create the Stock Insights page and low stock section

**What:** The main analytics page at `/analytics/stock`. The first section is the Low Stock alerts card.

**Page structure:**  
`app/(dashboard)/analytics/stock/page.tsx` — server component that fetches low stock data and passes it to child components.

```typescript
// app/(dashboard)/analytics/stock/page.tsx
import { getLowStockProducts } from "@/lib/api/analytics";
import { getDeficitSummary } from "@/lib/api/analytics";
import { cookies } from "next/headers";

export default async function StockInsightsPage({ searchParams }) {
  const tenantId = cookies().get("tenant_id")?.value!;
  const [lowStockData, deficitSummary] = await Promise.all([
    getLowStockProducts(tenantId),
    getDeficitSummary(tenantId),
  ]);
  return (
    <StockInsightsScreen
      lowStockData={lowStockData}
      deficitSummary={deficitSummary}
    />
  );
}
```

**`lib/api/analytics.ts` query functions:**
```typescript
export async function getLowStockProducts(tenantId: string) {
  const api = createServerAxios();
  const { data } = await api.get(`/tenants/${tenantId}/analytics/low-stock`);
  return data;
}

export async function getDeficitSummary(tenantId: string) {
  const api = createServerAxios();
  const { data } = await api.get(`/tenants/${tenantId}/analytics/deficit-summary`);
  return data;
}
```

**Low Stock section layout:**
- A card at the top of the page with header "Low Stock" and a count badge (e.g. "3 products").
- If `count = 0`: show a green success state — "All products are well-stocked."
- If `count > 0`: show a list of products:
  - Each row: product name, stock quantity display, and a link to the product edit page.
  - For `NEGATIVE` stock: show quantity in red with "Negative stock" label.
  - For `OUT_OF_STOCK`: show "Out of stock" in red.
  - For `LOW`: show quantity in amber (e.g. "7 remaining").
  - Sorted by quantity ascending (most critical first).

**Clicking a product row:** Navigate to `/products/{productId}/edit`.

**Expected output:** Page loads correctly. Low stock section shows the right products in the right order. Empty state shows the success message. Links navigate to the edit page.

---

- [ ] **ST-05.1.1** Create `lib/api/analytics.ts` with `getLowStockProducts` and `getDeficitSummary` query functions using `createServerAxios`.
  - **Expected output:** Functions are importable. Calling them in a server component returns the correct data.

- [ ] **ST-05.1.2** Create `app/(dashboard)/analytics/stock/page.tsx` as an async server component. Fetch `lowStockData` and `deficitSummary` in parallel using `Promise.all`. Pass to `StockInsightsScreen`.
  - **Expected output:** Page loads. Data is fetched server-side. No client-side loading state needed for the initial render.

- [ ] **ST-05.1.3** Create `features/analytics/stock-insights-screen.tsx` (client component for interactivity — product health window selector is interactive). Render the Low Stock card section with the correct product list and status labels.
  - **Expected output:** Low stock card renders correctly for all three stock status types. Empty state (all well-stocked) shows the green message.

- [ ] **ST-05.1.4** Wire product row clicks to navigate to `/products/{productId}/edit`. Use Next.js `<Link>` component.
  - **Expected output:** Clicking a product row navigates to the product edit page.

---

---

## US-06 — Stock Insights Screen: Product Health Categories

**As a shopkeeper, I want to see my products categorized as Fast Selling, Slow Selling, Dead Stock, or Normal so I can make informed purchasing and stocking decisions.**

**Scope:** Frontend only.  
**Dependency:** US-02 T-02.2 (product health endpoint) must be complete.

---

### T-06.1 — `[FE]` Build the Product Health section with time window selector

**What:** An interactive section on the Stock Insights screen showing the product health categories. A segmented control lets the user choose the time window (7/30/90 days).

**State management:**  
The selected time window is interactive — it changes which data is fetched. Use local React state (not Zustand — this is transient UI state) for the selected window. Re-fetch data when the window changes.

**Implementation pattern:**  
Since the time window selector changes the data, this section is a client component that fetches its own data using `clientAxios`. The parent page fetches the default (30-day) data server-side for the initial render; the client component takes over for subsequent window changes.

**Client component approach:**
```typescript
// features/analytics/product-health-section.tsx
"use client";
import { useState, useEffect } from "react";
import clientAxios from "@/lib/axios/client";

type Window = 7 | 30 | 90;

export function ProductHealthSection({ tenantId, initialData }: {
  tenantId: string;
  initialData: ProductHealthData;
}) {
  const [window, setWindow] = useState<Window>(30);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window === 30) { setData(initialData); return; } // use server-fetched initial
    setLoading(true);
    clientAxios
      .get(`/tenants/${tenantId}/analytics/product-health?window=${window}`)
      .then(res => setData(res.data))
      .catch(() => {}) // silently fail — existing data remains shown
      .finally(() => setLoading(false));
  }, [window]);

  // render...
}
```

**Time window selector UI:**  
A segmented control with three options: "7 days", "30 days", "90 days". The active option is highlighted. Changing the selection triggers a data re-fetch.

**Expected output:** Segmented control renders. Selecting a different window fetches new data and updates the category lists. Loading state shown while fetching.

---

- [ ] **ST-06.1.1** Add the product health endpoint to `lib/api/analytics.ts`:
  ```typescript
  export async function getProductHealth(tenantId: string, window: 7 | 30 | 90) {
    const api = createServerAxios();
    const { data } = await api.get(`/tenants/${tenantId}/analytics/product-health?window=${window}`);
    return data;
  }
  ```
  Fetch the default (30-day) data in `app/(dashboard)/analytics/stock/page.tsx` and pass as `initialData` prop.
  - **Expected output:** 30-day data is fetched server-side and included in the initial page render.

- [ ] **ST-06.1.2** Create `features/analytics/product-health-section.tsx` as a client component. Implement the segmented control and the `useEffect` that re-fetches on window change. Show a skeleton/spinner while loading.
  - **Expected output:** Segmented control switches windows. Re-fetch fires correctly. Existing data remains visible during the loading state (not replaced by a blank screen).

---

### T-06.2 — `[FE]` Render the four category displays

**What:** Four subsections (Fast Selling, Slow Selling, Dead Stock, Normal) each with the correct layout and visual treatment.

**Fast Selling layout:**
- Green header badge/section label
- For each product: name, "X.X units/day" avg, "Y units total in window"
- Green dot or arrow indicator

**Slow Selling layout:**
- Amber/yellow section label
- For each product: name, "X.X units/day" avg, "Last sold N days ago"
- Amber indicator

**Dead Stock layout:**
- Red section label
- For each product: name, "No sales for X days", current stock quantity
- Red indicator

**Normal layout:**
- Collapsed by default — shows only a toggle: "Show all {N} normal products"
- Expanding shows all normal products with their avg daily sales
- Use local state `const [showNormal, setShowNormal] = useState(false)` — not Zustand

**No categories available states:**
- When `categoriesAvailable = false` and `insufficientReason = "INSUFFICIENT_PRODUCTS"`: show "Not enough sales data to categorize products. Categories appear once you have sales data for 5 or more products."
- When `insufficientReason = "INSUFFICIENT_DIFFERENTIATION"`: show "Your products sell at a similar rate — no meaningful fast/slow distinction yet."

**Expected output:** All four sections render correctly. Normal section is collapsed by default. Clicking the toggle expands it. Correct messages shown when categories are not available.

---

- [ ] **ST-06.2.1** Render the Fast Selling section. Show green visual treatment. For each product: name, `avgDailySales` formatted to 1 decimal (e.g. "12.4 units/day"), `totalSoldInWindow` formatted with comma (e.g. "372 units").
  - **Expected output:** Fast selling products appear with green styling and correct values.

- [ ] **ST-06.2.2** Render the Slow Selling section. Show amber visual treatment. For each product: name, `avgDailySales`, `daysSinceLastSale` formatted (e.g. "Last sold 5 days ago").
  - **Expected output:** Slow selling products appear with amber styling.

- [ ] **ST-06.2.3** Render the Dead Stock section. Show red visual treatment. For each product: name, `daysSinceLastSale` (e.g. "47 days without a sale"), `currentStock` (e.g. "12 units in stock").
  - **Expected output:** Dead stock products appear with red styling. Stock quantity shown correctly.

- [ ] **ST-06.2.4** Render the Normal section as collapsed by default. Show "Show all {N} normal products" toggle. Implement expand/collapse with local state. When expanded, show each normal product's name and `avgDailySales`.
  - **Expected output:** Normal section is collapsed on load. Toggle expands/collapses. N is the correct count of normal products.

- [ ] **ST-06.2.5** Render the "no categories available" states. Check `categoriesAvailable` flag from API response. Show the correct message based on `insufficientReason`.
  - **Expected output:** When the backend returns `categoriesAvailable: false`, the correct message is shown instead of the category sections.

---

---

## US-07 — Stock Insights Screen: Deficit Summary Widget

**As a shopkeeper, I want a compact deficit summary on the analytics screen so I can see if there are unresolved stock discrepancies without navigating away.**

**Scope:** Frontend only.  
**Dependency:** US-02 T-02.3 (deficit summary endpoint) must be complete. Data is already fetched in the page server component from US-05.

---

### T-07.1 — `[FE]` Build the Deficit Summary widget

**What:** A compact card at the bottom of the Stock Insights screen showing pending deficit counts and a link to the full Deficit Management screen.

**Layout:**
- Section title: "Unresolved Deficits"
- If `hasDeficits = false`: show a clean state — "No unresolved deficits. Stock records are consistent."
- If `hasDeficits = true`: show:
  - "{pendingProductCount} products with stock deficits"
  - "{totalPendingQuantity} total units unaccounted for"
  - A "Manage deficits →" link that navigates to `/deficits`

**Visual treatment:** Use a neutral info card for the no-deficits state. Use an amber warning card when deficits exist.

**Expected output:** Widget renders correctly for both states. "Manage deficits" link navigates to `/deficits`.

---

- [ ] **ST-07.1.1** Create `features/analytics/deficit-summary-widget.tsx`. Accept `deficitSummary` as a prop (already fetched by the page server component in US-05). Render the two states (no deficits / has deficits). Wire the "Manage deficits" link.
  - **Expected output:** Widget shows correct state. Link to `/deficits` works. Amber styling when deficits exist, neutral styling when none.

---

---

## US-08 — Revenue Overview Screen: Overview Cards and Time Period Selector

**As a shopkeeper, I want a Revenue Overview screen where I can select a time period and see summary metrics at the top.**

**Scope:** Frontend only.  
**Dependency:** US-03 T-03.1 (revenue summary endpoint) must be complete.

---

### T-08.1 — `[FE]` Create the Revenue Overview page

**What:** A new page at `/analytics/revenue`. Accessible via a tab on the analytics screen (tab bar: "Stock Insights" | "Revenue Overview").

**Page structure:**  
`app/(dashboard)/analytics/revenue/page.tsx` — server component for initial render.

**Analytics navigation tabs:**  
Both analytics pages share a tab bar at the top. Add this tab bar to the analytics layout or to each page:
- "Stock Insights" → `/analytics/stock` (active when on this path)
- "Revenue Overview" → `/analytics/revenue` (active when on this path)

**Tab bar implementation:**  
Create `features/analytics/analytics-tab-bar.tsx` as a simple client component using `usePathname()` to determine the active tab.

**Expected output:** `/analytics/revenue` loads. Tab bar shows on both analytics pages. Switching between tabs navigates correctly.

---

- [ ] **ST-08.1.1** Create `app/(dashboard)/analytics/revenue/page.tsx` as an async server component. Fetch the default `last30days` revenue summary server-side. Pass to `RevenueOverviewScreen`.
  - **Expected output:** Page loads at `/analytics/revenue`. Initial data is rendered server-side.

- [ ] **ST-08.1.2** Create `features/analytics/analytics-tab-bar.tsx`. Use `usePathname()` to highlight the active tab. Render "Stock Insights" and "Revenue Overview" tabs as `<Link>` elements.
  - **Expected output:** Tab bar renders on both analytics pages. Active tab is highlighted. Clicking a tab navigates correctly.

- [ ] **ST-08.1.3** Add `getRevenueSummary` to `lib/api/analytics.ts`:
  ```typescript
  export async function getRevenueSummary(tenantId: string, period: string, dateFrom?: string, dateTo?: string) {
    const api = createServerAxios();
    const { data } = await api.get(`/tenants/${tenantId}/analytics/revenue-summary`, {
      params: { period, dateFrom, dateTo }
    });
    return data;
  }
  ```
  - **Expected output:** Function is importable and callable.

---

### T-08.2 — `[FE]` Build the Time Period Selector

**What:** A segmented control at the top of the Revenue Overview screen allowing the user to select from 7 time period options. Selecting a period re-fetches all revenue data.

**Options:** Today / This week / This month / Last 7 days / Last 30 days / Last 90 days / Custom range  
**Default:** Last 30 days

**State management:**  
The selected period (and custom date range) is stored in URL `searchParams` — not local state and not Zustand. This makes the period selection deep-linkable and survives page refresh.

```typescript
// When user selects a period:
router.push(`/analytics/revenue?period=last7days`);

// When user selects custom:
router.push(`/analytics/revenue?period=custom&dateFrom=2026-03-01&dateTo=2026-03-31`);

// Server component reads:
const period = searchParams.period ?? "last30days";
const dateFrom = searchParams.dateFrom;
const dateTo = searchParams.dateTo;
```

**Custom date range UI:**  
Two date inputs (from/to). When both are filled, navigate to the custom URL. Validate that `dateFrom <= dateTo` before navigating — show inline error "Start date must be before end date" if violated.

**Implementation:**  
`features/analytics/period-selector.tsx` — client component that pushes URL changes.

**Expected output:** Selecting a period updates the URL and the page re-renders with new data. Custom range with invalid dates shows an error and does not navigate.

---

- [ ] **ST-08.2.1** Create `features/analytics/period-selector.tsx`. Render all 7 period options as a segmented control (or dropdown for mobile). Wire each to `router.push('/analytics/revenue?period=X')`.
  - **Expected output:** Selecting "Last 7 days" pushes `?period=last7days` to the URL. The active option is highlighted based on the current URL param.

- [ ] **ST-08.2.2** Implement the custom date range inputs. Show them only when "Custom range" is selected. Validate `dateFrom <= dateTo` before navigating. Show inline error without navigating if invalid.
  - **Expected output:** Custom inputs appear only for custom period. Invalid date range shows "Start date must be before end date" without changing the URL. Valid range navigates.

- [ ] **ST-08.2.3** Update `app/(dashboard)/analytics/revenue/page.tsx` to read `period`, `dateFrom`, `dateTo` from `searchParams`. Pass to `getRevenueSummary()`. Pass `period` as prop to `PeriodSelector` for the active state.
  - **Expected output:** Selecting a period causes the page to re-render with data for that period.

---

### T-08.3 — `[FE]` Build the Overview Cards

**What:** Four summary cards at the top of the Revenue Overview screen.

**Card definitions:**

| Card | Value | Format |
|---|---|---|
| Total Revenue | `totalNetRevenue` | ₹ formatted with commas (e.g. "₹1,25,430.50") |
| Total Invoices | `totalInvoices` | Plain number (e.g. "342") |
| Total Refunds | `totalRefundsCount` + `totalRefundsAmount` | "{N} refunds — ₹{X}" (amount is negative) |
| Avg Invoice Value | `avgInvoiceValue` | ₹ formatted (e.g. "₹366.75") |

**Indian number formatting:** Use the Indian numbering system for currency (lakhs and crores), not international (millions). `₹1,25,430.50` not `₹125,430.50`. Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

**Loading state:** While period change is in progress (URL changed but new data not yet rendered), show skeleton cards.

**Expected output:** Four cards render with correct values. Currency uses Indian formatting. Cards update when the period changes.

---

- [ ] **ST-08.3.1** Create a `formatIndianCurrency(amount: number): string` utility in `lib/utils/format.ts`:
  ```typescript
  export function formatIndianCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  }
  ```
  - **Expected output:** `formatIndianCurrency(125430.50)` returns `"₹1,25,430.50"`.

- [ ] **ST-08.3.2** Create `features/analytics/overview-cards.tsx`. Accept the revenue summary data as props. Render four cards with correct labels, values, and Indian currency formatting.
  - **Expected output:** All four cards render with correct values. Refund card shows both count and formatted amount.

- [ ] **ST-08.3.3** Add skeleton loading state for overview cards. When Next.js is re-fetching (page is loading due to `searchParams` change), the `loading.tsx` file for this route shows skeleton cards.
  - **Expected output:** Create `app/(dashboard)/analytics/revenue/loading.tsx` that shows 4 skeleton card placeholders.

---

---

## US-09 — Revenue Overview Screen: Revenue Bar Chart

**As a shopkeeper, I want a bar chart showing daily (or weekly) revenue over my selected time period so I can see trends at a glance.**

**Scope:** Frontend only.  
**Dependency:** US-03 T-03.2 (revenue chart data endpoint) must be complete.

---

### T-09.1 — `[FE]` Create the revenue chart API query and data fetching

**What:** Fetch chart data and pass to the chart component. The chart data is fetched alongside the revenue summary in the page server component.

**Add to `lib/api/analytics.ts`:**
```typescript
export async function getRevenueChart(tenantId: string, period: string, dateFrom?: string, dateTo?: string) {
  const api = createServerAxios();
  const { data } = await api.get(`/tenants/${tenantId}/analytics/revenue-chart`, {
    params: { period, dateFrom, dateTo }
  });
  return data;
}
```

**Fetch in the page server component** alongside `getRevenueSummary` using `Promise.all`.

**Expected output:** `getRevenueChart` function added. Chart data is fetched server-side and passed as props.

---

- [ ] **ST-09.1.1** Add `getRevenueChart` to `lib/api/analytics.ts`. Update `app/(dashboard)/analytics/revenue/page.tsx` to also fetch chart data in the `Promise.all` call.
  - **Expected output:** Chart data is available as a prop to `RevenueOverviewScreen`.

---

### T-09.2 — `[FE]` Build the Revenue Bar Chart component

**What:** A bar chart rendered using `recharts` (already available in the project from the tech stack). Shows daily or weekly revenue bars with hover tooltips.

**Library:** `recharts` — import `{ BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid }` from `"recharts"`.

**Component file:** `features/analytics/revenue-bar-chart.tsx` (client component)

**Props:**
```typescript
interface RevenueBarChartProps {
  dataPoints: Array<{
    label: string;       // "2026-03-27" for daily, "Week of Mar 27" for weekly, "08:00" for hourly
    netRevenue: number;
    grossRevenue: number;
    discounts: number;
    invoiceCount: number;
  }>;
  aggregation: "daily" | "weekly" | "hourly";
}
```

**Chart configuration:**
- `ResponsiveContainer width="100%" height={300}` — fills the container.
- `BarChart` with `data={dataPoints}`.
- `XAxis dataKey="label"` — show date labels. For daily view with > 14 points, show every 7th label to avoid crowding (use `interval` prop or custom tick).
- `YAxis` — show ₹ values using Indian number formatting on the axis (abbreviated: "₹1.25L" for 1,25,000).
- `CartesianGrid strokeDasharray="3 3"` — subtle grid lines.
- `Bar dataKey="netRevenue"` with a project-consistent color (e.g. the primary blue from the design system).
- `Tooltip` — custom tooltip showing: date/period label, gross revenue, discounts (−), net revenue, and invoice count.

**Tooltip component:**
```typescript
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded p-3 shadow text-sm">
      <p className="font-semibold">{label}</p>
      <p>Gross: {formatIndianCurrency(d.grossRevenue)}</p>
      <p>Discounts: −{formatIndianCurrency(d.discounts)}</p>
      <p className="font-semibold">Net: {formatIndianCurrency(d.netRevenue)}</p>
      <p className="text-gray-500">{d.invoiceCount} invoices</p>
    </div>
  );
};
```

**Zero-revenue days:** Bars with `netRevenue = 0` render with height 0 (the bar appears as a thin line at the baseline). This is the default recharts behavior — no special handling needed.

**Expected output:** Chart renders. Bars represent daily/weekly/hourly net revenue. Hovering a bar shows the tooltip with gross, discounts, net, and invoice count. Responsively fills the container width.

---

- [ ] **ST-09.2.1** Create `features/analytics/revenue-bar-chart.tsx` as a client component. Import recharts components. Implement the bar chart with `ResponsiveContainer`, `BarChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Bar`.
  - **Expected output:** Chart renders with the data. Bars are visible. Chart is responsive.

- [ ] **ST-09.2.2** Implement the custom `Tooltip` component. Show gross, discounts, net revenue, and invoice count. Use `formatIndianCurrency` for all monetary values.
  - **Expected output:** Hovering a bar shows the tooltip with all four data points formatted correctly.

- [ ] **ST-09.2.3** Handle X-axis label crowding: for daily aggregation with more than 14 data points, show every 7th label. Use `<XAxis interval={interval} />` where `interval = dataPoints.length > 14 ? 6 : 0`.
  - **Expected output:** A 30-day chart shows approximately 4–5 date labels on the X-axis. A 7-day chart shows all 7 dates.

- [ ] **ST-09.2.4** Integrate `<RevenueBarChart>` into `RevenueOverviewScreen`. Pass `dataPoints` and `aggregation` from the fetched chart data props.
  - **Expected output:** Chart appears on the Revenue Overview page below the overview cards.

---

---

## US-10 — Revenue Overview Screen: Top Products, Payment Breakdown, and GST Summary

**As a shopkeeper, I want to see which products are generating the most revenue, how customers are paying, and how much GST I've collected.**

**Scope:** Frontend only.  
**Dependency:** US-03 T-03.3, T-03.4, T-03.5 (top products, payment breakdown, GST summary endpoints) must be complete.

---

### T-10.1 — `[FE]` Fetch all three data sets and build the Revenue Overview Screen

**What:** Fetch top products, payment breakdown, and GST summary data in the page server component. Pass all to `RevenueOverviewScreen`.

**Add to `lib/api/analytics.ts`:**
```typescript
export async function getTopProducts(tenantId: string, period: string, dateFrom?: string, dateTo?: string) {
  const api = createServerAxios();
  const { data } = await api.get(`/tenants/${tenantId}/analytics/top-products`, {
    params: { period, dateFrom, dateTo }
  });
  return data;
}

export async function getPaymentBreakdown(tenantId: string, period: string, dateFrom?: string, dateTo?: string) {
  const api = createServerAxios();
  const { data } = await api.get(`/tenants/${tenantId}/analytics/payment-breakdown`, {
    params: { period, dateFrom, dateTo }
  });
  return data;
}

export async function getGstSummary(tenantId: string, period: string, dateFrom?: string, dateTo?: string) {
  const api = createServerAxios();
  const { data } = await api.get(`/tenants/${tenantId}/analytics/gst-summary`, {
    params: { period, dateFrom, dateTo }
  });
  return data;
}
```

**Update the page `Promise.all`:**
```typescript
const [revenueSummary, revenueChart, topProducts, paymentBreakdown, gstSummary] = await Promise.all([
  getRevenueSummary(tenantId, period, dateFrom, dateTo),
  getRevenueChart(tenantId, period, dateFrom, dateTo),
  getTopProducts(tenantId, period, dateFrom, dateTo),
  getPaymentBreakdown(tenantId, period, dateFrom, dateTo),
  getGstSummary(tenantId, period, dateFrom, dateTo),
]);
```

**Expected output:** All five data sets fetched in one parallel request batch. Page load time is not significantly longer than fetching one endpoint.

---

- [ ] **ST-10.1.1** Add `getTopProducts`, `getPaymentBreakdown`, and `getGstSummary` to `lib/api/analytics.ts`. Update the page `Promise.all` to fetch all five data sets simultaneously.
  - **Expected output:** All five fetches run in parallel. All data is available as props.

---

### T-10.2 — `[FE]` Build the Top Products list

**What:** A ranked list of up to 10 products by net revenue with a proportional bar indicator.

**Layout for each product row:**
- Rank number (1–10) in a muted badge.
- Product name.
- Net revenue (₹ formatted, Indian system).
- Units sold (formatted with comma: "1,234 units").
- Percentage of total revenue (e.g. "17.84%").
- A thin horizontal progress bar filling from left proportional to `percentOfTotal`. Width = `percentOfTotal%` of a fixed container.

**Empty state:** If `topProducts` is empty (no sales in period), show "No sales data for this period."

**Expected output:** Top 10 products listed in rank order. Progress bars are proportional. All monetary values use Indian formatting.

---

- [ ] **ST-10.2.1** Create `features/analytics/top-products-list.tsx`. Render each product row with rank, name, net revenue, units sold, percentage, and proportional bar. Handle the empty state.
  - **Expected output:** List renders correctly. Rank 1 has the widest bar. Rank 10 has a narrower bar. Progress bars are visually proportional.

---

### T-10.3 — `[FE]` Build the Payment Method Breakdown

**What:** Three rows (Cash, Card, UPI) showing invoice counts, total amounts, and percentage of total.

**Layout:**
- Section title: "Payment Methods"
- For each method (always show all three, even if count = 0):
  - Method name and icon (Cash: 💵 or a banknote icon, Card: credit card icon, UPI: mobile icon)
  - "{N} invoices" count
  - Total amount (₹ formatted)
  - Percentage bar (proportional to `percentage` value)

**Expected output:** All three payment methods always shown. Correct counts, amounts, and percentages. Proportional bars reflect the distribution.

---

- [ ] **ST-10.3.1** Create `features/analytics/payment-breakdown.tsx`. Render all three methods with icons, counts, amounts, and percentage bars. All three always visible even when count = 0 (show "0 invoices — ₹0").
  - **Expected output:** All three methods shown. Zero-count methods show gracefully. Bars are proportional.

---

### T-10.4 — `[FE]` Build the GST Summary section

**What:** A section showing total GST collected and invoice type counts. Only shown when `hasGstData = true`.

**Layout:**
- Section title: "GST Collected"
- "₹{totalGstCollected}" — large prominent number.
- "{gstInvoiceCount} GST invoices / {nonGstInvoiceCount} non-GST invoices"
- A note at the bottom: "This is for reference only and does not constitute a GST return filing."

**Conditional rendering:** The entire section is hidden when `hasGstData = false`. Do not show an empty or zero state — just hide the section entirely.

**Expected output:** GST section is visible when `hasGstData = true`. Not rendered at all when `hasGstData = false`. Disclaimer note is always shown when the section is visible.

---

- [ ] **ST-10.4.1** Create `features/analytics/gst-summary-section.tsx`. Accept `gstSummary` as prop. Conditionally render (`if (!gstSummary.hasGstData) return null`). Show total GST, invoice type counts, and the disclaimer note.
  - **Expected output:** Section renders when `hasGstData = true`. Nothing renders when `hasGstData = false`. Disclaimer is visible.

---

### T-10.5 — `[FE]` Assemble the complete Revenue Overview Screen

**What:** Compose all components into the full `RevenueOverviewScreen` client component in the correct order.

**Component order (top to bottom):**
1. `<AnalyticsTabBar />` — Stock Insights | Revenue Overview tabs
2. `<PeriodSelector />` — time period segmented control
3. `<OverviewCards />` — four summary cards
4. `<RevenueBarChart />` — bar chart
5. `<TopProductsList />` — top 10 by revenue
6. `<PaymentBreakdown />` — Cash / Card / UPI
7. `<GstSummarySection />` — GST (conditionally rendered)

**Expected output:** All components render in the correct order. The page is fully functional with correct data. Period changes update all sections simultaneously.

---

- [ ] **ST-10.5.1** Create or update `features/analytics/revenue-overview-screen.tsx`. Compose all 7 components in the correct vertical order. Pass all required props from the server-fetched data.
  - **Expected output:** Revenue overview page shows all sections in the specified order. All data is correct. GST section appears only when applicable.

- [ ] **ST-10.5.2** Add `app/(dashboard)/analytics/revenue/loading.tsx` with skeleton placeholders for the chart and lists sections (in addition to the overview cards loading state from US-08).
  - **Expected output:** When navigating to the revenue page or changing periods, skeleton placeholders show while data loads.

---

---

## Dependency Map

```
US-01 (BE — Precomputed tables + nightly job + backfill)
  ├── US-02 (BE — Stock insights endpoints)
  │     ├── US-05 (FE — Low stock section)
  │     ├── US-06 (FE — Product health section)
  │     └── US-07 (FE — Deficit summary widget)
  └── US-03 (BE — Revenue overview endpoints)
        ├── US-08 (FE — Overview cards + period selector)
        ├── US-09 (FE — Revenue bar chart)
        └── US-10 (FE — Top products + payment + GST)

US-04 (FE — Nav item + low stock badge) — needs US-02 T-02.1 for badge, nav item can be added earlier
```

**Recommended build order:**

| Phase | Stories | Notes |
|---|---|---|
| 1 | US-01 all tasks | Foundation — blocks all BE and FE work |
| 2 | US-02, US-03 (all BE endpoints) | Can run in parallel |
| 3 | US-04 (nav item first, badge after US-02) | Nav item is independent |
| 4 | US-05, US-06, US-07 (Stock Insights FE) | All need US-02 done |
| 4 | US-08 (Revenue page + period selector) | Parallel with stock FE |
| 5 | US-09, US-10 (Revenue chart + products/payment/GST) | Need US-03 done |

---

## Definition of Done (MVP 3.5 Complete)

Before MVP 3.5 is considered complete, all of the following must be true:

### Backend
- [ ] `DailyProductSales` and `DailyRevenueSummary` tables exist with correct schema, constraints, and indexes
- [ ] Nightly job runs at 00:01 IST and produces correct rows for the previous day
- [ ] Historical backfill job computes rows for all data since MVP 1 launch
- [ ] All 8 analytics API endpoints work correctly (low-stock, product-health, deficit-summary, revenue-summary, revenue-chart, top-products, payment-breakdown, gst-summary)
- [ ] Product health category algorithm matches the PRD specification exactly (minimum checks, top/bottom 20%, tie handling, dead stock precedence)
- [ ] Revenue chart returns daily/weekly/hourly aggregation based on period length
- [ ] All endpoints are scoped to the authenticated tenant (no cross-tenant data)

### Stock Insights
- [ ] `/analytics/stock` page loads and shows low stock section
- [ ] Low stock products are sorted by quantity ascending (negative → zero → positive low)
- [ ] Clicking a low stock product navigates to the product edit page
- [ ] Product health time window selector (7/30/90 days) works and re-fetches data
- [ ] All four health categories render with correct visual treatment
- [ ] Normal products section is collapsed by default and expandable
- [ ] Correct "insufficient data" messages shown when categories cannot be computed
- [ ] Deficit summary widget shows correct counts and links to /deficits

### Revenue Overview
- [ ] `/analytics/revenue` page loads with correct data
- [ ] Analytics tab bar navigates between Stock Insights and Revenue Overview
- [ ] All 7 period options work (Today, This week, This month, Last 7/30/90 days, Custom)
- [ ] Custom date range validation works (start must be <= end)
- [ ] Period selection uses URL params (deep-linkable, survives refresh)
- [ ] Overview cards show correct values with Indian ₹ formatting
- [ ] Bar chart renders daily/weekly/hourly based on period
- [ ] Chart tooltip shows gross, discounts, net revenue, and invoice count
- [ ] Top 10 products ranked by net revenue with proportional bars
- [ ] All three payment methods shown (even if count = 0)
- [ ] GST section shown only when `hasGstData = true`
- [ ] GST disclaimer note always visible in the GST section

### Navigation
- [ ] "Analytics" nav item appears in the navigation
- [ ] Low stock badge shows count when products are below threshold
- [ ] Badge refreshes every 5 minutes
- [ ] Badge hidden when count is 0

### Regression
- [ ] All MVP 1, 2, and 3 features continue to work
- [ ] Analytics system is purely read-only — no existing data is modified

---

*End of MVP 3.5 User Story Breakdown*  
*All PRD requirements are covered. Nothing is left undefined.*
