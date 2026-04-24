# Backend Build Contract — POS + Inventory SaaS MVP 1

## Stack: NestJS + MongoDB

## Audience: AI Agent Building the Backend

---

## 0. Purpose

This document is the **build contract** for the backend of the POS + Inventory SaaS MVP 1.

The AI agent must use this document as a strict implementation guide for:

- All backend features in the MVP
- Every required API route
- Authentication and session flow
- Validation rules
- MongoDB transaction and concurrency behavior
- Swagger/OpenAPI documentation
- Code organization, modularity, and maintainability
- Verification against the MVP 1 product requirements before and after implementation

This backend must be built as a **production-grade NestJS API** that supports the frontend described in the product requirements, while respecting every invariant defined in the MVP.

---

## 1. Non-Negotiable Product Boundaries

The AI agent must implement **only** the MVP 1 backend scope.

### Must include

- Signup, login, refresh, logout
- Password reset flow
- Onboarding flow
- Product management
- CSV import
- Billing and invoice finalization
- Invoice history and invoice detail
- Deficit management and resolution
- GST toggle and GST-aware invoice creation
- Settings management
- Stock updates and stock audit logging
- Tenant isolation
- Atomic transaction safety
- Swagger documentation for every API

### Must not include

- Analytics
- Refunds
- Discounts
- Multi-outlet management UI
- Offline sync queue
- Barcode scanning
- Receipt generation
- Split payments
- Role-based access control
- Customer entity management
- Multi-device shared drafting
- Any background mutation of stock or invoices

If a feature is not defined in the MVP 1 requirements, do not invent it.

---

## 2. Source of Truth and Verification Rule

The AI agent must treat the MVP 1 requirements document as the source of truth.

Before coding, the agent must:

1. Read the full MVP 1 requirements.
2. Cross-check entities, fields, route needs, state transitions, validations, and edge cases.
3. Compare the existing NestJS project structure and Mongo schema against the requirements.
4. Verify once that the schema and API plan match the document.
5. Log any mismatch as a required fix before implementation continues.

This verification step is mandatory. The AI agent must not silently diverge from the requirements.

---

## 3. Backend Design Philosophy

### 3.1 Modular Monolith

Build the backend as a modular NestJS application, not as a tangled set of controllers.

Use clear feature modules such as:

- AuthModule
- TenantsModule
- OnboardingModule
- ProductsModule
- StockModule
- InvoicesModule
- DeficitsModule
- SettingsModule
- ImportModule
- CommonModule

### 3.2 Business Logic Lives in Services

Controllers must stay thin.

Controllers should:

- Receive requests
- Apply guards/pipes
- Call services
- Return documented responses

Services should:

- Contain business logic
- Coordinate transactions
- Enforce validation beyond DTO shape
- Map domain rules into safe database operations

### 3.3 Repository/Model Access Must Be Controlled

Use a consistent data access pattern. Do not scatter database logic across random files.

### 3.4 No Hidden Mutation

No cron job, queue worker, hook, or side effect may silently change stock, invoices, or deficits.

Every change must be triggered by an explicit request and be visible in the code path.

---

## 4. Technology and Implementation Rules

### Required stack rules

- NestJS as the backend framework
- MongoDB as the database
- Use the existing schema structure already created, but verify it against the MVP before proceeding
- Use DTOs for every request body, query, and route param
- Use class-validator and class-transformer
- Use Swagger decorators on every controller method and DTO
- Use structured logging
- Use consistent exception handling
- Use transactions for all operations that require atomicity

### MongoDB transaction rule

Any operation that changes multiple related records must use a MongoDB session and transaction where required, especially:

- Final invoice creation
- Deficit resolution
- Stock update flows that must remain traceable
- Password reset token invalidation flow when it changes multiple session records
- Any flow where invoice number generation and stock deduction happen together

### Important MongoDB note

Because the MVP describes transactional atomicity and lock-like behavior, the agent must use the closest correct MongoDB equivalent:

- MongoDB transactions with sessions
- Unique indexes
- Atomic updates
- Idempotency keys
- Careful re-checks inside the transaction

Do not fake transaction safety in application memory.

---

## 5. Required Module Breakdown

The backend should be organized into feature modules.

### 5.1 Auth Module

