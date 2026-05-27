import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const Tenant = mongoose.model('TenantTest', new mongoose.Schema({}, { strict: false }), 'tenants');
  const User = mongoose.model('UserTest', new mongoose.Schema({}, { strict: false }), 'users');

  const tenant: any = await Tenant.findOne({});
  if (!tenant) throw new Error('No tenant found');
  const tenantId = tenant._id.toString();

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../src/app.module');
  const app = await NestFactory.createApplicationContext(AppModule);
  const { AnalyticsService } = require('../src/modules/analytics/analytics.service');
  const analyticsService = app.get(AnalyticsService);

  console.log('--- Testing top-products directly via AnalyticsService ---');
  const result = await analyticsService.getTopProducts(tenantId, 'last90days');
  console.log('Response:', JSON.stringify(result, null, 2));

  const { topProducts } = result;
  
  for (let i = 0; i < topProducts.length - 1; i++) {
    if (topProducts[i].netRevenue < topProducts[i+1].netRevenue) {
      throw new Error(`Sorting failed at rank ${i+1}`);
    }
  }
  
  let pctSum = 0;
  topProducts.forEach((p: any) => pctSum += p.percentOfTotal);
  console.log(`Top 10 Percentage sum: ${pctSum.toFixed(2)}% (should be <= 100%)`);
  if (pctSum > 100.1) throw new Error('Percentage sum exceeds 100%');
  
  console.log('✅ Top products logic verified successfully!');
  await app.close();

  await mongoose.disconnect();
}

run().catch(console.error);
