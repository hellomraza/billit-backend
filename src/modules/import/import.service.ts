import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../product/product.schema';
import { Tenant } from '../tenant/tenant.schema';

export interface ImportRecord {
  name: string;
  sku: string;
  category?: string;
  unit?: string;
  price?: string;
  quantity?: string;
}

export interface ImportError {
  rowNumber: number;
  reason: string;
}

@Injectable()
export class ImportService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
  ) {}

  /**
   * Import products from CSV
   */
  async importProducts(tenantId: string, csvContent: string) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Parse CSV and validate
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV must contain at least one data row');
    }

    // Check file size constraint (assuming ~100 bytes per row)
    if (lines.length > 1001) {
      throw new BadRequestException('CSV exceeds maximum of 1000 data rows');
    }

    // Parse header
    const headers = this.parseHeader(lines[0]);

    // Parse rows and track errors
    const errors: ImportError[] = [];
    let successfulRows = 0;
    const productsToImport: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const row = lines[i];

      // Skip empty rows
      if (!row.trim()) continue;

      try {
        const record = this.parseCsvRow(row, headers);
        const validation = this.validateRecord(record, rowNumber);

        if (!validation.isValid) {
          errors.push({
            rowNumber,
            reason: validation.error || 'Unknown error',
          });
          continue;
        }

        // Check if product with this SKU already exists
        const existing = await this.productModel.findOne({
          tenantId,
          sku: record.sku,
        });

        if (existing) {
          errors.push({
            rowNumber,
            reason: `SKU '${record.sku}' already exists`,
          });
          continue;
        }

        // Prepare product object
        const product = {
          tenantId: new Types.ObjectId(tenantId),
          name: record.name,
          sku: record.sku,
          category: record.category || '',
          unit: record.unit || 'pieces',
          price: record.price ? parseFloat(record.price) : 0,
          quantity: record.quantity ? parseInt(record.quantity, 10) : 0,
        };

        productsToImport.push(product);
        successfulRows++;
      } catch (error) {
        errors.push({
          rowNumber,
          reason: `Error parsing row: ${error.message}`,
        });
      }
    }

    // Insert successful products
    if (productsToImport.length > 0) {
      await this.productModel.insertMany(productsToImport);
    }

    return {
      totalRows: lines.length - 1,
      successfulRows,
      failedRows: errors.length,
      errors,
      importedAt: new Date(),
    };
  }

  /**
   * Get CSV template for product import
   */
  getTemplate() {
    return {
      template:
        'name,sku,category,unit,price,quantity\n' +
        'Sample Product,SKU-001,Electronics,pieces,99.99,100\n' +
        'Another Product,SKU-002,Clothing,units,49.99,50\n',
      instructions:
        'Columns: ' +
        'name (required, max 100 chars), ' +
        'sku (required, unique, max 50 chars), ' +
        'category (optional, max 50 chars), ' +
        'unit (optional, default "pieces"), ' +
        'price (optional, numeric), ' +
        'quantity (optional, integer). ' +
        'Maximum 1000 rows allowed. ' +
        'Invalid rows are skipped.',
    };
  }

  // ==================== Private Helpers ====================

  private parseHeader(headerLine: string): Map<string, number> {
    const headers = new Map<string, number>();
    const cols = headerLine.split(',').map((col) => col.trim().toLowerCase());

    cols.forEach((col, index) => {
      headers.set(col, index);
    });

    return headers;
  }

  private parseCsvRow(row: string, headers: Map<string, number>): ImportRecord {
    // Simple CSV parser (doesn't handle quoted commas)
    const cols = row.split(',').map((col) => col.trim());

    const record: ImportRecord = {
      name: cols[headers.get('name') || 0] || '',
      sku: cols[headers.get('sku') || 1] || '',
      category: cols[headers.get('category') || 2],
      unit: cols[headers.get('unit') || 3],
      price: cols[headers.get('price') || 4],
      quantity: cols[headers.get('quantity') || 5],
    };

    return record;
  }

  private validateRecord(
    record: ImportRecord,
    rowNumber: number,
  ): { isValid: boolean; error?: string } {
    // Validate required fields
    if (!record.name || record.name.trim() === '') {
      return { isValid: false, error: 'Missing required field: name' };
    }

    if (!record.sku || record.sku.trim() === '') {
      return { isValid: false, error: 'Missing required field: sku' };
    }

    if (record.name.length > 100) {
      return { isValid: false, error: 'name exceeds max length of 100' };
    }

    if (record.sku.length > 50) {
      return { isValid: false, error: 'sku exceeds max length of 50' };
    }

    if (record.category && record.category.length > 50) {
      return { isValid: false, error: 'category exceeds max length of 50' };
    }

    // Validate numeric fields
    if (record.price && isNaN(parseFloat(record.price))) {
      return { isValid: false, error: 'price must be a valid number' };
    }

    if (record.quantity && isNaN(parseInt(record.quantity, 10))) {
      return { isValid: false, error: 'quantity must be a valid integer' };
    }

    return { isValid: true };
  }
}