Responsibilities:

- Signup
- Login
- Refresh access token
- Logout
- Forgot password
- Reset password
- Change password
- `me` endpoint if needed for session bootstrap

### 5.2 Onboarding Module

Responsibilities:

- Save business onboarding step
- Save outlet onboarding step
- Save GST onboarding step
- Finalize onboarding
- Return onboarding status

### 5.3 Tenants Module

Responsibilities:

- Tenant profile read/update
- GST toggle persistence
- Business abbreviation lock behavior
- Tenant-level settings access

### 5.4 Products Module

Responsibilities:

- Create product
- List products
- Read product by id
- Edit product
- Soft delete
- Restore product
- Search products
- CSV import
- CSV template download

### 5.5 Stock Module

Responsibilities:

- Get stock values
- Update stock manually
- Create stock audit entries
- Enforce stock-related traceability

### 5.6 Invoices Module

Responsibilities:

- Finalize invoice
- Idempotency handling
- Invoice number generation
- Invoice listing
- Invoice detail
- GST snapshot behavior

### 5.7 Deficits Module

Responsibilities:

- List pending deficits grouped by product
- Resolve deficits via stock addition
- Resolve deficits via adjustment
- Enforce deficit threshold rules

### 5.8 Settings Module

Responsibilities:

- Read settings data
- Update business data where allowed
- Update GST number
- Change password flow support
- Logout support may also live under auth

### 5.9 Import Module

Responsibilities:

- CSV parsing
- Row validation
- Skip-bad-rows import behavior
- Import report generation

### 5.10 Common Module

Responsibilities:

- Global pipes
- Exception filters
- Interceptors
- Guards
- Utilities
- Shared DTO helpers
- Date helpers for IST
- Abbreviation helpers
- Response helpers

---

## 6. Global API Rules

### 6.1 Route Style

Use clear REST-style routes. Keep naming consistent and predictable.

### 6.2 Tenant Scope

Every query must be tenant-scoped.

The backend must never return data from another tenant.

### 6.3 Outlet Scope

Even though MVP 1 has one outlet per tenant, all outlet-aware records must still use outletId.

### 6.4 Response Consistency

Use one response style across the API.

Do not invent a different response envelope for each module.

If the existing CRUD APIs already use a consistent structure, preserve that structure for all new endpoints.

### 6.5 Error Consistency

Use consistent error formatting and HTTP status codes.

Expected categories:

- 400 Bad Request for invalid inputs
- 401 Unauthorized for missing/invalid authentication
- 403 Forbidden for blocked actions such as override blocked by deficit threshold
- 404 Not Found for missing resources within tenant scope
- 409 Conflict for stock insufficiency, duplicate idempotency conflicts, or concurrent business conflicts
- 422 Unprocessable Entity only if the project already uses it consistently; otherwise prefer 400
- 500 Internal Server Error for unexpected failures

---

## 7. Authentication and Session Contract

### 7.1 Authentication Model

Use access token plus refresh token.

#### Access token

- JWT
- 7-day expiry
- Sent by the client in the Authorization header

#### Refresh token

- Random UUID or equivalent secure random token
- 30-day expiry
- Stored in HttpOnly cookie
- Must be invalidated on password reset
- Should also be invalidated on logout

### 7.2 Session Storage

If the project stores refresh sessions in MongoDB, store them in a dedicated collection.

Recommended fields:

- tenantId
- tokenHash or tokenId
- expiresAt
- revokedAt
- createdAt
- user-agent/IP metadata if useful

Do not store the raw refresh token in plain text if avoidable. Hashing is preferred.

### 7.3 Signup Flow

Route: `POST /auth/signup`

Behavior:

1. Validate email and password.
2. Reject duplicate email with a clear message.
3. Hash password using a strong cost factor.
4. Create the tenant record with default settings.
5. Return success.
6. Redirect the client to onboarding.

### 7.4 Login Flow

Route: `POST /auth/login`

Behavior:

1. Validate credentials.
2. Return a generic error for invalid credentials.
3. Issue access token and refresh token cookie.
4. Return tenant session bootstrap data if needed by the frontend.
5. Redirect to onboarding if onboarding is incomplete.
6. Redirect to billing if onboarding is complete.

