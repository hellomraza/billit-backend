import 'dotenv/config';
import mongoose from 'mongoose';

import { UserSchema } from '../src/modules/auth/entities/user.entity';
import { RefreshSessionSchema } from '../src/modules/auth/refresh-session.schema';
import { DailyInvoiceCounterSchema } from '../src/modules/daily-counter/daily-counter.schema';
import { DeficitRecordSchema } from '../src/modules/deficit/deficit.schema';
import { DraftSchema } from '../src/modules/draft/draft.schema';
import { InvoiceSchema } from '../src/modules/invoice/invoice.schema';
import { OutletSchema } from '../src/modules/outlet/outlet.schema';
import { PasswordResetTokenSchema } from '../src/modules/password-reset/password-reset.schema';
import { ProductSchema } from '../src/modules/product/product.schema';
import { StockAuditLogSchema } from '../src/modules/stock-audit/stock-audit.schema';
import { StockSchema } from '../src/modules/stock/stock.schema';
import { TenantSchema } from '../src/modules/tenant/tenant.schema';

const SCHEMAS: Array<{ name: string; schema: any }> = [
  { name: 'Tenant', schema: TenantSchema },
  { name: 'User', schema: UserSchema },
  { name: 'RefreshSession', schema: RefreshSessionSchema },
  { name: 'PasswordResetToken', schema: PasswordResetTokenSchema },
  { name: 'Draft', schema: DraftSchema },
  { name: 'Stock', schema: StockSchema },
  { name: 'Invoice', schema: InvoiceSchema },
  { name: 'DailyInvoiceCounter', schema: DailyInvoiceCounterSchema },
  { name: 'Product', schema: ProductSchema },
  { name: 'DeficitRecord', schema: DeficitRecordSchema },
  { name: 'StockAuditLog', schema: StockAuditLogSchema },
  { name: 'Outlet', schema: OutletSchema },
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI environment variable is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  // Ensure indexes for every schema
  await Promise.all(
    SCHEMAS.map(async ({ name, schema }) => {
      try {
        const model = mongoose.model(name, schema);
        await model.createIndexes();
        console.log(`Indexes created for ${name}`);
      } catch (err) {
        console.error(`Failed to ensure indexes for ${name}:`, err);
        throw err;
      }
    }),
  );

  console.log('All indexes ensured.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
