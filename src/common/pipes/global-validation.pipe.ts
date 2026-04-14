import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationError,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class GlobalValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      return value;
    }

    // Only validate for body and param transformations
    if (metadata.type !== 'body' && metadata.type !== 'param') {
      return value;
    }

    // Skip validation if no metatype is available
    if (
      !metadata.metatype ||
      metadata.metatype === String ||
      metadata.metatype === Number ||
      metadata.metatype === Boolean
    ) {
      return value;
    }

    const object = plainToInstance(metadata.metatype, value);

    if (typeof object !== 'object') {
      return value;
    }

    const errors = await validate(object, {
      skipMissingProperties: false,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: formattedErrors,
      });
    }

    return object;
  }

  private formatErrors(
    errors: ValidationError[],
    parentPath?: string,
  ): Record<string, any> {
    const formattedErrors: Record<string, any> = {};

    for (const error of errors) {
      const propertyPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        formattedErrors[propertyPath] = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        Object.assign(
          formattedErrors,
          this.formatErrors(error.children, propertyPath),
        );
      }
    }

    return formattedErrors;
  }
}
