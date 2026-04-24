import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validates that the value is a valid Indian GST rate
 * Valid rates: 0%, 5%, 12%, 18%, 28%
 */
@ValidatorConstraint({ name: 'isValidGstRate', async: false })
export class IsValidGstRateConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'number') {
      return false;
    }
    const validRates = [0, 5, 12, 18, 28];
    return validRates.includes(value);
  }

  defaultMessage(): string {
    return 'GST rate must be one of: 0, 5, 12, 18, 28';
  }
}

export function IsValidGstRate(validationOptions?: ValidationOptions) {
  return function (target: Object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidGstRateConstraint,
    });
  };
}

/**
 * Validates abbreviation format (alphanumeric, 2-10 chars)
 */
@ValidatorConstraint({ name: 'isValidAbbreviation', async: false })
export class IsValidAbbreviationConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    // Allow alphanumeric, 2-10 characters
    const abbreviationPattern = /^[A-Z0-9]{2,10}$/;
    return abbreviationPattern.test(value);
  }

  defaultMessage(): string {
    return 'Abbreviation must be 2-10 uppercase alphanumeric characters';
  }
}

export function IsValidAbbreviation(validationOptions?: ValidationOptions) {
  return function (target: Object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidAbbreviationConstraint,
    });
  };
}

/**
 * Validates phone number format (Indian phone numbers)
 */
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    // Indian phone number: 10 digits
    const phonePattern = /^[6-9]\d{9}$/;
    return phonePattern.test(value);
  }

  defaultMessage(): string {
    return 'Phone number must be a valid 10-digit Indian mobile number (starting with 6-9)';
  }
}

export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (target: Object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}
