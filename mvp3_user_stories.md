# MVP 3 — Refunds and Discounts

## User Story Breakdown with Tasks and Subtasks

**Version:** 1.0  
**Based on:** MVP 3 PRD (Single Source of Truth)  
**Depends on:** MVP 1 and MVP 2 fully deployed and stable  
**Last Updated:** 2026-04-13

---

## How to Read This Document

Each **User Story** represents a complete, shippable piece of value from the user's perspective.  
Each **Task** is a discrete unit of work — labelled `[BE]` (backend) or `[FE]` (frontend).  
Each **Subtask** is a specific, actionable implementation step with instructions, expected output, and acceptance criteria.  
Complete tasks in the order listed within each story. Stories can be worked in parallel where noted.

**IndexedDB rule:** All client-side persistence uses the Zustand + persist middleware + `indexedDBStorage` adapter pattern established in MVP 1 and extended in MVP 2. No direct IndexedDB calls anywhere. No new storage adapters. The existing `lib/indexedDbStorage.ts` is used unchanged.

---

## Story Map Overview

| #     | User Story                                                                            | Type    | Priority  |
| ----- | ------------------------------------------------------------------------------------- | ------- | --------- |
| US-01 | Database Schema — Refund and Discount fields                                          | BE      | Must have |
| US-02 | Refund API — Create refund endpoint                                                   | BE      | Must have |
| US-03 | Discount Calculation Engine — Canonical formula as shared utility                     | BE + FE | Must have |
| US-04 | Invoice Creation API — Accept and process discount fields                             | BE      | Must have |
| US-05 | Zustand Store — Draft discount state and types                                        | FE      | Must have |
| US-06 | Billing Screen — Item-level discount UI                                               | FE      | Must have |
| US-07 | Billing Screen — Bill-level discount UI and updated summary                           | FE      | Must have |
| US-08 | Invoice History — Refund badge, negative totals, type filter                          | FE      | Must have |
| US-09 | Invoice Detail (SALE) — Refund button, eligibility, discount display, Returns section | FE      | Must have |
| US-10 | Refund Selection Screen — UI, validation, and submission                              | FE      | Must have |
| US-11 | Refund Invoice Detail — New screen for REFUND type invoices                           | FE      | Must have |

---

---

## US-01 — Database Schema: Refund and Discount Fields

**As a developer, I need the Invoice schema to support refund metadata and discount fields so the system can record the complete financial picture of every transaction.**

**Scope:** Backend only.  
**Dependency:** Must be complete before US-02 and US-04.

---

### T-01.1 — `[BE]` Add refund fields to the Invoice schema

**What:** Add three new fields to the existing `Invoice` model that enable refund tracking and linkage between refund invoices and their originals.

**How:**  
Open the Invoice model file and add the following fields:

| Field             | Type                          | Constraints             | Default |
| ----------------- | ----------------------------- | ----------------------- | ------- |
| invoiceType       | enum: `SALE`, `REFUND`        | Required                | `SALE`  |
| originalInvoiceId | UUID / ObjectId ref → Invoice | Optional, nullable      | `null`  |
| refundReason      | string                        | Optional, max 500 chars | `null`  |

**Rules:**

- `invoiceType` must default to `SALE` so no existing code breaks.
- `originalInvoiceId` is a self-referential foreign key: a REFUND invoice points back to the SALE invoice it refunds. It must be `null` for all SALE invoices.
- `refundReason` is free text, stored as-is, no transformation needed.

**Migration:**  
Write a migration that sets `invoiceType = SALE` and `originalInvoiceId = null` on all existing invoice records. This is a safe non-destructive migration.

**Expected output:** Invoice model has the three new fields. Migration runs without errors. All existing invoices show `invoiceType = SALE`. Querying by `invoiceType` works. Querying all REFUND invoices that reference a specific SALE invoice (via `originalInvoiceId`) works.

---

- [x] **ST-01.1.1** Add `invoiceType` enum field to the Invoice schema with values `SALE` and `REFUND`. Default value is `SALE`. This field is required on every invoice.
  - **Expected output:** Existing invoices have `invoiceType = SALE` after migration. Creating a new invoice without specifying `invoiceType` defaults to `SALE`.

- [x] **ST-01.1.2** Add `originalInvoiceId` field as a nullable self-reference (FK → Invoice or same collection reference). This field must only be set on REFUND invoices.
  - **Expected output:** A REFUND invoice can be queried to find its original SALE invoice. A SALE invoice has `originalInvoiceId = null`.

- [x] **ST-01.1.3** Add `refundReason` as an optional string field, max 500 characters. No validation beyond max length.
  - **Expected output:** Field is stored and retrieved correctly. Empty string and null are both valid.

- [x] **ST-01.1.4** Write and run the migration. Verify by querying 5 existing invoices — all should have `invoiceType = SALE`, `originalInvoiceId = null`, `refundReason = null`.
  - **Expected output:** Migration runs without errors. All pre-existing invoices have correct defaults.

- [x] **ST-01.1.5** Add a database index on `originalInvoiceId` for efficient lookup of "all refunds for a given invoice". This query runs every time the invoice detail screen loads for a SALE invoice.
  - **Expected output:** Index exists. Query `{ originalInvoiceId: someInvoiceId }` is fast even with thousands of records.

---

### T-01.2 — `[BE]` Add discount fields to the Invoice schema

**What:** Add discount-related fields to both the Invoice root and to each item within the `Invoice.items` array. These fields capture the discount that was applied at the time of sale — they are immutable snapshots.

**How:**

**Changes to Invoice root:**

| Field              | Type                               | Default |
| ------------------ | ---------------------------------- | ------- |
| billDiscountType   | enum: `NONE`, `PERCENTAGE`, `FLAT` | `NONE`  |
| billDiscountValue  | decimal                            | `0`     |
| billDiscountAmount | decimal                            | `0`     |

**Changes to each item object inside `Invoice.items` array:**

| Field              | Type                               | Default |
| ------------------ | ---------------------------------- | ------- |
| itemDiscountType   | enum: `NONE`, `PERCENTAGE`, `FLAT` | `NONE`  |
| itemDiscountValue  | decimal                            | `0`     |
| itemDiscountAmount | decimal                            | `0`     |

**Migration:**  
For all existing invoices: set all three bill discount fields to their defaults. For each item in each invoice's `items` array: add the three item discount fields with default values. This is a non-destructive migration.

**Note on items array structure:** The `items` field is a JSON array (or embedded array). The migration must iterate through every invoice and update every element in the items array to include the new fields. Test with a document that has 3 items — all 3 must receive the new fields.

**Expected output:** Every invoice (old and new) has discount fields. Old invoices all show `NONE` discounts. New invoices can carry non-zero discount values.

---

- [x] **ST-01.2.1** Add `billDiscountType`, `billDiscountValue`, `billDiscountAmount` to the Invoice root schema. Defaults: `NONE`, `0`, `0`.
  - **Expected output:** These three fields appear on every invoice document.

- [x] **ST-01.2.2** Update the Invoice items array schema to include `itemDiscountType`, `itemDiscountValue`, `itemDiscountAmount` on each item element. Defaults: `NONE`, `0`, `0`.
  - **Expected output:** Every item inside `invoice.items` has the three discount fields.

- [x] **ST-01.2.3** Write and run the migration that updates all existing invoices. Verify: pick 3 old invoices, confirm their discount fields are set to defaults and their items arrays all have the new fields.
  - **Expected output:** Migration runs without errors. Zero items are missing discount fields after migration.

---

### T-01.3 — `[BE]` Add discount fields to the Draft schema

**What:** The Draft model (created in MVP 2) must also store discount state so that in-progress bills preserve their discounts when the page refreshes or the user switches devices.

**How:**  
Add these fields to the Draft model:

**Root-level fields:**
| Field | Type | Default |
|---|---|---|
| billDiscountType | enum: `NONE`, `PERCENTAGE`, `FLAT` | `NONE` |
| billDiscountValue | decimal | `0` |

**Per-item fields** (inside each element of the `items` array):
| Field | Type | Default |
|---|---|---|
| itemDiscountType | enum: `NONE`, `PERCENTAGE`, `FLAT` | `NONE` |
| itemDiscountValue | decimal | `0` |

**Note:** Draft does NOT store `itemDiscountAmount` or `billDiscountAmount` — those are computed values. Only the inputs (`type` and `value`) are stored. The amounts are always recomputed from the formula, never stored in the draft.

**Migration:** Set all new draft fields to their defaults on all existing draft records.

**Expected output:** Draft model has discount input fields. Existing drafts are unaffected functionally (all default to no discount).

---