### 7.5 Refresh Flow

Route: `POST /auth/refresh`

Behavior:

1. Read refresh token from HttpOnly cookie.
2. Validate it against stored session data.
3. Rotate or renew access token.
4. If refresh token is expired, revoked, or invalid, return 401.

### 7.6 Logout Flow

Route: `POST /auth/logout`

Behavior:

1. Revoke the current refresh session.
2. Clear the refresh cookie.
3. Return success.

### 7.7 Password Reset Flow

Route set:

- `POST /auth/forgot-password`
- `POST /auth/reset-password`

Behavior:

- The forgot password route must always respond generically.
- If the email exists, create a reset token with 24-hour expiry.
- Store only the hashed token value.
- Send a reset link to the frontend route.
- On reset, verify token validity, update password, mark token used, and revoke all refresh sessions for that tenant.

### 7.8 Change Password Flow

Route: `POST /settings/change-password` or `POST /auth/change-password`

Behavior:

- Require current password
- Validate new password rules
- Update password hash
- Revoke active refresh sessions if required by the project security policy

---

## 8. Onboarding Flow Rules

The onboarding flow must follow the MVP requirements precisely.

### Required route behavior

The frontend has separate onboarding screens, so the backend must support step-by-step save or a final step that stores everything cleanly.

Recommended endpoints:

- `GET /onboarding/status`
- `PATCH /onboarding/business`
- `PATCH /onboarding/outlet`
- `PATCH /onboarding/gst`
- `POST /onboarding/complete`

### 8.1 Onboarding Status

Return:

- whether onboarding is complete
- whether business data exists
- whether outlet data exists
- whether abbreviations are locked

### 8.2 Business Step

Validate:

- businessName required
- max 100 characters
- businessAbbr 3–6 characters
- alphanumeric only
- uppercase normalization

### 8.3 Outlet Step

Validate:

- outletName required
- max 100 characters
- outletAbbr 3–6 characters
- alphanumeric only
- uppercase normalization

### 8.4 GST Step

Validate:

- GST number optional
- trim whitespace
- preserve user input behavior if the project allows warnings instead of hard rejection

Important:
The MVP says invalid GSTIN should not block saving. The backend must not turn that into a hard failure unless the frontend contract explicitly requires it. Keep the backend permissive here.

### 8.5 Completion

On final onboarding:

- Create or finalize tenant business details
- Create default outlet
- Lock onboarding from further edits if complete
- Preserve the one-outlet MVP invariant

---

## 9. Tenant and Settings Rules

### 9.1 Tenant Profile

Expose a read endpoint for the authenticated tenant.

### 9.2 GST Toggle

The GST toggle belongs to the tenant.

Backend responsibilities:

- Persist the GST enabled flag
- Reflect the flag in invoice creation
- Return the current flag in settings/bootstrap endpoints

### 9.3 Abbreviation Locking

Once the first invoice is created:

- businessAbbr becomes locked
- outletAbbr becomes locked

This lock must be enforced at the server level.

### 9.4 Settings Route Set

Recommended:

- `GET /settings`
- `PATCH /settings/business`
- `PATCH /settings/gst`
- `POST /settings/change-password`

Settings responses should include business and outlet abbreviations, GST state, and any lock flags required by the frontend.

---

## 10. Product Management Rules

### 10.1 Required Product Routes

Recommended:

- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `PATCH /products/:id/restore`
- `PATCH /products/:id/stock`
- `POST /products/import`
- `GET /products/import/template`

### 10.2 Product List Behavior

List responses should support:

- Search by name
- Active-only view
- Include deleted products when requested
- Current stock quantity
- Status flag active/deleted

### 10.3 Product Creation Validation

Fields:

- name required, max 200 characters
- basePrice required, positive, 2 decimal places max
- gstRate required, must be one of 0, 5, 12, 18, 28
- openingStock optional, integer >= 0
- deficitThreshold optional, integer >= 1, default 10

### 10.4 Product Edit Rules

All product fields except deleted state are editable through the edit route.
Changes to name, price, or GST rate must not mutate past invoices.

### 10.5 Soft Delete Rules

A product can only be soft deleted if it has no pending deficits.

Do not physically remove the product record.

If delete is blocked, return a clear validation error.

