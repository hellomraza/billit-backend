/**
 * Helper for abbreviation operations
 */
export class AbbreviationHelper {
  /**
   * Normalize abbreviation (convert to uppercase, remove spaces)
   */
  static normalize(abbreviation: string): string {
    return abbreviation.toUpperCase().trim().replace(/\s+/g, '');
  }

  /**
   * Validate abbreviation format (2-10 uppercase alphanumeric)
   */
  static validate(abbreviation: string): boolean {
    const pattern = /^[A-Z0-9]{2,10}$/;
    return pattern.test(abbreviation);
  }

  /**
   * Format abbreviation for display
   */
  static format(abbreviation: string): string {
    const normalized = this.normalize(abbreviation);
    return normalized.substring(0, 10);
  }

  /**
   * Generate abbreviation from name (first letters of each word)
   */
  static generate(name: string): string {
    const words = name.trim().split(/\s+/);
    const abbr = words
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 10);
    return abbr.length >= 2 ? abbr : name.substring(0, 10).toUpperCase();
  }
}

/**
 * Helper for money/currency operations
 */
export class MoneyHelper {
  private static readonly DECIMAL_PLACES = 2;

  /**
   * Round amount to 2 decimal places (paisa precision)
   */
  static round(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Calculate GST amount based on rate and amount (without GST)
   */
  static calculateGst(amountWithoutGst: number, gstRate: number): number {
    const gstAmount = (amountWithoutGst * gstRate) / 100;
    return this.round(gstAmount);
  }

  /**
   * Calculate line total (quantity * unit price, with optional discount)
   */
  static calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discountPercent: number = 0,
  ): number {
    const subtotal = quantity * unitPrice;
    const discount = (subtotal * discountPercent) / 100;
    return this.round(subtotal - discount);
  }

  /**
   * Calculate total with GST
   */
  static calculateTotalWithGst(
    amountWithoutGst: number,
    gstRate: number,
  ): number {
    const gst = this.calculateGst(amountWithoutGst, gstRate);
    return this.round(amountWithoutGst + gst);
  }

  /**
   * Parse money string to number (e.g., "₹100.50" -> 100.50)
   */
  static parse(moneyString: string): number {
    const cleanedString = moneyString.replace(/[^\d.-]/g, '').trim();
    const parsed = parseFloat(cleanedString);
    return isNaN(parsed) ? 0 : this.round(parsed);
  }

  /**
   * Format number as INR currency string
   */
  static format(amount: number, includeSymbol: boolean = true): string {
    const rounded = this.round(amount);
    const formatted = rounded.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return includeSymbol ? `₹${formatted}` : formatted;
  }
}

/**
 * Helper for timezone operations (India Standard Time)
 */
export class TimezoneHelper {
  private static readonly IST_OFFSET = 5.5; // IST is UTC+5:30
  private static readonly IST_TIMEZONE = 'Asia/Kolkata';

  /**
   * Get current time in IST
   */
  static getCurrentISTDate(): Date {
    return new Date(
      new Date().toLocaleString('en-US', { timeZone: this.IST_TIMEZONE }),
    );
  }

  /**
   * Convert UTC date to IST
   */
  static convertToIST(utcDate: Date): Date {
    return new Date(
      utcDate.toLocaleString('en-US', { timeZone: this.IST_TIMEZONE }),
    );
  }

  /**
   * Get ISO string in IST (considers timezone when storing)
   */
  static getISTIsoString(date: Date = new Date()): string {
    const istDate = this.convertToIST(date);
    return istDate.toISOString();
  }

  /**
   * Check if date is today (in IST)
   */
  static isToday(date: Date): boolean {
    const istDate = this.convertToIST(date);
    const istToday = this.getCurrentISTDate();
    return (
      istDate.getDate() === istToday.getDate() &&
      istDate.getMonth() === istToday.getMonth() &&
      istDate.getFullYear() === istToday.getFullYear()
    );
  }

  /**
   * Get start of day in IST (midnight)
   */
  static getStartOfDayIST(date: Date = new Date()): Date {
    const istDate = this.convertToIST(date);
    istDate.setHours(0, 0, 0, 0);
    return istDate;
  }

  /**
   * Get end of day in IST (23:59:59)
   */
  static getEndOfDayIST(date: Date = new Date()): Date {
    const istDate = this.convertToIST(date);
    istDate.setHours(23, 59, 59, 999);
    return istDate;
  }
}

/**
 * Helper for tenant operations and validations
 */
export class TenantHelper {
  /**
   * Validate if a string is a valid MongoDB ObjectId
   */
  static isValidObjectId(id: string): boolean {
    return /^[0-9a-f]{24}$/.test(id);
  }

  /**
   * Validate tenant scoping (ensure tenant has access to resource)
   */
  static validateTenantScope(
    tenantIdFromToken: string,
    tenantIdFromRequest: string,
  ): boolean {
    return tenantIdFromToken === tenantIdFromRequest;
  }

  /**
   * Generate tenant slug from name
   */
  static generateSlug(tenantName: string): string {
    return tenantName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  /**
   * Validate business email format
   */
  static isValidBusinessEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  /**
   * Get tenant sub path for routes
   */
  static getTenantPath(tenantId: string): string {
    return `/tenants/${tenantId}`;
  }
}