- [x] **ST-01.3.1** Add `billDiscountType` and `billDiscountValue` to the Draft root schema. Add `itemDiscountType` and `itemDiscountValue` to each item element within the Draft's `items` array. Write and run the migration.
  - **Expected output:** All existing draft records have the new fields at their defaults. The Draft sync endpoint (`POST /drafts/sync`) still works without breaking.

---

---

## US-02 — Refund API: Create Refund Endpoint

**As a shopkeeper, I need the backend to process a refund correctly — validating the quantities, restoring stock, creating a linked negative invoice, and protecting against duplicate submissions.**

**Scope:** Backend only.  
**Dependency:** US-01 must be complete.

---

### T-02.1 — `[BE]` Create the refund invoice endpoint

**What:** `POST /tenants/:tenantId/invoices/:invoiceId/refund` — accepts a list of items to refund and their quantities, validates everything, and creates a REFUND invoice atomically.

**Request shape:**

```json
{
  "clientGeneratedId": "uuid-v4",
  "refundReason": "Customer changed mind",
  "items": [
    { "productId": "uuid", "quantity": 2 },
    { "productId": "uuid2", "quantity": 1 }
  ]
}
```

Only items with quantity > 0 should be included in the request. Items not included are assumed to have 0 return quantity.

**Server validation steps (in this exact order):**

1. **Idempotency check:** Does an invoice with this `clientGeneratedId` already exist for this tenant? If yes: return the existing refund invoice with 200 OK. Stop all further processing.
2. **Auth:** Is the request from the authenticated tenant? Reject with 401 if not.
3. **Original invoice validity:** Does the invoice at `:invoiceId` exist, belong to this tenant, have `invoiceType = SALE`, and NOT be soft-deleted? If any condition fails: return 400 with a descriptive error.
4. **Sync status check:** Does the original invoice have an `invoiceNumber` (i.e. it is server-confirmed, not pending sync)? If not: return 409 with message "This invoice has not finished syncing."
5. **Per-item quantity validation:** For each item in the request:
   - Verify the `productId` exists in the original invoice's items array.
   - Compute `previouslyRefundedQty` = SUM of quantity for this productId across all existing REFUND invoices where `originalInvoiceId = this invoice`.
   - Compute `maxReturnableQty = originalQty - previouslyRefundedQty`.
   - If `requestedReturnQty > maxReturnableQty`: collect this violation.
   - If any violations exist after checking all items: return 400 with the list of violations including `productId`, `productName`, `maxReturnableQty`, `requestedQty`.
6. **At least one item check:** If the request has zero items or all quantities are 0: return 400.

**Atomic commit (all steps in one database transaction):**

1. For each item in the refund:
   - Read the current `StockRecord.quantity` for (productId, outletId).
   - `newStock = currentStock + returnQuantity`.
   - Update `StockRecord.quantity = newStock`.
   - Write `StockAuditLog` entry: `previousQty = currentStock`, `newQty = newStock`, `changeType = REFUND`, `referenceId = (new refund invoice ID — use a pre-generated ID)`.