### 10.6 Restore Rules

A soft-deleted product may be restored.

### 10.7 Manual Stock Update

Route: `PATCH /products/:id/stock`

**IMPLEMENTATION NOTE - Outlet Scoping:**
Stock in this system is outlet-scoped. Each product has independent stock quantities at each outlet. Therefore:

- The endpoint requires an `outletId` query parameter: `PATCH /tenants/:tenantId/products/:productId/stock?outletId=:outletId`
- This unambiguously identifies which product-outlet combination's stock is being updated
- Internally, this route delegates to the primary stock update endpoint: `PUT /tenants/:tenantId/stock/:stockId`

Rules:

- new quantity must be integer >= 0
- write a stock audit log entry
- update the stock record atomically
- do not auto-resolve deficits

### 10.8 Duplicate Product Names

Duplicate names are allowed and must not be blocked.

---

## 11. Stock and Audit Rules

### 11.1 Stock Record Model

There must be exactly one stock record per product per outlet.

Enforce uniqueness at the database level.

### 11.2 Stock Audit Log

Every stock change must produce a log entry.

Audit log entries are required for:

- Manual stock updates
- Invoice sales
- Any future stock correction flow that is explicitly defined

### 11.3 Audit Log Visibility

No audit log UI is required in MVP 1.

However, the data must be stored completely because the MVP expects it for traceability.

---

## 12. CSV Import Rules

### Required routes

- `POST /products/import`
- `GET /products/import/template`

### Import Behavior

- CSV only
- Max 5 MB
- Max 1000 rows excluding header
- Skip invalid rows
- Import valid rows
- Return a structured import report

### Columns

- name
- price
- gst_rate
- opening_stock
- deficit_threshold

### Row Validation

- name: required, non-empty, max 200 chars
- price: required, positive, 2 decimal places max
- gst_rate: must be one of 0, 5, 12, 18, 28
- opening_stock: optional, defaults to 0, integer >= 0
- deficit_threshold: optional, defaults to 10, integer >= 1

### Import Result

Return:

- imported count
- skipped count
- row-level skip reasons

---

## 13. Billing and Invoice Finalization Rules

This is the most important backend workflow in the MVP.

### 13.1 Required Route

`POST /invoices`

This single route should support:

- First stock validation request
- Second override request
- Final invoice creation
- Idempotency handling

### 13.2 Request Payload

Support:

- clientGeneratedId
- outletId
- paymentMethod
- customerName
- customerPhone
- gstEnabled
- items[]
- optional override flag per item in the second request

### 13.3 Validation Order

The route must validate in the documented order:

1. Idempotency
2. Authentication
3. Outlet ownership
4. Product existence and tenant ownership
5. Duplicate product check
6. Quantity validation
7. Stock validation

Do not reorder these checks unless the product requirements are updated.

### 13.4 Stock Insufficiency Response

If stock is insufficient for one or more items:

- Return 409
- Include the insufficient items list
- Include current stock and deficit threshold information required by the frontend modal

### 13.5 Override Behavior

If the client confirms override:

- Revalidate stock inside the transaction
- Block items where deficit threshold is already met or exceeded
- Return 403 when override is blocked

### 13.6 Atomic Commit Requirements

Use one transaction for the final invoice creation path.

Inside that transaction:

1. Lock or otherwise safely update all involved stock records
2. Re-check stock
3. Deduct stock
4. Generate invoice counter for the day
5. Generate invoice number
6. Lock abbreviations if this is the first invoice
7. Create invoice record with snapshots
8. Create deficit records for override items
9. Create stock audit logs
10. Commit

If any step fails, roll back the entire transaction.

### 13.7 Invoice Number Rules

Invoice numbers must follow the documented pattern:
`{businessAbbr}-{outletAbbr}-{YYYYMMDD}-{NNNNN}`

Use IST date logic exactly as defined in the MVP.

### 13.8 Invoice Snapshot Rules

When the invoice is created, snapshot:

- productName
- unitPrice
- gstRate
- gstAmount
- gstEnabled
- tenantGST number if present
- payment method
- customer data if present

Past invoices must not change when product names or prices change later.

### 13.9 Idempotency

The `clientGeneratedId` must make invoice creation safe for retries.

