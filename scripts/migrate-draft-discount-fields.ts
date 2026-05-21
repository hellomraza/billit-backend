import 'dotenv/config';
import mongoose from 'mongoose';
import { DiscountType } from '../src/modules/invoice/invoice.schema';

/**
 * Migration: Add discount fields to Draft schema
 * 
 * Run with: npx ts-node scripts/migrate-draft-discount-fields.ts
 */
async function runMigration() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/billit';
    const conn = await mongoose.connect(mongoUrl);
    const db = conn.connection.getClient().db(conn.connection.name);

    const draftCollection = db.collection('drafts');

    console.log('Starting migration: Add discount fields to Draft...\n');

    // Add draft root fields and update items array elements
    const result = await draftCollection.updateMany(
      {}, // Match all drafts
      [
        {
          $set: {
            billDiscountType: {
              $ifNull: ['$billDiscountType', DiscountType.NONE],
            },
            billDiscountValue: {
              $ifNull: ['$billDiscountValue', 0],
            },
            items: {
              $map: {
                input: { $ifNull: ['$items', []] },
                as: 'item',
                in: {
                  productId: '$$item.productId',
                  productName: '$$item.productName',
                  quantity: '$$item.quantity',
                  unitPrice: '$$item.unitPrice',
                  gstRate: '$$item.gstRate',
                  itemDiscountType: {
                    $ifNull: ['$$item.itemDiscountType', DiscountType.NONE],
                  },
                  itemDiscountValue: {
                    $ifNull: ['$$item.itemDiscountValue', 0],
                  },
                },
              },
            },
          },
        },
      ],
    );

    console.log(`✓ Migration completed!`);
    console.log(`  - Matched documents: ${result.matchedCount}`);
    console.log(`  - Modified documents: ${result.modifiedCount}`);

    await mongoose.disconnect();
    console.log('\n✓ Database disconnected');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