2. Lock and increment `DailyInvoiceCounter` for (outletId, today's date in IST). Generate invoice number using the same format as SALE invoices: `{businessAbbr}-{outletAbbr}-{YYYYMMDD}-{NNNNN}`. Refund invoices use the same counter and format — no special prefix.
3. Build the refund invoice item list. For each refunded item, copy the following fields verbatim from the **original invoice's items array** (not from the current product record):
   - `productName` (snapshotted name)
   - `unitPrice` (snapshotted price — this is the discounted unit price if the original item had a discount: `discountedUnitSubtotal / originalQuantity`)
   - `gstRate` (snapshotted rate)
   - `gstAmount = -(unitPrice × returnQuantity × (gstRate / 100))`
   - `lineTotal = -(unitPrice × returnQuantity + Math.abs(gstAmount))`
4. Compute refund invoice totals (all negative):
   - `subtotal = SUM(-(unitPrice × returnQuantity))` for all items
   - `totalGstAmount = SUM(gstAmount)` for all items (negative)
   - `grandTotal = subtotal + totalGstAmount`
5. Create the refund Invoice record:
   - `invoiceType = REFUND`
   - `originalInvoiceId = the original invoice's ID`
   - `tenantId`, `outletId` = same as original
   - `paymentMethod` = same as original
   - `isGstInvoice` = same as original
   - `customerName`, `customerPhone` = same as original
   - `refundReason` = from request
   - `invoiceNumber` = the newly generated number
   - `clientGeneratedId` = from request
   - `billDiscountType = NONE`, `billDiscountValue = 0`, `billDiscountAmount = 0` (refunds do not carry discount fields)
6. Commit transaction.

**Response 201:** Return the full refund invoice object.  
**Response 200:** If idempotency matched — return existing refund invoice.  
**Response 400:** Validation error with specific details.  
**Response 401:** Not authenticated.  
**Response 409:** Original invoice is sync-pending.

**Discounted unit price calculation for refund:**  
The refund must use the price the customer actually paid per unit — not the pre-discount price. From the original invoice's item:

```
discountedUnitSubtotal = (originalItem.unitPrice × originalItem.quantity) - originalItem.itemDiscountAmount
effectiveUnitPrice = discountedUnitSubtotal / originalItem.quantity
```

This `effectiveUnitPrice` is what gets used as `unitPrice` in each refund item.

**Expected output:** Endpoint exists. Calling it once creates a REFUND invoice and increases stock. Calling it again with the same `clientGeneratedId` returns the existing refund invoice without creating a duplicate or modifying stock again.

---

- [ ] **ST-02.1.1** Create the route: `POST /tenants/:tenantId/invoices/:invoiceId/refund`. Wire authentication middleware. Wire tenant ownership check (the invoice must belong to `:tenantId`).
  - **Expected output:** Route exists. Returns 401 without a valid JWT. Returns 400 if the invoice belongs to a different tenant.

- [ ] **ST-02.1.2** Implement the idempotency check: query for an existing invoice with `clientGeneratedId = request.clientGeneratedId AND tenantId = authTenantId`. If found, return it as 200 OK.
  - **Expected output:** Sending the same request twice returns the same invoice both times. The second call makes zero database writes.

- [ ] **ST-02.1.3** Implement original invoice validity checks (steps 3 and 4 from the validation list above): verify it exists, belongs to the tenant, is `invoiceType = SALE`, is not soft-deleted, and has an `invoiceNumber`.
  - **Expected output:** Attempting to refund a REFUND invoice returns 400. Attempting to refund a sync-pending invoice returns 409.

- [ ] **ST-02.1.4** Implement the per-item quantity validation (step 5): for each requested item, look up the original invoice item, compute `previouslyRefundedQty` by summing all existing REFUND invoices for this original, compute `maxReturnableQty`, and collect violations. Return 400 with the full violation list if any exist.
  - **Expected output:** Requesting a refund of 10 units when only 5 were sold and 3 already refunded (max = 2) returns 400 with `maxReturnableQty: 2`. All violations are returned at once, not just the first.

- [ ] **ST-02.1.5** Implement the `effectiveUnitPrice` calculation. For each item being refunded, compute the discounted unit price from the original invoice item's stored fields: `(originalItem.unitPrice × originalItem.quantity - originalItem.itemDiscountAmount) / originalItem.quantity`.
  - **Expected output:** A refund for an item that had a ₹30 flat discount on 3 units at ₹100 (discounted subtotal = ₹270) uses `effectiveUnitPrice = ₹90`, not ₹100.

- [ ] **ST-02.1.6** Implement the atomic commit: wrap all writes (stock updates, stock audit log, invoice counter increment, refund invoice creation) in a single database transaction. If any step fails, roll back all changes.
  - **Expected output:** Simulating a failure midway (e.g. by temporarily breaking the invoice counter) results in no stock change and no partial invoice creation.

- [ ] **ST-02.1.7** Return the full refund invoice object on success (201). All fields must be present including the computed negative totals.
  - **Expected output:** Response body contains `invoiceType: "REFUND"`, `originalInvoiceId`, negative `grandTotal`, negative `subtotal`, and all item fields.

---

### T-02.2 — `[BE]` Add refund summary to the invoice GET endpoint

**What:** The `GET /tenants/:tenantId/invoices/:invoiceId` endpoint must be updated to include a `refunds` array in its response when the invoice is a SALE type. This array lists all REFUND invoices linked to this SALE invoice.

**How:**  
After fetching the invoice, if `invoice.invoiceType === SALE`:

- Query all invoices where `originalInvoiceId = invoice.id`.
- Map each to a summary object: `{ id, invoiceNumber, grandTotal, createdAt, itemCount }`.
- Include as `refunds: [...]` in the response. Empty array if none.

If `invoice.invoiceType === REFUND`:

- Include `originalInvoice: { id, invoiceNumber, createdAt }` in the response (a summary of the SALE invoice it refers to). This lets the frontend show the "Refund for: [ORIGINAL-001]" link.

**Expected output:** GET /invoices/:id for a SALE invoice includes a `refunds` array. GET /invoices/:id for a REFUND invoice includes an `originalInvoice` summary object.

---

- [ ] **ST-02.2.1** Modify the `GET /tenants/:tenantId/invoices/:invoiceId` handler. After fetching the invoice, if it is a SALE: query all linked REFUND invoices, map to summaries, attach as `refunds`. If it is a REFUND: fetch the original invoice summary and attach as `originalInvoice`.
  - **Expected output:** SALE invoice response includes `refunds: []` when no refunds exist, or `refunds: [{...}]` when refunds exist. REFUND invoice response includes `originalInvoice: { id, invoiceNumber, createdAt }`.

---

### T-02.3 — `[BE]` Update the invoices list endpoint to support type filter

**What:** The `GET /tenants/:tenantId/invoices` list endpoint must support a new `invoiceType` query parameter that filters by `SALE`, `REFUND`, or returns all if not specified.

**How:**  
Add an optional `invoiceType` query parameter. If present and value is `SALE` or `REFUND`, add it to the database query filter. If absent or `ALL`, do not filter by type.

**Expected output:** `GET /invoices?invoiceType=REFUND` returns only REFUND invoices. `GET /invoices?invoiceType=SALE` returns only SALE invoices. `GET /invoices` (no param) returns all invoice types.

---

- [ ] **ST-02.3.1** Add optional `invoiceType` query parameter handling to the invoices list endpoint. Values: `SALE`, `REFUND`, or absent/`ALL`. Apply to the database query.
  - **Expected output:** Type filter works correctly. Existing calls without the parameter are unaffected.

---

---

## US-03 — Discount Calculation Engine: Canonical Formula as Shared Utility

**As a developer, I need the discount calculation formula to be implemented once and used identically on both the server (for authoritative invoice storage) and the client (for real-time cart preview), so there are never discrepancies between what the user sees and what the invoice stores.**

**Scope:** Backend AND Frontend — this utility is written twice (once in each codebase) using the same algorithm.  
**Dependency:** None. Can be built and tested in parallel with other stories.

---

### T-03.1 — `[BE]` Implement discount calculation utility on the server

**What:** A pure function that takes cart items with discount inputs and bill discount inputs, and returns all computed amounts. This is the authoritative implementation — the server's output is what gets stored on the invoice.

**Where to create:** `utils/discount-calculator.ts` (or equivalent location in the backend utils folder)

**The canonical formula (implement exactly as written):**

```typescript
interface ItemInput {
  unitPrice: number;
  quantity: number;
  gstRate: number; // 0, 5, 12, 18, or 28
  itemDiscountType: 'NONE' | 'PERCENTAGE' | 'FLAT';
  itemDiscountValue: number;
}

interface ItemResult {
  baseLineTotal: number; // unitPrice × quantity
  itemDiscountAmount: number; // computed discount in ₹ (clamped)
  discountedSubtotal: number; // baseLineTotal - itemDiscountAmount
  gstAmount: number; // discountedSubtotal × (gstRate / 100)
  lineTotal: number; // discountedSubtotal + gstAmount
}

interface BillResult {
  items: ItemResult[];
  subtotal: number; // SUM(discountedSubtotal)
  totalGstAmount: number; // SUM(gstAmount)
  preDiscountGrandTotal: number; // subtotal + totalGstAmount
  billDiscountAmount: number; // computed bill discount in ₹ (clamped)
  grandTotal: number; // preDiscountGrandTotal - billDiscountAmount
}

function calculateDiscounts(
  items: ItemInput[],
  billDiscountType: 'NONE' | 'PERCENTAGE' | 'FLAT',
  billDiscountValue: number,
  gstEnabled: boolean,
): BillResult;
```

**Step-by-step implementation:**

```
For each item:
  1. baseLineTotal = unitPrice × quantity
  2. itemDiscountAmount:
     - if PERCENTAGE: baseLineTotal × (itemDiscountValue / 100)
     - if FLAT: itemDiscountValue
     - if NONE: 0
  3. Clamp: itemDiscountAmount = Math.min(itemDiscountAmount, baseLineTotal)
  4. discountedSubtotal = baseLineTotal - itemDiscountAmount
  5. gstAmount = gstEnabled ? (discountedSubtotal × (gstRate / 100)) : 0
  6. lineTotal = discountedSubtotal + gstAmount

After all items:
  7. subtotal = SUM(discountedSubtotal for all items)
  8. totalGstAmount = SUM(gstAmount for all items)
  9. preDiscountGrandTotal = subtotal + totalGstAmount
  10. billDiscountAmount:
      - if PERCENTAGE: preDiscountGrandTotal × (billDiscountValue / 100)
      - if FLAT: billDiscountValue
      - if NONE: 0
  11. Clamp: billDiscountAmount = Math.min(billDiscountAmount, preDiscountGrandTotal)
  12. grandTotal = preDiscountGrandTotal - billDiscountAmount

All monetary values: round to 2 decimal places at each computation step.
Use Math.round(value × 100) / 100 to avoid floating point drift.
```

**Expected output:** Pure function with no side effects. Takes inputs, returns computed amounts. Can be unit tested in isolation.

---

- [ ] **ST-03.1.1** Create the discount calculator utility file. Define all input/output TypeScript interfaces. Implement the `calculateDiscounts` function following the formula exactly as specified above. Every monetary value must be rounded to 2 decimal places at each step (not just at the end).
  - **Expected output:** Function exists and is importable. Calling it with known inputs produces exactly correct outputs (verified in unit tests).

- [ ] **ST-03.1.2** Write unit tests for the calculator covering these specific cases:
  - No discounts: `NONE` on all → output equals plain price × quantity
  - PERCENTAGE item discount: 10% off ₹100 item × 3 = ₹30 discount, ₹270 discounted subtotal
  - FLAT item discount: ₹30 off ₹300 item total = ₹270 discounted subtotal
  - FLAT item discount clamped: ₹500 flat discount on a ₹200 item → discount = ₹200, discounted subtotal = ₹0
  - PERCENTAGE bill discount: 10% off ₹500 preDiscountGrandTotal = ₹50 bill discount, ₹450 grandTotal
  - FLAT bill discount clamped: ₹1000 flat on ₹500 total → discount = ₹500, grandTotal = ₹0
  - GST enabled: 18% GST on ₹270 discounted subtotal = ₹48.60 gstAmount
  - GST disabled: all gstAmounts = 0
  - 100% percentage discount on an item: itemDiscountAmount = baseLineTotal, discountedSubtotal = 0
  - **Expected output:** All 9 test cases pass. Zero tolerance for rounding differences.

---

### T-03.2 — `[FE]` Implement the same discount calculation utility on the client

**What:** An identical pure function in the frontend codebase for real-time cart total preview. The client uses this to update the bill summary as the user changes discount values. The server is still authoritative — if there is a rounding discrepancy, the server's values are shown on the final invoice.

**Where to create:** `lib/utils/discount-calculator.ts`

**How:**  
Implement the exact same function as T-03.1. Copy the algorithm exactly. Use the same rounding approach. Define the same TypeScript interfaces (or import from `types/` if shared types are feasible in the project structure).

**Expected output:** `lib/utils/discount-calculator.ts` exports `calculateDiscounts`. The client-side calculations match the server-side calculations for the same inputs.

---

- [ ] **ST-03.2.1** Create `lib/utils/discount-calculator.ts`. Implement the same `calculateDiscounts` function. Use the same rounding approach as the backend. Export the function and all interfaces.
  - **Expected output:** Calling `calculateDiscounts` on the client with the same inputs as the server produces the same output. Function is unit-testable.

- [ ] **ST-03.2.2** Write at least 3 unit tests for the frontend calculator using Jest:
  - A simple case with no discount
  - An item-level percentage discount with GST enabled
  - A bill-level flat discount that gets clamped
  - **Expected output:** All 3 tests pass. Numbers match server-side results exactly.

---

---

## US-04 — Invoice Creation API: Accept and Process Discount Fields

**As a developer, I need the existing invoice creation endpoint to accept discount inputs and store server-computed discount amounts on the invoice, so the invoice record always reflects what the customer actually paid.**

**Scope:** Backend only.  
**Dependency:** US-01 (schema) and US-03 (calculator) must be complete.

---

### T-04.1 — `[BE]` Update invoice creation endpoint to accept discount fields

**What:** Modify `POST /tenants/:tenantId/invoices` to accept discount fields in the request body and compute/store all discount amounts using the server-side discount calculator.

**New fields in the request body:**

```json
{
  "clientGeneratedId": "uuid",
  "outletId": "uuid",
  "paymentMethod": "CASH",
  "customerName": null,
  "customerPhone": null,
  "gstEnabled": true,
  "billDiscountType": "PERCENTAGE",
  "billDiscountValue": 10,
  "items": [
    {
      "productId": "uuid",
      "quantity": 3,
      "override": false,
      "itemDiscountType": "FLAT",
      "itemDiscountValue": 20
    }
  ]
}
```

All new discount fields are optional. If absent, they default to `NONE` / `0`. Existing clients that do not send discount fields continue to work without modification.

**Server processing changes:**

After passing all existing stock validation checks (same as MVP 1), before the atomic commit:

1. Call `calculateDiscounts(items, billDiscountType, billDiscountValue, gstEnabled)` using the server-side utility.
2. Use the returned `ItemResult[]` and `BillResult` to populate the invoice fields.
3. Store `itemDiscountType`, `itemDiscountValue`, `itemDiscountAmount` on each invoice item.
4. Store `billDiscountType`, `billDiscountValue`, `billDiscountAmount` on the invoice root.
5. Use the calculated `subtotal`, `totalGstAmount`, `grandTotal` from the calculator — NOT values sent by the client. The client's computed values are advisory only.

**Important:** The invoice response must include all discount fields so the client can display server-computed values (which may differ slightly from client-computed values due to rounding).

**Expected output:** Sending an invoice creation request with discount fields creates an invoice with correct server-computed discount amounts. Sending without discount fields creates an invoice with `NONE` discounts and correct totals (backward compatible).

---

- [ ] **ST-04.1.1** Update the invoice creation request validation to accept the new optional discount fields: `billDiscountType`, `billDiscountValue` at root level, and `itemDiscountType`, `itemDiscountValue` per item. All fields are optional with defaults.
  - **Expected output:** Existing tests for invoice creation still pass. New requests with discount fields are accepted without validation errors.

- [ ] **ST-04.1.2** Import and call `calculateDiscounts` inside the invoice creation handler, after stock validation and before the atomic commit. Pass the items array with their discount inputs and the bill discount inputs.
  - **Expected output:** Calculator is called with correct inputs on every invoice creation request.

- [ ] **ST-04.1.3** Use the calculator's output to populate all invoice fields: item-level discount amounts, bill discount amount, subtotal, totalGstAmount, grandTotal. These overwrite anything the client sent for these computed fields.
  - **Expected output:** The stored invoice has server-computed amounts. If the client sent `grandTotal: 300` but the server computed `grandTotal: 295.50`, the stored value is `295.50`.

- [ ] **ST-04.1.4** Ensure the invoice creation response includes all new discount fields so the client can reconcile any rounding differences.
  - **Expected output:** Response body includes `billDiscountType`, `billDiscountValue`, `billDiscountAmount`, and per-item discount fields.

---

---

## US-05 — Zustand Store: Draft Discount State and Types

**As a developer, I need the billing Zustand store to track discount inputs for each item and for the whole bill so that discount state is preserved across page refreshes and tab switches.**

**Scope:** Frontend only.  
**Dependency:** US-01 T-01.3 (Draft schema discount fields) must be complete.

---

### T-05.1 — `[FE]` Update TypeScript types for discounts

**What:** Add discount-related types and update the `DraftItem` and `LocalDraft` types to include discount fields.

**Where:** `types/draft.ts`

**Changes:**

```typescript
// Add new types
export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FLAT';

// Update DraftItem interface — add these fields:
export interface DraftItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate: 0 | 5 | 12 | 18 | 28;
  itemDiscountType: DiscountType; // NEW — default: 'NONE'
  itemDiscountValue: number; // NEW — default: 0
}

// Update LocalDraft interface — add these fields:
export interface LocalDraft {
  // ...all existing fields...
  billDiscountType: DiscountType; // NEW — default: 'NONE'
  billDiscountValue: number; // NEW — default: 0
}
```

**Migration of existing draft items in the store:**  
Any `DraftItem` objects already in the Zustand store (persisted from MVP 1/2) will not have `itemDiscountType` or `itemDiscountValue`. When reading these items, treat missing fields as `'NONE'` and `0`. This is handled by providing defaults wherever `DraftItem` objects are consumed.

**Expected output:** All TypeScript files that use `DraftItem` or `LocalDraft` compile without errors after this update.

---

- [ ] **ST-05.1.1** Add `DiscountType` to `types/draft.ts`. Update `DraftItem` to include `itemDiscountType: DiscountType` and `itemDiscountValue: number`. Update `LocalDraft` to include `billDiscountType: DiscountType` and `billDiscountValue: number`.
  - **Expected output:** `tsc --noEmit` passes with zero type errors.

- [ ] **ST-05.1.2** In `store/billing-tabs-store.ts`, update the `makeEmptyDraft` function to include `billDiscountType: 'NONE'` and `billDiscountValue: 0` as defaults on new drafts.
  - **Expected output:** Every newly created tab has discount fields initialized to their zero-discount defaults.

- [ ] **ST-05.1.3** In `store/billing-tabs-store.ts`, update the `makeEmptyDraft` or any place that creates `DraftItem` objects to include `itemDiscountType: 'NONE'` and `itemDiscountValue: 0` as defaults on new items.
  - **Expected output:** Adding a product to the cart creates a `DraftItem` with discount fields set to defaults.

---

### T-05.2 — `[FE]` Add discount actions to the Zustand store

**What:** Add new actions to `useBillingTabsStore` that allow updating item-level and bill-level discounts on the active draft.

**How:**  
Add the following actions to the store. Each action:

1. Validates inputs (clamp values, handle edge cases).
2. Updates the appropriate draft in the `drafts` array.
3. Sets `syncStatus = 'PENDING_SYNC'` and updates `localUpdatedAt`.
4. The persist middleware automatically saves to IndexedDB.

**New actions to add:**

```typescript
// Set or clear item-level discount
setItemDiscount: (
  clientDraftId: string,
  productId: string,
  discountType: DiscountType,
  discountValue: number
) => void;

// Clear item-level discount (set back to NONE/0)
clearItemDiscount: (clientDraftId: string, productId: string) => void;

// Set or clear bill-level discount
setBillDiscount: (
  clientDraftId: string,
  discountType: DiscountType,
  discountValue: number
) => void;

// Clear bill-level discount
clearBillDiscount: (clientDraftId: string) => void;
```

**Implementation of `setItemDiscount`:**

```typescript
setItemDiscount: (clientDraftId, productId, discountType, discountValue) =>
  set((state) => ({
    drafts: state.drafts.map((d) =>
      d.clientDraftId !== clientDraftId ? d : {
        ...d,
        items: d.items.map((item) =>
          item.productId !== productId ? item : {
            ...item,
            itemDiscountType: discountType,
            itemDiscountValue: Math.max(0, discountValue), // never negative
          }
        ),
        localUpdatedAt: new Date().toISOString(),
        syncStatus: 'PENDING_SYNC',
      }
    ),
  })),
```

**Implementation of `setBillDiscount`:**

```typescript
setBillDiscount: (clientDraftId, discountType, discountValue) =>
  set((state) => ({
    drafts: state.drafts.map((d) =>
      d.clientDraftId !== clientDraftId ? d : {
        ...d,
        billDiscountType: discountType,
        billDiscountValue: Math.max(0, discountValue),
        localUpdatedAt: new Date().toISOString(),
        syncStatus: 'PENDING_SYNC',
      }
    ),
  })),
```

Also update `clearAndResetTab` so that discount fields are reset to defaults when a tab is cleared after finalization.

**Expected output:** All four new actions exist in the store. Calling `setItemDiscount` updates the correct item in the correct draft without affecting any other draft or item. Changes persist to IndexedDB automatically.

---

- [ ] **ST-05.2.1** Add `setItemDiscount`, `clearItemDiscount`, `setBillDiscount`, `clearBillDiscount` to `useBillingTabsStore`. Follow the implementation pattern shown above. Add them to the `BillingTabsState` type in `types/draft.ts`.
  - **Expected output:** All four actions are importable and callable. TypeScript shows no errors.

- [ ] **ST-05.2.2** Update `clearAndResetTab` to also reset `billDiscountType = 'NONE'` and `billDiscountValue = 0` on the new empty draft, and reset all items' discount fields to defaults.
  - **Expected output:** After invoice finalization, the cleared tab has no discounts.

- [ ] **ST-05.2.3** Update the `updateDraftItems` action (used when adding/removing products) to ensure that when new items are added, they have `itemDiscountType: 'NONE'` and `itemDiscountValue: 0` as defaults. Existing items' discount values must NOT be reset when `updateDraftItems` is called.
  - **Expected output:** Adding a new product to a tab that already has a discounted item does not reset that item's discount.

---

### T-05.3 — `[FE]` Update draft sync payload to include discount fields

**What:** The draft sync request sent to `POST /drafts/sync` must now include the discount fields so they are persisted on the server draft as well.

**Where:** The sync payload builder in `hooks/use-draft-sync.ts` (or wherever the sync payload is assembled).

**How:**  
Include `billDiscountType`, `billDiscountValue` from the draft root and `itemDiscountType`, `itemDiscountValue` from each item in the sync payload.

**Expected output:** The `/drafts/sync` network request includes discount fields. After syncing, the server draft stores the current discount state. On login from a new device, discount state is restored.

---

- [ ] **ST-05.3.1** Update the sync payload assembly to include `billDiscountType`, `billDiscountValue` at the draft root and `itemDiscountType`, `itemDiscountValue` within each item. Verify by checking the Network tab in DevTools after adding a discount.
  - **Expected output:** `POST /drafts/sync` request body includes discount fields.

---

---

## US-06 — Billing Screen: Item-Level Discount UI

**As a shopkeeper, I want to apply a discount to a specific item in the cart — either as a percentage or a fixed rupee amount — and see the discounted price update in real-time before I finalize the bill.**

**Scope:** Frontend only.  
**Dependency:** US-03 T-03.2 (client calculator) and US-05 (store discount actions) must be complete.

---

### T-06.1 — `[FE]` Add item discount toggle to each cart item row

**What:** Each cart item row in the billing screen has a "Discount" icon/button that, when clicked, expands an inline discount input section below the item row. Collapsed by default.

**How:**  
Modify the existing cart item component (e.g. `features/billing/billing-cart-item.tsx` or equivalent).

**Collapsed state:**

- Show a small "%" or tag icon/button labeled "Discount" to the right of the item row (or as a small action below the item name).
- If a discount is already active on this item, the button shows the active discount instead (e.g. "−10%" or "−₹20") and is visually highlighted to indicate an active state.

**Expanded state:**

- Below the item row, show a discount input section.
- Two options (radio buttons or a segmented control): "%" and "₹".
- A numeric input field for the discount value.
- A "Remove discount" text link that clears the discount and collapses the section.
- The item's line total updates in real-time as the user types.

**State management:**  
Track `expandedDiscountItemId: string | null` in local component state (not in Zustand — this is pure UI toggle state, not business state). Only one item can have its discount section open at a time.

**Expected output:** `BillingCartItem` component has a discount toggle. Clicking it opens the discount input section. Opening one item's discount section closes any other open section. The toggle remembers the active discount type selection (% or ₹) while the section is open.

---

- [ ] **ST-06.1.1** Add a local `expandedDiscountItemId` state to the cart component or the parent that renders the list of `BillingCartItem`. Only one item can be expanded at a time. Clicking an item's discount button toggles its expansion state and collapses any other expanded item.
  - **Expected output:** Clicking "Discount" on Item A opens the discount section for Item A. Clicking "Discount" on Item B closes Item A's section and opens Item B's.

- [ ] **ST-06.1.2** Implement the expanded discount UI: a segmented control or radio group for "%" vs "₹", a numeric input, and a "Remove discount" link. Place these below the item row, above the next item.
  - **Expected output:** Discount section renders correctly. Selecting "%" vs "₹" switches the input mode. Input accepts decimal numbers.

- [ ] **ST-06.1.3** Show an active discount indicator on the item row when a discount is applied (i.e., `itemDiscountType !== 'NONE'`). Show the discount amount inline (e.g., "−₹20" or "−10%") next to the item price. Use a distinct color (e.g., green or amber) to draw attention.
  - **Expected output:** An item with an active discount shows the discount inline on the collapsed item row. An item with no discount shows nothing extra.

---

### T-06.2 — `[FE]` Implement real-time item discount calculation and validation

**What:** As the user types a discount value or changes the discount type, the item's line total updates in real-time. Validation rules prevent invalid values and show appropriate messages.

**How:**  
When the user changes `discountType` or `discountValue` in the item's discount section:

1. Call `setItemDiscount(clientDraftId, productId, type, value)` on the Zustand store.
2. The cart re-renders because the store state changed.
3. Use `calculateDiscounts()` from `lib/utils/discount-calculator.ts` to recompute the entire cart and update the bill summary.

**Clamping behavior (applied in the UI, before calling the store action):**

- If `discountType = FLAT` and entered value > `(item.unitPrice × item.quantity)`: clamp to `item.unitPrice × item.quantity` and show an inline message: "Discount capped at item total."
- If `discountType = PERCENTAGE` and entered value > 100: clamp to 100.
- If entered value is negative: clamp to 0.
- Clamping is applied immediately on input blur (not while typing).

**100% item discount special case:**  
If the user enters 100 as a percentage discount, do not show any confirmation. The item becomes free (line total = ₹0). This is a valid business scenario (e.g. a free gift item).

**Expected output:** The item's line total and the bill grand total update instantly as discount values change. Invalid values are clamped silently with a brief message. The Zustand store always holds the clamped value, never an invalid value.

---

- [ ] **ST-06.2.1** Wire the discount type selector (% vs ₹) to call `setItemDiscount` with the new type and the current value. When switching from % to ₹ (or vice versa), reset the discount value to 0.
  - **Expected output:** Switching from "%" to "₹" clears the discount value input and sets `itemDiscountType` in the store without applying a leftover percentage value as a flat amount.

- [ ] **ST-06.2.2** Wire the discount value numeric input to call `setItemDiscount` on every change (debounced 300ms to avoid excessive store updates while typing). Apply clamping on blur.
  - **Expected output:** Typing "30" in the flat discount field calls `setItemDiscount(draftId, productId, 'FLAT', 30)` after a 300ms pause. The item line total updates.

- [ ] **ST-06.2.3** Show the clamping message when a value is clamped. Show "Discount capped at item total." for flat amounts that exceed the item total. The message appears below the input and fades after 3 seconds (or disappears when the input changes).
  - **Expected output:** Entering ₹1000 on a ₹200 item shows "Discount capped at item total." and the input value updates to 200.

- [ ] **ST-06.2.4** Wire "Remove discount" link to call `clearItemDiscount(clientDraftId, productId)` and collapse the discount section.
  - **Expected output:** After clicking "Remove discount", the item's line total returns to the undiscounted value. The discount indicator on the collapsed row disappears.

---

---

## US-07 — Billing Screen: Bill-Level Discount UI and Updated Summary

**As a shopkeeper, I want to apply a discount to the entire bill total — after all item discounts are applied — so I can give an overall deal to the customer.**

**Scope:** Frontend only.  
**Dependency:** US-05 and US-06 (item discount) must be complete. US-03 T-03.2 (client calculator) must be complete.

---

### T-07.1 — `[FE]` Add bill-level discount input to the bill summary sidebar

**What:** Below the subtotal line in the bill summary sidebar, add an "Add bill discount" button/link. Clicking it expands an inline discount input. The bill summary then shows the full discount breakdown.

**How:**  
Modify the existing bill summary component (e.g. `features/billing/billing-summary.tsx` or equivalent).

**Collapsed state (no bill discount active):**

- Show "Add bill discount" link/button below the subtotal line.

**Expanded state:**

- Show a discount type selector: "%" and "₹".
- Show a numeric input.
- Show a "Remove" link to clear it.

**Bill summary breakdown when discounts are present:**  
The summary sidebar must show these lines in this order (lines with zero values are hidden):

```
Subtotal:                    ₹300.00    ← SUM(discountedSubtotal) — after item discounts
Item discounts:              −₹30.00    ← only shown if any item has a discount
                                          (sum of all itemDiscountAmounts)
After item discounts:        ₹270.00    ← only shown if item discounts exist
GST:                         ₹48.60    ← only shown if gstEnabled
Bill discount (10%):         −₹31.86    ← only shown if billDiscount > 0
Grand Total:                 ₹286.74
```

If no discounts and GST is off: only `Subtotal` and `Grand Total` lines are shown (same as MVP 1/2).

**Expected output:** "Add bill discount" appears in the summary. Clicking it shows the discount input. The summary breakdown updates in real-time as the user types. The layout collapses cleanly when no discounts are applied.

---

- [ ] **ST-07.1.1** Add a local `billDiscountOpen: boolean` state to the summary component. Show "Add bill discount" link when `false` and `billDiscountType === 'NONE'`. Show the discount input when `true`. Show the active discount (and a "Remove" option) when `billDiscountType !== 'NONE'` regardless of `billDiscountOpen`.
  - **Expected output:** Toggle works. The section is collapsed by default and expanded on click.

- [ ] **ST-07.1.2** Implement the bill discount input: same segmented control (% vs ₹) and numeric input as item discount. Wire to `setBillDiscount(clientDraftId, type, value)`. Wire "Remove" to `clearBillDiscount(clientDraftId)`.
  - **Expected output:** Entering a bill discount updates the Zustand store and triggers summary recalculation.

- [ ] **ST-07.1.3** Rewrite the bill summary component to display the full multi-line breakdown. Compute all values using `calculateDiscounts()` from the client-side utility. The inputs come from the active draft's items and bill discount fields in the Zustand store.
  - **Expected output:** Summary shows correct values. Item discount line only appears when at least one item has a discount. GST line only appears when GST is enabled. Bill discount line only appears when a bill discount is set.

- [ ] **ST-07.1.4** Implement clamping and the 100% bill discount confirmation. If the bill discount value results in `grandTotal = 0` (100% discount): show a confirmation dialog — "This makes the bill total ₹0. Continue?" — before applying. If the user cancels, revert to previous value. Apply the same clamping as item discounts (value cannot exceed `preDiscountGrandTotal`).
  - **Expected output:** 100% bill discount shows confirmation. Entering a flat amount exceeding the total clamps to the total and shows "Discount capped at bill total."

---

### T-07.2 — `[FE]` Update the invoice finalization payload to include discount fields

**What:** The `POST /tenants/:tenantId/invoices` request from the billing screen must now include all discount fields so the server can compute authoritative discount amounts.

**How:**  
Modify the invoice finalization hook/function (the `useInvoiceCreation` hook from MVP 1) to include discount data from the active draft.

**Updated payload:**

```typescript
{
  clientGeneratedId: string,
  outletId: string,
  paymentMethod: string,
  customerName: string | null,
  customerPhone: string | null,
  gstEnabled: boolean,
  billDiscountType: DiscountType,       // NEW
  billDiscountValue: number,             // NEW
  items: Array<{
    productId: string,
    quantity: number,
    override?: boolean,
    itemDiscountType: DiscountType,     // NEW
    itemDiscountValue: number,           // NEW
  }>
}
```

**After invoice creation succeeds:**  
The server response includes server-computed discount amounts. Show the invoice detail using the server's values, not the client's pre-computed values. If the user sees the grand total change slightly (due to server rounding), this is expected and acceptable.

**Expected output:** Invoice creation requests include all discount fields. Old code paths (no discount) still work because discount fields have defaults.

---

- [ ] **ST-07.2.1** Update the invoice finalization payload builder to read `billDiscountType`, `billDiscountValue` from `activeDraft` and `itemDiscountType`, `itemDiscountValue` from each `DraftItem`. Include them in the request payload.
  - **Expected output:** Network request to `/invoices` includes discount fields when discounts are active. The fields are `NONE` and `0` when no discount is applied.

---

---

## US-08 — Invoice History: Refund Badge, Negative Totals, Type Filter

**As a shopkeeper viewing my invoice history, I want to clearly see which entries are refunds, see their negative amounts in a distinct color, and filter to view only sales or only refunds.**

**Scope:** Frontend only.  
**Dependency:** US-02 T-02.3 (backend type filter) must be complete.

---

### T-08.1 — `[FE]` Add "Refund" badge and negative styling to invoice list rows

**What:** REFUND type invoices in the invoice history list are visually distinct from SALE invoices.

**How:**  
Modify the invoice list row component.

**For REFUND invoice rows:**

- Show a "Refund" badge in a distinct color (e.g. coral/red-100 with red text, or amber — match the project's existing design system).
- Display the `grandTotal` as a negative value with a minus sign: "−₹450.00".
- Color the grand total text in red or coral (distinct from the normal black/dark text).
- The row is still clickable and navigates to the refund invoice detail screen.

**For SALE invoice rows:** No change from MVP 1/2 behavior.

**Expected output:** Refund invoices are immediately visually distinguishable in the list. The negative total is clearly shown.

---

- [ ] **ST-08.1.1** Modify the invoice list row component. Check `invoice.invoiceType === 'REFUND'`. If true: show the "Refund" badge next to the invoice number. Show the grand total as `−₹{Math.abs(grandTotal).toFixed(2)}` in a red/coral color.
  - **Expected output:** A REFUND invoice row shows the badge and negative total in red. A SALE invoice row is unchanged.

---

### T-08.2 — `[FE]` Add invoice type filter to the invoice history page

**What:** Add a new filter option to the invoice history page that allows filtering by invoice type: All, Sales only, or Refunds only.

**How:**  
The invoice history page currently uses URL `searchParams` for filters (from MVP 1). Add a new `invoiceType` URL parameter.

**Filter UI:** A segmented control or dropdown with three options:

- "All" (default — no filter)
- "Sales only"
- "Refunds only"

When the user selects an option, update the URL `searchParams` (e.g. `?invoiceType=SALE`). The page re-renders server-side with filtered results.

**API call update:** Pass the `invoiceType` filter value to the `getInvoices()` API query function. Map "Sales only" → `invoiceType=SALE`, "Refunds only" → `invoiceType=REFUND`, "All" → no param.

**Expected output:** Selecting "Refunds only" shows only REFUND invoices. Selecting "Sales only" shows only SALE invoices. "All" shows everything. Filter state is preserved in the URL (deep-linkable).

---

- [ ] **ST-08.2.1** Add an `invoiceType` URL param to the invoice history page. Add the filter UI component (segmented control/dropdown). Wire selection to `router.push` with the updated URL. Pass the value to the existing `getInvoices()` API call.
  - **Expected output:** Selecting "Refunds only" updates the URL to `?invoiceType=REFUND` and the page shows only refund invoices.

- [ ] **ST-08.2.2** Update `lib/api/invoices.ts` `getInvoices()` function to include the `invoiceType` query parameter when it is provided.
  - **Expected output:** `getInvoices({ invoiceType: 'REFUND' })` sends `?invoiceType=REFUND` to the server.

---

---

## US-09 — Invoice Detail (SALE): Refund Button, Eligibility, Discount Display, and Returns Section

**As a shopkeeper viewing a sale invoice, I want to see a "Process Refund" button that is correctly enabled or disabled based on eligibility, see any discounts that were applied, and see any returns that have already been processed for this invoice.**

**Scope:** Frontend only.  
**Dependency:** US-02 (backend refund API and updated GET endpoint) must be complete. US-04 (backend discount fields on invoice) must be complete.

---

### T-09.1 — `[FE]` Add the "Process Refund" button with eligibility logic

**What:** On the invoice detail page for a SALE invoice, add a "Process Refund" button. This button is enabled or disabled based on the eligibility rules from the PRD.

**How:**  
The invoice detail page already fetches the full invoice object. With the US-02 update, it now also receives a `refunds` array. Use these to compute eligibility.

**Eligibility logic (compute on the client from the fetched invoice data):**

| Condition                                         | Button State    | Tooltip / Message                                           |
| ------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| `invoiceType = REFUND`                            | Hidden entirely | N/A                                                         |
| `invoiceType = SALE` and all items fully refunded | Disabled        | "All items have already been returned."                     |
| `invoiceType = SALE` and sync-pending             | Disabled        | "This invoice is still syncing. Wait for sync to complete." |
| `invoiceType = SALE` and eligible                 | Enabled         | None                                                        |

**How to detect "all items fully refunded":**  
For each item in the original invoice, compute `previouslyRefundedQty` by summing quantities from the `refunds` array for that `productId`. If `previouslyRefundedQty >= originalQty` for every item, all items are fully refunded.

**How to detect sync-pending:**  
If the invoice object has no `invoiceNumber` (null or empty string), it is sync-pending.

**Button placement:** At the top-right of the invoice detail screen, near the invoice number. Use a secondary/outline button style (not the primary action button style).

**Expected output:** The button appears on SALE invoices. It is enabled for refundable invoices. It is correctly disabled with a tooltip explaining why, when not eligible. It is completely hidden for REFUND invoices.

---

- [ ] **ST-09.1.1** Compute eligibility on the invoice detail page (server component) using the fetched invoice data. Determine: is the button visible, enabled, or disabled-with-reason? Pass this as props to the client components.
  - **Expected output:** For a fresh SALE invoice with no prior refunds: button visible and enabled. For a SALE invoice where all items are returned: button disabled.

- [ ] **ST-09.1.2** Render the "Process Refund" button. When enabled, clicking it navigates to `/invoices/:id/refund`. When disabled, show the button as greyed out with a tooltip showing the reason. When it should be hidden (REFUND invoice), render nothing.
  - **Expected output:** Enabled button navigates correctly. Disabled button shows tooltip on hover. REFUND invoice shows no button at all.

---

### T-09.2 — `[FE]` Show discount information on the invoice detail screen

**What:** The invoice detail screen must display discount information for invoices that had discounts applied. For invoices with no discounts, the display is unchanged from MVP 1/2.

**How:**  
Update the invoice detail item table and summary section.

**Item table changes (for each line item):**

- If `itemDiscountType !== 'NONE'`: show the original unit price, then below it show the discount (e.g. "−₹20 discount" or "−10% discount"), then show the discounted unit price.
- The line total shown is the post-discount line total (already stored correctly on the invoice).
- If `itemDiscountType === 'NONE'`: show item row exactly as MVP 1/2.

**Summary section changes:**

- Show the same multi-line breakdown as the billing screen summary (US-07 T-07.1.3):
  - Subtotal (after item discounts)
  - Item discounts total (only if any item had a discount)
  - GST (only if `isGstInvoice = true`)
  - Bill discount (only if `billDiscountType !== 'NONE'`)
  - Grand total
- All values from the invoice object — do not recompute.

**Expected output:** Invoice detail for an invoice with discounts shows the discount breakdown clearly. Invoice detail for an invoice without discounts looks identical to MVP 1/2.

---

- [ ] **ST-09.2.1** Update the invoice item row renderer on the detail page to conditionally show discount information when `itemDiscountType !== 'NONE'`. Show original price, discount amount, discounted price, and line total.
  - **Expected output:** An item with a 10% discount on ₹100 at 3 qty shows: "₹100" → "−₹30 (10%)" → "₹270 discounted" → "Line: ₹270".

- [ ] **ST-09.2.2** Update the invoice summary section on the detail page to show the full breakdown using values from the invoice object directly (no recomputation).
  - **Expected output:** Summary shows correct multi-line breakdown. Zero-value discount lines are hidden.

---

### T-09.3 — `[FE]` Add "Returns" section to SALE invoice detail

**What:** If a SALE invoice has associated refunds, show a "Returns" section at the bottom of the invoice detail page listing all refund invoices.

**How:**  
The invoice detail response now includes a `refunds` array (from US-02 T-02.2). If `refunds.length > 0`, render a "Returns" section below the items and summary.

**"Returns" section layout:**

- Section title: "Returns"
- For each refund in `invoice.refunds`:
  - Refund invoice number (clickable link → navigates to that refund invoice's detail page at `/invoices/:refundId`)
  - Date of refund (formatted: e.g. "Apr 13, 2026 at 2:30 PM")
  - Number of items returned
  - Refund total (negative, formatted: "−₹450.00")

**Expected output:** SALE invoice with refunds shows the Returns section. Clicking a refund number navigates to that refund's detail screen. SALE invoice with no refunds shows no Returns section.

---

- [ ] **ST-09.3.1** Conditionally render the "Returns" section on the SALE invoice detail page when `invoice.refunds.length > 0`. Map each refund to a row with number (as a link), date, item count, and refund total.
  - **Expected output:** Returns section is visible for invoices with refunds. Clicking a refund link navigates to `/invoices/{refundId}`.

---

---

## US-10 — Refund Selection Screen: UI, Validation, and Submission

**As a shopkeeper, I want a clear screen where I can select which items to return and in what quantity, see the refund total before confirming, and submit the refund with one click.**

**Scope:** Frontend only.  
**Dependency:** US-02 (refund API) and US-09 (refund button) must be complete.

---

### T-10.1 — `[FE]` Create the refund selection page

**What:** A dedicated page at `/invoices/:id/refund` that shows all items from the original invoice with quantity selectors for how many of each to return.

**Route:** `app/(dashboard)/invoices/[id]/refund/page.tsx`

**This page is a server component.** It fetches the original invoice and all existing refunds (from `GET /tenants/:tenantId/invoices/:id`) and passes data to a client component for interaction.

**Data needed from the server fetch:**

- Original invoice: `invoiceNumber`, `createdAt`, `items`, `refunds` array (to compute already-refunded quantities).

**Page guards (server-side):**

- If the invoice is not found: redirect to `/invoices`.
- If the invoice is `invoiceType = REFUND`: redirect to `/invoices/:id` (cannot refund a refund).
- If the invoice is soft-deleted: redirect to `/invoices/:id`.

**Expected output:** Navigating to `/invoices/:id/refund` shows the refund selection UI for a valid SALE invoice. Invalid or ineligible invoices redirect automatically.

---

- [ ] **ST-10.1.1** Create `app/(dashboard)/invoices/[id]/refund/page.tsx` as an async server component. Fetch the invoice using `getInvoice(tenantId, id)`. Implement the guards (redirect to `/invoices/:id` for ineligible invoices). Pass the invoice and refunds data to the `RefundSelectionForm` client component.
  - **Expected output:** Page loads for valid SALE invoices. Navigating to this URL for a REFUND invoice redirects back to the invoice detail.

---

### T-10.2 — `[FE]` Build the `RefundSelectionForm` client component

**What:** An interactive form where the user specifies how many units of each item to return.

**Component file:** `features/invoices/refund-selection-form.tsx` (client component: `'use client'`)

**Layout:**

- Header: "Process Return" with the original invoice number and date for context.
- A table or list of items, each row showing:
  - Product name (from snapshot on original invoice)
  - Original quantity sold
  - Already refunded quantity (computed: sum of this product's quantity across all prior refund invoices)
  - Maximum returnable = `originalQty - alreadyRefunded`
  - A quantity input: integer, min 0, max = `maxReturnableQty`. Default: 0.
  - Unit price (effective discounted price from original invoice: `discountedSubtotal / originalQty`)
  - Line refund total (dynamically computed: `returnQty × effectiveUnitPrice`)
- Items where `maxReturnableQty = 0` are shown but the quantity input is disabled with text "Already returned".
- An optional text area: "Reason for return (optional)" — max 500 chars.
- Summary section showing:
  - Total units being returned (sum of all selected return quantities)
  - Total refund amount (sum of all line refund totals, negative)
- "Confirm Return" button — disabled when all quantities are 0.
- "Cancel" button — navigates back to `/invoices/:id`.

**State management (local React state, not Zustand — refund form state is ephemeral):**

```typescript
const [returnQuantities, setReturnQuantities] = useState<
  Record<string, number>
>(Object.fromEntries(items.map((item) => [item.productId, 0])));
const [refundReason, setRefundReason] = useState('');
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState('');
```

**Expected output:** Form renders all items from the original invoice. Items that are fully refunded show disabled inputs. The refund total updates instantly as quantities change.

---

- [ ] **ST-10.2.1** Create `features/invoices/refund-selection-form.tsx`. Define props: `{ invoice: Invoice, existingRefunds: RefundSummary[] }`. Compute `alreadyRefunded` per product by summing `existingRefunds` items. Compute `maxReturnableQty` per product.
  - **Expected output:** Component renders with correct max values per item. Fully refunded items have disabled inputs.

- [ ] **ST-10.2.2** Render the items table. Each row: product name, original qty, already refunded qty, max returnable, a numeric input (0 to maxReturnableQty), effective unit price, and line refund total. Line refund total updates as the quantity input changes.
  - **Expected output:** Entering 2 in the quantity input for a ₹90 item shows "−₹180.00" as the line refund total.

- [ ] **ST-10.2.3** Render the optional refund reason textarea. Max 500 characters. Show a character counter (e.g. "42/500").
  - **Expected output:** Textarea accepts text. Counter updates correctly. Cannot type beyond 500 characters.

- [ ] **ST-10.2.4** Render the summary section: total return units and total refund amount (negative). Both update in real-time.
  - **Expected output:** Selecting 2 of Rice and 1 of Sugar shows the correct combined totals.

- [ ] **ST-10.2.5** Disable the "Confirm Return" button when: all quantities are 0, OR `submitting = true`.
  - **Expected output:** Button is disabled on load (all quantities = 0). Button enables as soon as any quantity > 0.

---

### T-10.3 — `[FE]` Implement refund form submission

**What:** When the user clicks "Confirm Return", send the refund request to the server, handle success and error states, and navigate to the new refund invoice detail on success.

**How:**  
This is a client-side API call (not a server action), because it requires a two-step UI (form → confirm) and the response must navigate to the new invoice. Use `clientAxios`.

**Submission logic:**

```typescript
const handleSubmit = async () => {
  setSubmitting(true);
  setError('');

  const itemsToRefund = Object.entries(returnQuantities)
    .filter(([_, qty]) => qty > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

  try {
    const { data } = await clientAxios.post(
      `/tenants/${tenantId}/invoices/${invoice._id}/refund`,
      {
        clientGeneratedId: uuidv4(), // generate fresh UUID per submission attempt
        refundReason: refundReason.trim() || null,
        items: itemsToRefund,
      },
    );
    router.push(`/invoices/${data._id}`);
  } catch (err: any) {
    setError(err.message || 'Something went wrong. Please try again.');
    setSubmitting(false);
  }
};
```

**Error handling:**

- HTTP 400 (quantity violation): show "You can return at most {N} units of {product}." per the error details.
- HTTP 409 (sync-pending): show "This invoice has not finished syncing. Please wait."
- Network error: show "Something went wrong. Please check your connection and try again."

**On success:** Navigate to `/invoices/:newRefundInvoiceId` (the refund invoice detail page).

**Expected output:** Clicking "Confirm Return" sends the request. On success, the user lands on the refund invoice detail page. On failure, an error message is shown and the form remains interactive.

---

- [ ] **ST-10.3.1** Implement the `handleSubmit` function. Generate a fresh `clientGeneratedId` using `uuidv4()` on every submission click. Send the request using `clientAxios.post`. On success: navigate to the refund invoice detail.
  - **Expected output:** Clicking "Confirm Return" sends the correct payload. Network request is visible in DevTools.

- [ ] **ST-10.3.2** Show a loading state while submitting: disable all inputs and the button, show a spinner on the button ("Processing...").
  - **Expected output:** After clicking "Confirm Return", the form is locked while the request is in-flight.

- [ ] **ST-10.3.3** Handle error responses. Parse error details from the server response when available. Show specific messages for 400 and 409 errors. Show a generic message for network failures.
  - **Expected output:** A 400 error from the server shows a meaningful message. The form remains usable after an error.

---

---

## US-11 — Refund Invoice Detail: New Screen for REFUND Type Invoices

**As a shopkeeper, I want to view a refund invoice clearly — seeing what was returned, for how much, and which original invoice it relates to — with the same clean layout as a sale invoice.**

**Scope:** Frontend only.  
**Dependency:** US-02 (refund API returns originalInvoice in response) must be complete.

---

### T-11.1 — `[FE]` Handle REFUND invoice type on the invoice detail page

**What:** The existing invoice detail page (`app/(dashboard)/invoices/[id]/page.tsx`) renders both SALE and REFUND invoices. It needs conditional rendering based on `invoiceType` to show the appropriate layout for each.

**How:**  
The invoice detail page is already a server component that fetches the invoice. With MVP 3's GET endpoint changes (US-02 T-02.2), REFUND invoices now include `originalInvoice: { id, invoiceNumber, createdAt }` in the response.

**REFUND invoice detail layout:**

1. **Header:**
   - Badge: "Refund" in a distinct color (same as used in the invoice list).
   - Invoice number (same format as sale invoices — just a regular number).
   - Date and time of the refund.

2. **"Refund for" section (top of page, prominent):**
   - Label: "Refund for:"
   - The original invoice number as a clickable link → navigates to `/invoices/:originalInvoiceId`.
   - Original invoice date.

3. **Customer info:** Same as SALE — show `customerName` and `customerPhone` if present.

4. **Items table:**
   - Each row shows the returned item with the label "X returned" after the product name (e.g. "Rice 1kg × 2 returned").
   - Unit price: the effective discounted price (what was paid per unit on the original invoice).
   - Line total: shown as negative (e.g. "−₹180.00") in red text.

5. **Summary section (all values negative):**
   - Subtotal: negative (e.g. "−₹450.00")
   - GST: negative (if `isGstInvoice = true`)
   - Grand Total: negative and bold (e.g. "−₹498.60")

6. **Refund reason (if present):** Show below the summary — "Reason: {refundReason}".

7. **Payment method:** Show the same payment method as the original invoice (copied at refund time).

8. **NO "Process Refund" button.** REFUND invoices cannot be refunded. This button must not appear.

**Expected output:** Navigating to `/invoices/:refundInvoiceId` shows the REFUND layout. The original invoice link works. All totals are shown as negative values. No refund button is shown.

---

- [ ] **ST-11.1.1** In the invoice detail page, check `invoice.invoiceType`. If `REFUND`: render the "Refund for:" section using `invoice.originalInvoice`. If `SALE`: render as before (with the additions from US-09).
  - **Expected output:** REFUND invoices show the "Refund for: [ORIGINAL-001]" link at the top. SALE invoices do not show this section.

- [ ] **ST-11.1.2** Render the REFUND invoice item table with "× {qty} returned" labels and negative line totals in red text.
  - **Expected output:** Each item row shows "Rice 1kg × 2 returned" with "−₹180.00" as the line total.

- [ ] **ST-11.1.3** Render the REFUND summary section with all values as negative. Apply the same visual treatment as invoice list (negative numbers in red/coral).
  - **Expected output:** Summary shows negative subtotal, negative GST (if applicable), and negative grand total.

- [ ] **ST-11.1.4** Show the refund reason if present. Hide the "Process Refund" button entirely for REFUND invoices.
  - **Expected output:** Refund reason appears below the summary when it exists. No refund button on REFUND invoices.

---

---

## Dependency Map

Build in this order to avoid blockers:

```
US-01 (Database Schema — BE)
  ├── US-02 (Refund API — BE)
  │     ├── US-09 (Invoice Detail: refund button — FE)
  │     │     └── US-10 (Refund selection screen — FE)
  │     │           └── US-11 (Refund invoice detail — FE)
  │     ├── US-08 (Invoice History filters — FE) ← parallel with US-09
  │     └── US-11 (can start after US-02 T-02.2)
  └── US-04 (Invoice Creation API update — BE)
        └── US-07 (Bill-level discount UI — FE)

US-03 (Discount Calculator — BE + FE) ← parallel with everything, no dependencies
  ↓
US-04 (Invoice Creation API update — BE) ← needs US-03 + US-01
US-05 (Zustand Store discount state — FE) ← needs US-01 T-01.3 + US-03 T-03.2
  └── US-06 (Item-level discount UI — FE) ← needs US-05
        └── US-07 (Bill-level discount UI — FE) ← needs US-06
```

**Recommended build order:**

| Phase | Stories                                                        | Who                           |
| ----- | -------------------------------------------------------------- | ----------------------------- |
| 1     | US-01 (schema), US-03 (calculator)                             | BE + FE in parallel           |
| 2     | US-02 (refund API), US-04 (invoice API update)                 | BE                            |
| 2     | US-05 (store types + actions)                                  | FE — parallel with phase 2 BE |
| 3     | US-06 (item discount UI), US-08 (history filters)              | FE                            |
| 4     | US-07 (bill discount UI), US-09 (invoice detail refund button) | FE                            |
| 5     | US-10 (refund selection screen), US-11 (refund invoice detail) | FE                            |

---

## Definition of Done (MVP 3 Complete)

Before MVP 3 is considered complete, all of the following must be true:

### Discounts

- [ ] Item-level percentage and flat discounts work in the billing screen
- [ ] Item-level discounts persist across tab switches and page refreshes (Zustand + IndexedDB)
- [ ] Bill-level percentage and flat discounts work in the billing screen
- [ ] Bill-level discounts persist across tab switches and page refreshes
- [ ] Discount clamping works for both item and bill discounts
- [ ] 100% bill discount shows confirmation before applying
- [ ] The discount calculation formula produces identical results on client and server
- [ ] Finalized invoices store server-computed discount amounts (not client estimates)
- [ ] Invoice detail page shows discount breakdown for invoices with discounts
- [ ] Invoice detail page is unchanged for invoices without discounts (backward compatible)
- [ ] Discount fields in draft sync payload — discounts restored on new device login

### Refunds

- [ ] "Process Refund" button appears on SALE invoices only
- [ ] Button is correctly disabled for: REFUND invoices (hidden), sync-pending, fully returned
- [ ] Refund selection screen shows all items with correct max returnable quantities
- [ ] Partial refund works — can return some items and not others
- [ ] Multiple partial refunds work — previously refunded quantities are correctly excluded
- [ ] Refund uses effective discounted price (not pre-discount price)
- [ ] Stock is automatically restored when a refund is processed
- [ ] Refund invoice is a separate record — original invoice is not modified
- [ ] Refund invoice detail page shows "Refund for: [ORIGINAL]" link
- [ ] SALE invoice detail shows "Returns" section when refunds exist
- [ ] Invoice history shows "Refund" badge and negative totals in red for REFUND invoices
- [ ] Invoice history type filter works: All / Sales only / Refunds only
- [ ] Idempotency: submitting the same refund twice creates only one refund invoice

### Regression

- [ ] All MVP 1 and MVP 2 features continue to work
- [ ] Invoice creation without discounts produces correct totals (backward compatible)
- [ ] Multi-tab billing continues to work with discounts (discounts are per-tab)
- [ ] Draft sync includes discount state

---

_End of MVP 3 User Story Breakdown_  
_All PRD requirements are covered. Nothing is left undefined._
