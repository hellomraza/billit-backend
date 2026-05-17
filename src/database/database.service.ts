import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection, ConnectionStates } from 'mongoose';

let isConnected = false;

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    if (isConnected) {
      this.logger.log('Reusing existing MongoDB connection');
      return;
    }

    try {
      await this.waitForConnection();
      isConnected = true;
      this.logger.log('MongoDB connected successfully');
      await this.createIndexes(); // ✅ always run — createIndex is idempotent
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  private async waitForConnection(): Promise<void> {
    if (this.connection.readyState === ConnectionStates.connected) return;

    return new Promise((resolve, reject) => {
      this.connection.once('connected', resolve);
      this.connection.once('error', reject);
    });
  }

  private async createIndexes() {
    try {
      // Tenant indexes
      const tenantCollection = this.connection.collection('tenants');
      await tenantCollection.createIndex(
        { email: 1 },
        { unique: true, background: true },
      );
      this.logger.log('Tenant indexes created');

      // Outlet indexes
      const outletCollection = this.connection.collection('outlets');
      await outletCollection.createIndex({ tenantId: 1 }, { background: true });
      this.logger.log('Outlet indexes created');

      // Product indexes
      const productCollection = this.connection.collection('products');
      await productCollection.createIndex(
        { tenantId: 1, isDeleted: 1 },
        { background: true },
      );
      await productCollection.createIndex(
        { tenantId: 1, name: 'text' },
        { background: true },
      );
      this.logger.log('Product indexes created');

      // Stock indexes
      const stockCollection = this.connection.collection('stocks');
      await stockCollection.createIndex(
        { productId: 1, outletId: 1 },
        { unique: true, background: true },
      );
      await stockCollection.createIndex({ tenantId: 1 }, { background: true });
      this.logger.log('Stock indexes created');

      // Stock Audit Log indexes
      const stockAuditCollection = this.connection.collection('stockauditlogs');
      await stockAuditCollection.createIndex(
        { tenantId: 1, changedAt: -1 },
        { background: true },
      );
      await stockAuditCollection.createIndex(
        { productId: 1, outletId: 1 },
        { background: true },
      );
      this.logger.log('Stock Audit Log indexes created');

      // Invoice indexes
      const invoiceCollection = this.connection.collection('invoices');
      await invoiceCollection.createIndex(
        { tenantId: 1, createdAt: -1 },
        { background: true },
      );
      await invoiceCollection.createIndex(
        { tenantId: 1, invoiceNumber: 1 },
        { unique: true, background: true },
      );
      await invoiceCollection.createIndex(
        { tenantId: 1, clientGeneratedId: 1 },
        { unique: true, background: true },
      );
      await invoiceCollection.createIndex(
        { tenantId: 1, paymentMethod: 1 },
        { background: true },
      );
      await invoiceCollection.createIndex(
        { tenantId: 1, isGstInvoice: 1 },
        { background: true },
      );
      this.logger.log('Invoice indexes created');

      // Daily Counter indexes
      const counterCollection = this.connection.collection(
        'dailyinvoicecounters',
      );
      await counterCollection.createIndex(
        { outletId: 1, date: 1 },
        { unique: true, background: true },
      );
      this.logger.log('Daily Counter indexes created');

      // Deficit Record indexes
      const deficitCollection = this.connection.collection('deficitrecords');
      await deficitCollection.createIndex(
        {
          tenantId: 1,
          productId: 1,
          outletId: 1,
          status: 1,
        },
        { background: true },
      );
      await deficitCollection.createIndex(
        { tenantId: 1, createdAt: -1 },
        { background: true },
      );
      this.logger.log('Deficit Record indexes created');

      // Password Reset Token indexes (TTL)
      const tokenCollection = this.connection.collection('passwordresettokens');
      await tokenCollection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, background: true },
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

  async executeInTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.startSession();
    let result: T;
    try {
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result!;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get MongoDB connection
   */
  getConnection(): Connection {
    return this.connection;
  }
}
