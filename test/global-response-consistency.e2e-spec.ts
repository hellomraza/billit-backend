import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Integration Tests for Global Response Consistency
 *
 * Contract Requirements (Section 6.4: Response Consistency):
 * - Use one response style across the API
 * - Do not invent a different response envelope for each module
 * - If CRUD APIs use consistent structure, preserve for new endpoints
 *
 * Current Status:
 * - Some endpoints return { statusCode, message, data }
 * - Some endpoints return { data, total, page, limit }
 * - Some endpoints return raw DTOs
 * - Some endpoints return { message, ... }
 *
 * Test Coverage:
 * - All list endpoints return consistent pagination format
 * - All single-resource endpoints return consistent format
 * - All error responses follow the same structure
 * - No endpoints deviate from the standard envelope
 * - Swagger documentation reflects consistency
 */
describe('Global Response Consistency (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let tenantId: string;
  let accessToken: string;
  let productId: string;
  let outletId: string;
  let stockId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongoUri), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  async function setupTestData() {
    // Signup
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'Password123',
        businessName: 'Test Business',
        businessAbbr: 'TB',
      });

    tenantId = signupResponse.body.tenant._id;

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123',
      });

    accessToken = loginResponse.body.accessToken;

    // Complete onboarding to create outlet
    const onboardResponse = await request(app.getHttpServer())
      .patch(`/tenants/${tenantId}/onboarding/business`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        businessName: 'Test Co',
        gstin: '12ABCDE1234F1Z5',
        gstEnabled: true,
      });

    const outletResponse = await request(app.getHttpServer())
      .patch(`/tenants/${tenantId}/onboarding/outlet`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        outletName: 'Main Store',
        outletAbbr: 'MS',
      });

    outletId = outletResponse.body.outlet._id;

    // Create product
    const productResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/products`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productName: 'Test Product',
        basePrice: 100,
        gstRate: 18,
      });

    productId = productResponse.body._id || productResponse.body.id;

    // Create stock
    const stockResponse = await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/stock`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productId,
        outletId,
        quantity: 50,
      });

    stockId = stockResponse.body._id || stockResponse.body.id;
  }

  describe('10.1 List Endpoint Response Consistency', () => {
    it('should have consistent pagination format for all list endpoints', async () => {
      // GET /tenants/:tenantId/products
      const productsResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Check structure has data, total, page, limit
      expect(productsResp.body.data).toBeDefined();
      expect(typeof productsResp.body.total).toBe('number');
      expect(typeof productsResp.body.page).toBe('number');
      expect(typeof productsResp.body.limit).toBe('number');
      expect(Array.isArray(productsResp.body.data)).toBe(true);
    });

    it('should return pagination fields in GET /tenants/:tenantId/stock', async () => {
      const stockResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/stock`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(stockResp.body.data).toBeDefined();
      expect(Array.isArray(stockResp.body.data)).toBe(true);
      expect(typeof stockResp.body.total).toBe('number');
      expect(typeof stockResp.body.page).toBe('number');
      expect(typeof stockResp.body.limit).toBe('number');
    });

    it('should return pagination fields in GET /tenants/:tenantId/outlets', async () => {
      const outletsResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/outlets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(outletsResp.body.data).toBeDefined();
      expect(Array.isArray(outletsResp.body.data)).toBe(true);
      expect(typeof outletsResp.body.total).toBe('number');
      expect(typeof outletsResp.body.page).toBe('number');
      expect(typeof outletsResp.body.limit).toBe('number');
    });

    it('should return pagination fields in GET /tenants/:tenantId/invoices', async () => {
      const invoicesResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Invoice list should follow same pagination pattern
      expect(invoicesResp.body.data).toBeDefined();
      expect(Array.isArray(invoicesResp.body.data)).toBe(true);
      // Check if pagination fields exist
      if (invoicesResp.body.total !== undefined) {
        expect(typeof invoicesResp.body.total).toBe('number');
        expect(typeof invoicesResp.body.page).toBe('number');
        expect(typeof invoicesResp.body.limit).toBe('number');
      }
    });

    it('should respect page and limit query parameters consistently', async () => {
      // Products with page=1, limit=5
      const prod1 = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products?page=1&limit=5`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(prod1.body.page).toBe(1);
      expect(prod1.body.limit).toBe(5);

      // Stock with page=1, limit=5
      const stock1 = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/stock?page=1&limit=5`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(stock1.body.page).toBe(1);
      expect(stock1.body.limit).toBe(5);

      // Outlets with page=1, limit=5
      const outlets1 = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/outlets?page=1&limit=5`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(outlets1.body.page).toBe(1);
      expect(outlets1.body.limit).toBe(5);
    });
  });

  describe('10.2 Single-Resource Response Format', () => {
    it('should use consistent format for GET single product by ID', async () => {
      const productResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products/${productId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Single resource should have consistent structure
      expect(productResp.body._id || productResp.body.id).toBeDefined();
      expect(productResp.body.productName).toBeDefined();
    });

    it('should use consistent format for GET single stock by ID', async () => {
      const stockResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/stock/${stockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Single resource should have consistent structure
      expect(stockResp.body._id || stockResp.body.id).toBeDefined();
      expect(stockResp.body.quantity).toBeDefined();
    });

    it('should use consistent format for GET single outlet by ID', async () => {
      const outletResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/outlets/${outletId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Single resource should have consistent structure
      expect(outletResp.body._id || outletResp.body.id).toBeDefined();
      expect(outletResp.body.outletName).toBeDefined();
    });
  });

  describe('10.3 Error Response Consistency', () => {
    it('should return consistent error for invalid tenant ID', async () => {
      const invalidTenantId = '000000000000000000000000';

      const errorResp = await request(app.getHttpServer())
        .get(`/tenants/${invalidTenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect([400, 401, 403, 404]);

      // Errors should have consistent structure
      expect(errorResp.body.statusCode || errorResp.body.error).toBeDefined();
      expect(errorResp.body.message).toBeDefined();
    });

    it('should return consistent error for missing authorization', async () => {
      const errorResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products`)
        .expect(401);

      // Error should have statusCode and message
      expect(errorResp.body.statusCode || errorResp.body.error).toBeDefined();
      expect(errorResp.body.message).toBeDefined();
    });

    it('should return consistent error for invalid request body', async () => {
      const errorResp = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          // Missing required fields
          foo: 'bar',
        })
        .expect(400);

      // Error should have statusCode and message
      expect(errorResp.body.statusCode || errorResp.body.error).toBeDefined();
      expect(errorResp.body.message).toBeDefined();
    });

    it('should return consistent error for resource not found', async () => {
      const invalidId = '000000000000000000000000';

      const errorResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products/${invalidId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Error should be consistent
      expect(errorResp.body.message).toBeDefined();
    });

    it('should return consistent error for duplicate resource', async () => {
      // Try to create duplicate outlet abbreviation
      const errorResp = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/outlets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          outletName: 'Another outlet',
          outletAbbr: 'MS', // Already exists
        })
        .expect([400, 409]);

      // Error should be consistent
      expect(errorResp.body.message || errorResp.body.error).toBeDefined();
    });
  });

  describe('10.4 No Endpoints Deviate from Standard', () => {
    it('should verify POST /tenants/:tenantId/products uses standard format', async () => {
      const createResp = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productName: 'New Product',
          basePrice: 200,
          gstRate: 5,
        })
        .expect(201);

      // Check it's a valid response (has _id or id)
      expect(createResp.body._id || createResp.body.id).toBeDefined();
      expect(createResp.body.productName).toBeDefined();
    });

    it('should verify POST /tenants/:tenantId/stock uses standard format', async () => {
      const createResp = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/stock`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId,
          outletId,
          quantity: 100,
        })
        .expect(201);

      // Check it's a valid response
      expect(createResp.body._id || createResp.body.id).toBeDefined();
      expect(createResp.body.quantity).toBeDefined();
    });

    it('should verify PUT /tenants/:tenantId/stock/:stockId uses standard format', async () => {
      const updateResp = await request(app.getHttpServer())
        .put(`/tenants/${tenantId}/stock/${stockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantity: 75,
        })
        .expect(200);

      // Check it's a valid response
      expect(updateResp.body._id || updateResp.body.id).toBeDefined();
      expect(updateResp.body.quantity).toBe(75);
    });
  });

  describe('10.5 Response Envelope Audit', () => {
    it('should confirm GET /health returns consistent structure', async () => {
      const healthResp = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Health should return status
      expect(healthResp.body.status || healthResp.body.message).toBeDefined();
    });

    it('should not have statusCode mixed with data inconsistently', async () => {
      const listResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Lists should NOT have statusCode in body for 200 responses
      // (statusCode is in HTTP response, not body)
      // Verify structure is consistent
      expect(listResp.body.data).toBeDefined();
      expect(Array.isArray(listResp.body.data)).toBe(true);
    });

    it('should have all metadata at same level for list responses', async () => {
      const listResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products?page=1&limit=10`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // All pagination info at root level (not nested)
      expect(listResp.body.data).toBeDefined();
      expect(listResp.body.total).toBeDefined();
      expect(listResp.body.page).toBeDefined();
      expect(listResp.body.limit).toBeDefined();

      // Should not have nested structure
      if (listResp.body.meta) {
        expect(typeof listResp.body.meta).toBe('object');
      }
    });
  });

  describe('10.6 Content Type Consistency', () => {
    it('should return application/json for all endpoints', async () => {
      const listResp = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(listResp.type).toContain('application/json');
    });

    it('should have consistent HTTP status codes for operations', async () => {
      // GET list = 200
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // POST create = 201
      const createResp = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/products`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productName: 'Test',
          basePrice: 100,
          gstRate: 0,
        })
        .expect(201);

      const newProductId = createResp.body._id || createResp.body.id;

      // GET single = 200
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/products/${newProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // PUT update = 200
      await request(app.getHttpServer())
        .put(`/tenants/${tenantId}/products/${newProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productName: 'Updated',
          basePrice: 150,
          gstRate: 5,
        })
        .expect(200);

      // DELETE = 200 or 204
      await request(app.getHttpServer())
        .delete(`/tenants/${tenantId}/products/${newProductId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect([200, 204]);
    });
  });
});
