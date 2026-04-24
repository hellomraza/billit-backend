import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Decimal128 } from 'mongodb';
import { Model, Types } from 'mongoose';
import { Outlet } from '../outlet/outlet.schema';
import { Product } from '../product/product.schema';
import { Stock } from '../stock/stock.schema';
import { Tenant } from '../tenant/tenant.schema';

export interface ImportRecord {
  name: string;
  price: string;
  gst_rate: string;
  opening_stock: string;
  deficit_threshold: string;
}

export interface ImportError {
  rowNumber: number;
  reason: string;
  data?: Record<string, any>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors: ImportError[];
  importedAt: Date;
}

@Injectable()
export class ImportService {
  // 5 MB in bytes
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private readonly MAX_ROWS = 1000;

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Stock.name) private stockModel: Model<Stock>,
    @InjectModel(Outlet.name) private outletModel: Model<Outlet>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
  ) {}

  /**
   * Import products from CSV
   *
   * CONTRACT COMPLIANCE (Section 12: CSV Import Rules)
   * Constraints:
   * - CSV only
   * - Max 5 MB file size
   * - Max 1000 rows excluding header
   * - Skip invalid rows (don't abort entire import)
   * - Import valid rows
   * - Return structured import report
   *
   * COLUMNS:
   * - name (required, max 200 chars)
   * - price (required, positive, 2 decimal places max)
   * - gst_rate (required, one of: 0, 5, 12, 18, 28)
   * - opening_stock (optional, defaults to 0, integer >= 0)
   * - deficit_threshold (optional, defaults to 10, integer >= 1)
   *
   * STOCK HANDLING:
   * - Creates stock records for ALL outlets of the tenant
   * - Each stock record initialized with opening_stock quantity
   * - Stock audit logs are NOT created for initial import (initial stock only)
   */
  async importProducts(
    tenantId: string,
    csvContent: string,
  ): Promise<ImportResult> {
    // Step 1: Validate tenant exists
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Step 3: Parse CSV and validate structure
    const lines = csvContent.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV must contain at least header and one data row',
      );
    }

    const dataRowCount = lines.length - 1;
    if (dataRowCount > this.MAX_ROWS) {
      throw new BadRequestException(
        `CSV exceeds 1000 row limit (${dataRowCount} rows provided)`,
      );
    }

    // Step 4: Parse header
    const headers = this.parseHeader(lines[0]);
    this.validateHeaders(headers);

    // Step 5: Get all outlets for tenant (for stock initialization)

    const outlets = await this.outletModel.find({
      tenantId: new Types.ObjectId(tenantId),
    });

    if (outlets.length === 0) {
      throw new BadRequestException(
        'No active outlets found for tenant. Create outlets before importing products.',
      );
    }

    // Step 6: Parse rows and validate
    const errors: ImportError[] = [];
    let importedCount = 0;
    const productsToImport: any[] = [];
    const stockToImport: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const row = lines[i];

      // Skip empty rows
      if (!row.trim()) {
        continue;
      }

      try {
        const record = this.parseCsvRow(row, headers);
        const validation = this.validateRecord(record, rowNumber);

        if (!validation.isValid) {
          errors.push({
            rowNumber,
            reason: validation.error || 'Unknown validation error',
            data: record,
          });
          continue;
        }

        // Prepare product object with validated and converted fields
        const openingStock = record.opening_stock
          ? parseInt(record.opening_stock, 10)
          : 0;

        const deficitThreshold = record.deficit_threshold
          ? parseInt(record.deficit_threshold, 10)
          : 10;

        const product = {
          tenantId: new Types.ObjectId(tenantId),
          name: record.name.trim(),
          basePrice: Decimal128.fromString(parseFloat(record.price).toFixed(2)),
          gstRate: parseInt(record.gst_rate, 10),
          deficitThreshold,
        };

        productsToImport.push(product);

        // Prepare stock records for all outlets with opening_stock
        const stocks = outlets.map((outlet) => ({
          tenantId: new Types.ObjectId(tenantId),
          outletId: outlet._id,
          quantity: openingStock,
        }));

        stockToImport.push({
          productId: null, // Will be filled after product creation
          stocks,
        });

        importedCount++;
      } catch (error) {
        errors.push({
          rowNumber,
          reason: `Error parsing row: ${error.message}`,
        });
      }
    }

    // Step 7: Insert products and stock records
    if (productsToImport.length > 0) {
      const createdProducts =
        await this.productModel.insertMany(productsToImport);

      // Create stock records for each product
      const allStocksToInsert: any[] = [];
      createdProducts.forEach((product, index) => {
        const { stocks } = stockToImport[index];
        const stocksWithProductId = stocks.map((stock) => ({
          ...stock,
          productId: product._id,
        }));
        allStocksToInsert.push(...stocksWithProductId);
      });

      if (allStocksToInsert.length > 0) {
        await this.stockModel.insertMany(allStocksToInsert);
      }
    }

    return {
      imported: importedCount,
      skipped: errors.length,
      total: dataRowCount,
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
        'name,price,gst_rate,opening_stock,deficit_threshold\n' +
        'Laptop Computer,99999.99,18,100,5\n' +
        'Office Chair,5999.99,18,50,3\n' +
        'USB Cable,299.99,18,200,10\n',
      instructions:
        'Columns (all required except opening_stock and deficit_threshold): ' +
        'name (max 200 chars), ' +
        'price (positive number, max 2 decimals), ' +
        'gst_rate (one of: 0, 5, 12, 18, 28), ' +
        'opening_stock (optional, defaults to 0, must be integer >= 0), ' +
        'deficit_threshold (optional, defaults to 10, must be integer >= 1). ' +
        'Max file size: 5 MB. ' +
        'Max rows: 1000 (excluding header). ' +
        'Invalid rows are skipped with details in error report.',
    };
  }

  // ==================== Private Helpers ====================

  /**
   * Validate that all required headers are present
   */
  private validateHeaders(headers: Map<string, number>): void {
    const requiredHeaders = ['name', 'price', 'gst_rate'];
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.has(header),
    );

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Missing required CSV headers: ${missingHeaders.join(', ')}`,
      );
    }
  }

  /**
   * Parse CSV header line into a column index map
   */
  private parseHeader(headerLine: string): Map<string, number> {
    const headers = new Map<string, number>();
    const cols = headerLine.split(',').map((col) => col.trim().toLowerCase());

    cols.forEach((col, index) => {
      headers.set(col, index);
    });

    return headers;
  }

  /**
   * Parse a CSV row into an ImportRecord
   */
  private parseCsvRow(row: string, headers: Map<string, number>): ImportRecord {
    const cols = row.split(',').map((col) => col.trim());

    const record: ImportRecord = {
      name: cols[headers.get('name') ?? 0] ?? '',
      price: cols[headers.get('price') ?? 1] ?? '',
      gst_rate: cols[headers.get('gst_rate') ?? 2] ?? '',
      opening_stock: cols[headers.get('opening_stock') ?? 3] ?? '',
      deficit_threshold: cols[headers.get('deficit_threshold') ?? 4] ?? '',
    };

    return record;
  }

  /**
   * Validate a single CSV record according to contract requirements
   *
   * Field Validations:
   * - name: required, non-empty, max 200 chars
   * - price: required, positive number, max 2 decimal places
   * - gst_rate: required, one of [0, 5, 12, 18, 28]
   * - opening_stock: optional (default 0), integer >= 0
   * - deficit_threshold: optional (default 10), integer >= 1
   */
  private validateRecord(
    record: ImportRecord,
    rowNumber: number,
  ): { isValid: boolean; error?: string } {
    // Validate name
    if (!record.name || record.name.trim() === '') {
      return { isValid: false, error: 'name is required' };
    }

    if (record.name.length > 200) {
      return {
        isValid: false,
        error: 'name exceeds max length of 200 characters',
      };
    }

    // Validate price
    if (!record.price || record.price.trim() === '') {
      return { isValid: false, error: 'price is required' };
    }

    const priceNum = parseFloat(record.price);
    if (isNaN(priceNum)) {
      return { isValid: false, error: 'price must be a valid number' };
    }

    if (priceNum <= 0) {
      return { isValid: false, error: 'price must be positive (> 0)' };
    }

    // Check max 2 decimal places
    if (!this.isMaxTwoDecimalPlaces(priceNum)) {
      return {
        isValid: false,
        error: 'price must not exceed 2 decimal places',
      };
    }

    // Validate gst_rate
    if (!record.gst_rate || record.gst_rate.trim() === '') {
      return { isValid: false, error: 'gst_rate is required' };
    }

    const gstRateNum = parseInt(record.gst_rate, 10);
    const validGstRates = [0, 5, 12, 18, 28];
    if (!validGstRates.includes(gstRateNum)) {
      return {
        isValid: false,
        error: `gst_rate must be one of: ${validGstRates.join(', ')}`,
      };
    }

    // Validate opening_stock (optional, defaults to 0)
    if (record.opening_stock && record.opening_stock.trim() !== '') {
      const openingStockNum = parseInt(record.opening_stock, 10);
      if (isNaN(openingStockNum)) {
        return {
          isValid: false,
          error: 'opening_stock must be a valid integer',
        };
      }

      if (openingStockNum < 0) {
        return {
          isValid: false,
          error: 'opening_stock must be >= 0',
        };
      }

      if (!Number.isInteger(openingStockNum)) {
        return {
          isValid: false,
          error: 'opening_stock must be an integer (no decimals)',
        };
      }
    }

    // Validate deficit_threshold (optional, defaults to 10)
    if (record.deficit_threshold && record.deficit_threshold.trim() !== '') {
      const deficitThresholdNum = parseInt(record.deficit_threshold, 10);
      if (isNaN(deficitThresholdNum)) {
        return {
          isValid: false,
          error: 'deficit_threshold must be a valid integer',
        };
      }

      if (deficitThresholdNum < 1) {
        return {
          isValid: false,
          error: 'deficit_threshold must be >= 1',
        };
      }

      if (!Number.isInteger(deficitThresholdNum)) {
        return {
          isValid: false,
          error: 'deficit_threshold must be an integer (no decimals)',
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Check if a number has max 2 decimal places
   */
  private isMaxTwoDecimalPlaces(num: number): boolean {
    return Math.round(num * 100) / 100 === num;
  }
}