If the same request is repeated, return the existing invoice instead of creating a duplicate.

### 13.10 Invoice Response

Return the created invoice in a stable response shape that the frontend can consume directly.

---

## 14. Deficit Management Rules

### 14.1 Required Routes

- `GET /deficits`
- `PATCH /deficits/:productId/resolve-stock-addition`
- `PATCH /deficits/:productId/resolve-adjustment`

### 14.2 Listing Rules

The deficits list should return grouped product-level summaries:

- product name
- total pending deficit
- count of pending records
- latest deficit date
- deficit threshold
- warning state
- expandable record details

### 14.3 Stock Addition Resolution

Route: `PATCH /deficits/:productId/resolve-stock-addition`

Body should include:

- receivedQuantity

Behavior:

- Add received quantity to stock
- Create audit log
- Resolve pending deficits oldest first until quantity is exhausted
- Support partial resolution if not enough stock is received

### 14.4 Adjustment Resolution

Route: `PATCH /deficits/:productId/resolve-adjustment`

Body should include:

- adjustmentReason
- allowed values: DAMAGE, LOSS, CORRECTION

Behavior:

- Resolve all pending deficit records for the product
- Do not change stock quantity
- Mark records resolved with the reason

### 14.5 Threshold Enforcement

Before override sales, the backend must compute the pending deficit total for that product and outlet.
If the threshold is met or exceeded, override must be blocked.

---

## 15. Invoice History and Detail Rules

### 15.1 Required Routes

- `GET /invoices`
- `GET /invoices/:id`

### 15.2 Invoice List

Support filters:

- date range
- invoice number
- payment method
- GST type
- product name search

Default sort:

- newest first

Pagination:

- 20 per page

### 15.3 Invoice Detail

Return:

- invoice number
- created date/time
- business details
- GST details if applicable
- customer details
- payment method
- invoice items with snapshots
- totals
- GST invoice label

### 15.4 Read-Only Rule

Invoices are immutable in MVP 1.

No update, refund, or delete actions should exist unless explicitly defined by a future MVP.

---

## 16. Validation Rules Summary

### Authentication

- email required
- valid email format
- max 255 chars
- password min 8 chars
- password must contain at least one letter and one number

### Business and outlet

- required
- max 100 chars
- abbreviations 3–6 chars
- alphanumeric only
- uppercase normalization

### Product

- name required
- max 200 chars
- base price positive
- 2 decimal places max
- GST rate must be one of the allowed values
- opening stock integer >= 0
- deficit threshold integer >= 1

### Invoice

- at least 1 item
- each quantity integer >= 1
- no duplicate product IDs
- payment method required
- outlet must belong to authenticated tenant

### Stock update

- integer >= 0

### Deficits

- received quantity integer >= 1
- adjustment reason must be valid enum

### CSV import

- file type must be CSV
- max size 5 MB
- max rows 1000

---

## 17. Security Rules

### 17.1 Tenant Isolation

Every service method that queries data must scope by tenantId.

Never trust IDs from the client alone.

### 17.2 Authorization Guards

Use guards consistently:

- JWT guard for authenticated routes
- onboarding-complete guard where relevant
- tenant ownership checks for every tenant-owned entity

### 17.3 Password Storage

Passwords must be hashed.

### 17.4 Reset Token Storage

Store reset tokens hashed.

### 17.5 Refresh Token Security

Use HttpOnly cookies.
Use secure cookie settings in production.

### 17.6 Input Sanitization

Trim strings where appropriate.
Normalize abbreviations to uppercase.
Reject unexpected fields with whitelist validation.

---

## 18. Transaction and Concurrency Rules

### 18.1 Invoice Creation

Must be atomic and race-safe.

### 18.2 Counter Generation

Invoice numbers must not collide under concurrency.

### 18.3 Stock Deduction

Stock changes must not be lost in concurrent invoice creation.

### 18.4 Deficit Resolution

Deficit updates must be transaction-safe.

### 18.5 Idempotent Retry

Retries must not duplicate invoices.

### 18.6 MongoDB Practical Requirement

Use session-based transactions and unique indexes where appropriate.

Do not rely only on application-level checks.

---

## 19. Swagger / OpenAPI Requirements

Swagger documentation is mandatory for every API.

