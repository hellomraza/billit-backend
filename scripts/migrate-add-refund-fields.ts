import 'dotenv/config';
import mongoose from 'mongoose';
import { InvoiceSchema } from '../src/modules/invoice/invoice.schema';

/**
 * Migration: Add refund fields to Invoice schema
 * - Sets invoiceType = SALE for all existing invoices
 * - Sets originalInvoiceId = null for all existing invoices
 * - Sets refundReason = null for all existing invoices
 *
 * Run with: npx ts-node scripts/migrate-add-refund-fields.ts
 */

async function runMigration() {
  try {
    // Connect to MongoDB
    const mongoUrl =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/billit';
    await mongoose.connect(mongoUrl);

    const invoiceModel = mongoose.model('Invoice', InvoiceSchema);

    console.log('Starting migration: Add refund fields to Invoice...');

    // Update all existing invoices
    const result = await invoiceModel.updateMany(
      {}, // Match all documents
      {
        $set: {
          invoiceType: 'SALE',
          originalInvoiceId: null,
          refundReason: null,
        },
      }
    );

    console.log(`✓ Migration completed successfully!`);
    console.log(`  - Matched documents: ${result.matchedCount}`);
    console.log(`  - Modified documents: ${result.modifiedCount}`);

    // Verify migration by querying 5 invoices
    console.log('\nVerifying migration by checking 5 existing invoices:');
    const sampleInvoices = await invoiceModel.find({}).limit(5);

    if (sampleInvoices.length === 0) {
      console.log('  (No invoices found in database)');
    } else {
      sampleInvoices.forEach((invoice, index) => {
        console.log(
          `  Invoice ${index + 1}: invoiceNumber=${invoice.invoiceNumber}, invoiceType=${invoice.invoiceType}, originalInvoiceId=${invoice.originalInvoiceId}, refundReason=${invoice.refundReason}`
        );
      });
    }

    // Test querying by invoiceType
    const saleInvoiceCount = await invoiceModel.countDocuments({
      invoiceType: 'SALE',
    });
    console.log(`\n✓ Query test: Found ${saleInvoiceCount} SALE invoices`);

    const refundInvoiceCount = await invoiceModel.countDocuments({
      invoiceType: 'REFUND',
    });
    console.log(`✓ Query test: Found ${refundInvoiceCount} REFUND invoices`);

    await mongoose.disconnect();
    console.log('\n✓ Migration completed and database disconnected');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
