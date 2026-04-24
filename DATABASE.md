# MongoDB Database Schema Specification (MVP 1)

## Project Context

This document defines the COMPLETE database schema, constraints, validations, indexing strategy, and implementation rules for a multi-tenant POS + Inventory SaaS system using:

- Backend: NestJS
- Database: MongoDB (Replica Set REQUIRED)
- ORM: Mongoose (recommended)

This document is a **single source of truth for database implementation**. No assumptions should be made outside this document.

---

# 1. GLOBAL RULES (CRITICAL)

## 1.1 Multi-Tenant Isolation

- EVERY collection MUST include `tenantId`
- EVERY query MUST include `tenantId`
- NO cross-tenant queries allowed

---

## 1.2 Transactions (MANDATORY)

MongoDB transactions MUST be used for:

- Invoice creation
- Stock updates
- Deficit creation
- Daily counter updates

### Requirement:

- MongoDB must run as a **replica set**

---

## 1.3 Money Handling

Use MongoDB `Decimal128` for:

- basePrice
- subtotal
- gstAmount
- totalGstAmount
- grandTotal

DO NOT use floating point numbers.

---

## 1.4 Soft Delete Rule

- Use `isDeleted: Boolean`
- NEVER physically delete records
- All queries must filter:

```
{ isDeleted: false }
```

---

## 1.5 Timestamps

All collections must include:

- createdAt
- updatedAt

---

# 2. COLLECTIONS

---

# 2.1 TENANT

## Schema

```
_id: ObjectId
email: string (unique, required)
passwordHash: string (required)

businessName: string (required)
businessAbbr: string (3-6 chars, uppercase)

gstNumber: string (optional)
gstEnabled: boolean (default false)

abbrLocked: boolean (default false)

createdAt: Date
updatedAt: Date
```

## Validation

- email must be unique
- businessAbbr must be uppercase alphanumeric (3-6 chars)
- gstNumber must match GSTIN regex if provided

## Indexes

```
{ email: 1 } UNIQUE
```

---

# 2.2 OUTLET

## Schema

```
_id: ObjectId
tenantId: ObjectId (required)

outletName: string
outletAbbr: string (3-6 chars)

isDefault: boolean
abbrLocked: boolean

createdAt: Date
```

## Indexes

```
{ tenantId: 1 }
```

---

# 2.3 PRODUCT

## Schema

```
_id: ObjectId
tenantId: ObjectId

name: string
basePrice: Decimal128
gstRate: number (0,5,12,18,28)

deficitThreshold: number (>=1)

isDeleted: boolean

createdAt: Date
updatedAt: Date
```

## Indexes

```
{ tenantId: 1, isDeleted: 1 }
{ tenantId: 1, name: "text" }
```

---

# 2.4 STOCK RECORD

## Schema

```
_id: ObjectId
tenantId: ObjectId
productId: ObjectId
outletId: ObjectId

quantity: number (can be negative)

updatedAt: Date
```

## Constraints

- UNIQUE(productId, outletId)

## Indexes

```
{ productId: 1, outletId: 1 } UNIQUE
{ tenantId: 1 }
```

---

# 2.5 STOCK AUDIT LOG

## Schema

```
_id: ObjectId
tenantId: ObjectId
productId: ObjectId
outletId: ObjectId

previousQuantity: number
newQuantity: number

changeType: "SALE" | "MANUAL_UPDATE"
referenceId: ObjectId (optional)

changedAt: Date
```

## Indexes

```
{ tenantId: 1, changedAt: -1 }
{ productId: 1, outletId: 1 }
```

---

# 2.6 INVOICE

## Schema

```
_id: ObjectId
tenantId: ObjectId
outletId: ObjectId

invoiceNumber: string
clientGeneratedId: string

items: [
  {
    productId: ObjectId
    productName: string
    quantity: number
    unitPrice: Decimal128
    gstRate: number
    gstAmount: Decimal128
    lineTotal: Decimal128
  }
]

subtotal: Decimal128
totalGstAmount: Decimal128
grandTotal: Decimal128

paymentMethod: "CASH" | "CARD" | "UPI"

customerName: string
customerPhone: string

isGstInvoice: boolean
tenantGstNumber: string

isDeleted: boolean

createdAt: Date
```

## Indexes

```
{ tenantId: 1, createdAt: -1 }
{ tenantId: 1, invoiceNumber: 1 } UNIQUE
{ tenantId: 1, clientGeneratedId: 1 } UNIQUE
{ tenantId: 1, paymentMethod: 1 }
{ tenantId: 1, isGstInvoice: 1 }
```

---

# 2.7 DAILY INVOICE COUNTER

## Schema

```
_id: ObjectId
outletId: ObjectId

date: string (YYYY-MM-DD)
lastCounter: number
```

## Index

```
{ outletId: 1, date: 1 } UNIQUE
```

---

# 2.8 DEFICIT RECORD

## Schema

```
_id: ObjectId
tenantId: ObjectId
productId: ObjectId
outletId: ObjectId

quantity: number

linkedInvoiceId: ObjectId

status: "PENDING" | "RESOLVED"

resolutionMethod: "STOCK_ADDITION" | "ADJUSTMENT"
adjustmentReason: "DAMAGE" | "LOSS" | "CORRECTION"

resolvedAt: Date

createdAt: Date
```

## Indexes

```
{ tenantId: 1, productId: 1, outletId: 1, status: 1 }
{ tenantId: 1, createdAt: -1 }
```

---

# 2.9 PASSWORD RESET TOKEN

## Schema

```
_id: ObjectId
tenantId: ObjectId

tokenHash: string

expiresAt: Date
used: boolean

createdAt: Date
```

## Index

```
{ expiresAt: 1 } TTL
```

---

# 3. CRITICAL IMPLEMENTATION RULES

## 3.1 Invoice Transaction Flow

Inside a transaction:

1. Lock stock records
2. Validate stock
3. Deduct stock
4. Increment counter
5. Create invoice
6. Create deficit records
7. Create audit logs

ALL OR NOTHING

---

## 3.2 Idempotency

- Use `clientGeneratedId`
- Must be UNIQUE per tenant

---

## 3.3 Stock Can Be Negative

- Allowed only via override
- Must ALWAYS create deficit record

---

## 3.4 Deficit Threshold

```
if (pendingDeficit >= threshold) → BLOCK
```

---

## 3.5 No Joins Requirement

- Invoice must be self-contained
- NEVER depend on product lookup for history

---

# 4. PERFORMANCE & SCALING

## 4.1 Expected Scale

- Millions of invoices per tenant

## 4.2 Required Indexing Discipline

- Always prefix queries with tenantId

## 4.3 Future Sharding Key

```
{ tenantId: 1, createdAt: 1 }
```

---

# 5. NESTJS IMPLEMENTATION GUIDELINES

## 5.1 Folder Structure

```
modules/
  tenant/
  product/
  stock/
  invoice/
  deficit/
```

## 5.2 Use Mongoose Schemas

- Enable timestamps
- Use strict mode

## 5.3 DTO Validation

- Use class-validator
- Enforce all constraints at API level

---

# 6. FINAL WARNINGS

❌ DO NOT:

- Skip transactions
- Use floating numbers for money
- Allow cross-tenant queries
- Mutate invoices
- Auto-resolve deficits

✅ MUST:

- Use indexes exactly as defined
- Use atomic operations
- Enforce validation at DB + API level

---

# END OF DOCUMENT

This schema is production-ready and aligned with financial system standards.
