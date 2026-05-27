import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  const Tenant = mongoose.model('TenantTest', new mongoose.Schema({}, { strict: false }), 'tenants');
  const tenant: any = await Tenant.findOne({});
  if (!tenant) throw new Error('No tenant found');
  const tenantId = tenant._id.toString();

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../src/app.module');
  const app = await NestFactory.createApplicationContext(AppModule);
  const { AnalyticsService } = require('../src/modules/analytics/analytics.service');
  const analyticsService = app.get(AnalyticsService);

  console.log('--- Testing gst-summary directly via AnalyticsService ---');
  const result = await analyticsService.getGstSummary(tenantId, 'last90days');
  console.log('Response:', JSON.stringify(result, null, 2));

  const { totalGstCollected, gstInvoiceCount, nonGstInvoiceCount, hasGstData } = result;

  // Assert type check
  if (typeof totalGstCollected !== 'number' || isNaN(totalGstCollected)) {
    throw new Error('Verification failed: totalGstCollected must be a valid number.');
  }

  if (typeof gstInvoiceCount !== 'number' || isNaN(gstInvoiceCount)) {
    throw new Error('Verification failed: gstInvoiceCount must be a valid number.');
  }

  if (typeof nonGstInvoiceCount !== 'number' || isNaN(nonGstInvoiceCount)) {
    throw new Error('Verification failed: nonGstInvoiceCount must be a valid number.');
  }

  if (typeof hasGstData !== 'boolean') {
    throw new Error('Verification failed: hasGstData must be a boolean.');
  }

  // Assert correctness of hasGstData
  const expectedHasGstData = totalGstCollected > 0 || gstInvoiceCount > 0;
  if (hasGstData !== expectedHasGstData) {
    throw new Error(`Verification failed: hasGstData is ${hasGstData} but expected ${expectedHasGstData}`);
  }

  console.log('✅ GST Summary endpoint logic verified successfully!');
  await app.close();
  await mongoose.disconnect();
}

run().catch(console.error);
