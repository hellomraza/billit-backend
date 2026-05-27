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

  console.log('--- Testing payment-breakdown directly via AnalyticsService ---');
  const result = await analyticsService.getPaymentBreakdown(tenantId, 'last90days');
  console.log('Response:', JSON.stringify(result, null, 2));

  const { paymentBreakdown, totalInvoices, totalAmount } = result;

  // Verify all payment methods are present
  const methods = paymentBreakdown.map((item: any) => item.paymentMethod);
  if (!methods.includes('CASH') || !methods.includes('CARD') || !methods.includes('UPI')) {
    throw new Error('Verification failed: CASH, CARD, and UPI must all be present.');
  }

  // Verify percentage calculations
  let pctSum = 0;
  let computedTotalInvoices = 0;
  let computedTotalAmount = 0;

  paymentBreakdown.forEach((item: any) => {
    pctSum += item.percentage;
    computedTotalInvoices += item.invoiceCount;
    computedTotalAmount += item.totalAmount;
  });

  console.log(`Computed total invoices: ${computedTotalInvoices}, reported total: ${totalInvoices}`);
  console.log(`Computed total amount: ${computedTotalAmount.toFixed(2)}, reported total: ${totalAmount.toFixed(2)}`);
  console.log(`Percentage sum: ${pctSum.toFixed(2)}%`);

  if (computedTotalInvoices !== totalInvoices) {
    throw new Error(`Inconsistent totalInvoices. Computed: ${computedTotalInvoices}, Reported: ${totalInvoices}`);
  }

  if (Math.abs(computedTotalAmount - totalAmount) > 0.05) {
    throw new Error(`Inconsistent totalAmount. Computed: ${computedTotalAmount}, Reported: ${totalAmount}`);
  }

  if (totalInvoices > 0 && Math.abs(pctSum - 100) > 0.1) {
    throw new Error(`Percentage sum must be exactly 100% when there are invoices, got ${pctSum.toFixed(2)}%`);
  }

  console.log('✅ Payment method breakdown logic verified successfully!');
  await app.close();
  await mongoose.disconnect();
}

run().catch(console.error);
