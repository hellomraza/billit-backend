import 'dotenv/config';
import mongoose from 'mongoose';
import { InvoiceSchema, DiscountType, InvoiceType } from '../src/modules/invoice/invoice.schema';

/**
 * Migration: Add refund and discount fields to Invoice schema
 * Phase 1 (Refund fields):
 *   - Sets invoiceType = SALE for all existing invoices
 *   - Sets originalInvoiceId = null for all existing invoices
 *   - Sets refundReason = null for all existing invoices
 * 
 * Phase 2 (Discount fields):
 *   - Sets billDiscountType = NONE, billDiscountValue = 0, billDiscountAmount = 0
 *   - Adds discount fields to each item in the items array
 *
 * Run with: npx ts-node scripts/migrate-add-refund-fields.ts
 */

async function runMigration() {
  try {
    // Connect to MongoDB
    const mongoUrl =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/billit';
    const conn = await mongoose.connect(mongoUrl);
    const db = conn.connection.getClient().db(conn.connection.name);

    const invoiceCollection = db.collection('invoices');

    console.log('Starting migration: Add refund and discount fields to Invoice...\n');

    // Phase 1: Add refund fields and bill discount fields
    console.log('Phase 1: Adding refund and bill discount fields to root level...');
    const result1 = await invoiceCollection.updateMany(
      {}, // Match all documents
      {
        $set: {
          invoiceType: InvoiceType.SALE,
          originalInvoiceId: null,
          refundReason: null,
          billDiscountType: DiscountType.NONE,
          billDiscountValue: 0,
          billDiscountAmount: 0,
        },
      }
    );

    console.log(`✓ Phase 1 completed!`);
    console.log(`  - Matched documents: ${result1.matchedCount}`);
    console.log(`  - Modified documents: ${result1.modifiedCount}`);

    // Phase 2: Add item-level discount fields using aggregation pipeline
    console.log('\nPhase 2: Adding item-level discount fields to all items...');
    
    const result2 = await invoiceCollection.updateMany(
      {}, // Match all documents
      [
        {
          $set: {
            items: {
              $map: {
                input: '$items',
                as: 'item',
                in: {
                  productId: '$$item.productId',
                  productName: '$$item.productName',
                  quantity: '$$item.quantity',
                  unitPrice: '$$item.unitPrice',
                  gstRate: '$$item.gstRate',
                  gstAmount: '$$item.gstAmount',
                  lineTotal: '$$item.lineTotal',
                  overridden: { $ifNull: ['$$item.overridden', false] },
                  itemDiscountType: {
                    $ifNull: ['$$item.itemDiscountType', DiscountType.NONE]
                  },
                  itemDiscountValue: {
                    $ifNull: ['$$item.itemDiscountValue', 0]
                  },
                  itemDiscountAmount: {
                    $ifNull: ['$$item.itemDiscountAmount', 0]
                  },
                },
              },
            },
          },
        },
      ]
    );

    console.log(`✓ Phase 2 completed!`);
    console.log(`  - Matched documents: ${result2.matchedCount}`);
    console.log(`  - Modified documents: ${result2.modifiedCount}`);

    // Verify migration by querying 5 invoices and checking all fields
    console.log('\nVerifying migration by checking 5 existing invoices:');
    const sampleInvoices = await invoiceCollection.find({}).limit(5).toArray();

    if (sampleInvoices.length === 0) {
      console.log('  (No invoices found in database)');
    } else {
      sampleInvoices.forEach((invoice: any, index: number) => {
        console.log(
          `\n  Invoice ${index + 1}: ${invoice.invoiceNumber}`
        );
        console.log(
          `    Refund fields: invoiceType=${invoice.invoiceType}, originalInvoiceId=${invoice.originalInvoiceId}, refundReason=${invoice.refundReason}`
        );
        console.log(
          `    Bill discount: type=${invoice.billDiscountType}, value=${invoice.billDiscountValue}, amount=${invoice.billDiscountAmount}`
        );
        console.log(`    Items: ${invoice.items?.length || 0} total`);
        
        if (invoice.items && invoice.items.length > 0) {
          // Show first 3 items
          invoice.items.slice(0, 3).forEach((item: any, itemIndex: number) => {
            console.log(
              `      Item ${itemIndex + 1} (${item.productName}): type=${item.itemDiscountType}, value=${item.itemDiscountValue}, amount=${item.itemDiscountAmount}`
            );
          });
          if (invoice.items.length > 3) {
            console.log(`      ... and ${invoice.items.length - 3} more items`);
          }
        }
      });
    }

    // Test querying by invoiceType
    const saleInvoiceCount = await invoiceCollection.countDocuments({
      invoiceType: InvoiceType.SALE,
    });
    console.log(`\n✓ Query test: Found ${saleInvoiceCount} SALE invoices`);

    const refundInvoiceCount = await invoiceCollection.countDocuments({
      invoiceType: InvoiceType.REFUND,
    });
    console.log(`✓ Query test: Found ${refundInvoiceCount} REFUND invoices`);

    // Test querying by billDiscountType
    const noneDiscountCount = await invoiceCollection.countDocuments({
      billDiscountType: DiscountType.NONE,
    });
    console.log(`✓ Query test: Found ${noneDiscountCount} invoices with NONE bill discount`);

    // Verify no invoices are missing item discount fields
    console.log('\nVerifying item discount fields completeness...');
    const invoicesToCheck = await invoiceCollection.find({}).toArray();
    let missingFields = 0;
    let totalItems = 0;

    for (const invoice of invoicesToCheck) {
      if (invoice.items && Array.isArray(invoice.items)) {
        for (const item of invoice.items) {
          totalItems++;
          if (!item.itemDiscountType || item.itemDiscountValue === undefined || item.itemDiscountAmount === undefined) {
            missingFields++;
          }
        }
      }
    }

    console.log(`✓ Checked ${totalItems} items across ${invoicesToCheck.length} invoices`);
    console.log(`  - Items with complete discount fields: ${totalItems - missingFields} / ${totalItems}`);

    await mongoose.disconnect();
    console.log('\n✓ Migration completed and database disconnected');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