### 19.1 Controller-Level Requirements

Every controller must have:

- `@ApiTags`
- appropriate authentication decorators
- route-level summaries and descriptions
- clear status code documentation
- examples where useful

### 19.2 DTO-Level Requirements

Every DTO must be documented with:

- `@ApiProperty`
- example values
- required/optional markers
- enum descriptions where relevant

### 19.3 Response Documentation

Document:

- success responses
- validation errors
- 401/403/404/409 responses
- special stock insufficient responses
- idempotent replay responses

### 19.4 Consistency Rule

Use the same Swagger style already present in the existing CRUD APIs.

Do not introduce a second documentation pattern.

### 19.5 Important Routes to Fully Document

At minimum, fully document:

- auth routes
- onboarding routes
- product CRUD routes
- stock update route
- CSV import routes
- invoice finalize route
- invoice list/detail routes
- deficit routes
- settings routes

---

## 20. Code Organization and Best Practices

### 20.1 File Structure

Use clean feature-based structure, for example:

- `auth/`
- `products/`
- `invoices/`
- `deficits/`
- `settings/`
- `onboarding/`
- `stock/`
- `common/`

### 20.2 DTO Separation

Keep DTOs in dedicated files.

Do not place request validation logic directly inside controllers.

### 20.3 Shared Utilities

Create reusable utilities for:

- abbreviation generation
- IST date formatting
- invoice number formatting
- CSV parsing helpers
- response mapping
- tenant scope checks
- money rounding logic

### 20.4 No Duplication

Do not repeat logic across modules.
If two modules need the same rule, create a shared utility or service.

### 20.5 Naming

Use descriptive names.

Examples:

- `createInvoiceTxn`
- `resolvePendingDeficits`
- `generateDailyInvoiceNumber`
- `validateTenantScope`

### 20.6 Thin Controllers

Controllers should stay small and readable.

### 20.7 Service Boundaries

Each service should do one main job.

Avoid giant “god services”.

### 20.8 Explicit Return Types

Keep return shapes stable and predictable.

---

## 21. Global NestJS Setup Requirements

The backend should initialize with:

- Global validation pipe
- Global exception filter
- Global response logging where useful
- Swagger setup in the bootstrap
- CORS configured for the frontend
- Cookie parsing for refresh tokens
- Sensible request body size limits
- Timezone/date helpers aligned with IST business rules

---

## 22. Testing Requirements

The AI agent should implement tests for all core behaviors.

### Must test

- signup and login
- password reset flow
- onboarding completion
- product creation and edit rules
- soft delete and restore
- CSV import validation
- stock update logging
- invoice idempotency
- stock insufficiency conflict
- override blocked flow
- invoice number uniqueness
- deficit creation and resolution
- tenant isolation

### Test types

- unit tests for helpers and business rules
- service tests for core logic
- integration tests for important routes
- transaction-sensitive tests where practical

---

## 23. Error Handling Rules

All errors must be meaningful and consistent.

### Examples

- duplicate email
- invalid credentials
- invalid product IDs
- stock insufficient
- override blocked
- invalid or expired reset token
- unresolved deficits blocking deletion

### Error message style

Use concise, human-readable messages.

Do not leak sensitive internal details.

---

## 24. Acceptance Checklist

The backend is not complete until all of the following are true:

- All MVP 1 backend features are implemented
- All required routes exist
- Every route is validated and documented in Swagger
- Tenant isolation is enforced everywhere
- Auth and refresh flow works
- Password reset works
- Onboarding works
- Product CRUD works
- CSV import works
- Billing invoice finalization works with atomic transactions
- Deficit system works end to end
- Settings and GST toggle work
- Invoice history and details work
- Stock audit logs are created for every stock change
- The existing schema has been verified once against the MVP requirements
- No out-of-scope MVP 1 features were added

---

## 25. Final Instruction to the AI Agent

Build the backend exactly as defined by the MVP 1 requirements.

If anything in the current NestJS project or Mongo schema is missing, inconsistent, or named differently than the document, verify it once, then correct it before moving forward.

Do not guess. Do not improvise missing product behavior. Do not skip Swagger. Do not violate tenant isolation. Do not weaken transaction safety.

The backend must be stable, readable, modular, and ready for the frontend to consume.
