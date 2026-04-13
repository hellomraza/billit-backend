import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    try {
      // Verify MongoDB connection
      if (this.connection.db) {
        await this.connection.db.admin().ping();
        this.logger.log('MongoDB connected successfully');
      }

      // Create all indexes
      await this.createIndexes();
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  private async createIndexes() {
    try {
      // Tenant indexes
      const tenantCollection = this.connection.collection('tenants');
      await tenantCollection.createIndex({ email: 1 }, { unique: true });
      this.logger.log('Tenant indexes created');

      // Outlet indexes
      const outletCollection = this.connection.collection('outlets');
      await outletCollection.createIndex({ tenantId: 1 });
      this.logger.log('Outlet indexes created');

      // Product indexes
      const productCollection = this.connection.collection('products');
      await productCollection.createIndex({ tenantId: 1, isDeleted: 1 });
      await productCollection.createIndex({ tenantId: 1, name: 'text' });
      this.logger.log('Product indexes created');

      // Stock indexes
      const stockCollection = this.connection.collection('stocks');
      await stockCollection.createIndex(
        { productId: 1, outletId: 1 },
        { unique: true },
      );
      await stockCollection.createIndex({ tenantId: 1 });
      this.logger.log('Stock indexes created');

      // Stock Audit Log indexes
      const stockAuditCollection = this.connection.collection('stockauditlogs');
      await stockAuditCollection.createIndex({ tenantId: 1, changedAt: -1 });
      await stockAuditCollection.createIndex({ productId: 1, outletId: 1 });
      this.logger.log('Stock Audit Log indexes created');

      // Invoice indexes
      const invoiceCollection = this.connection.collection('invoices');
      await invoiceCollection.createIndex({ tenantId: 1, createdAt: -1 });
      await invoiceCollection.createIndex(
        { tenantId: 1, invoiceNumber: 1 },
        { unique: true },
      );
      await invoiceCollection.createIndex(
        { tenantId: 1, clientGeneratedId: 1 },
        { unique: true },
      );
      await invoiceCollection.createIndex({ tenantId: 1, paymentMethod: 1 });
      await invoiceCollection.createIndex({ tenantId: 1, isGstInvoice: 1 });
      this.logger.log('Invoice indexes created');

      // Daily Counter indexes
      const counterCollection = this.connection.collection(
        'dailyinvoicecounters',
      );
      await counterCollection.createIndex(
        { outletId: 1, date: 1 },
        { unique: true },
      );
      this.logger.log('Daily Counter indexes created');

      // Deficit Record indexes
      const deficitCollection = this.connection.collection('deficitrecords');
      await deficitCollection.createIndex({
        tenantId: 1,
        productId: 1,
        outletId: 1,
        status: 1,
      });
      await deficitCollection.createIndex({ tenantId: 1, createdAt: -1 });
      this.logger.log('Deficit Record indexes created');

      // Password Reset Token indexes (TTL)
      const tokenCollection = this.connection.collection('passwordresettokens');
      await tokenCollection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      );
      this.logger.log('Password Reset Token indexes created');
    } catch (error) {
      this.logger.error('Failed to create indexes', error);
      throw error;
    }
  }

  /**
   * Start a MongoDB transaction session
   */
  async startSession(): Promise<ClientSession> {
    return this.connection.startSession();
  }

  /**
   * Start a transaction within a session
   */
  async startTransaction(session: ClientSession) {
    session.startTransaction();
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(session: ClientSession) {
    await session.commitTransaction();
  }

  /**
   * Abort a transaction
   */
  async abortTransaction(session: ClientSession) {
    await session.abortTransaction();
  }

  /**
   * End a session
   */
  async endSession(session: ClientSession) {
    await session.endSession();
  }

  /**
   * Execute operation within transaction
   */
  async executeInTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.startSession();
    try {
      this.startTransaction(session);
      const result = await operation(session);
      await this.commitTransaction(session);
      return result;
    } catch (error) {
      await this.abortTransaction(session);
      throw error;
    } finally {
      await this.endSession(session);
    }
  }

  /**
   * Get MongoDB connection
   */
  getConnection(): Connection {
    return this.connection;
  }
}
