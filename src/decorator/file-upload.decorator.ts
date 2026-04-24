// crate a file uplaod decorator for swager documentation
import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

export function CsvFileUpload(
  fieldName: string,
  options: { maxSize: number; maxRows: number },
): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    applyDecorators(
      ApiConsumes('multipart/form-data'),
      ApiBody({
        schema: {
          type: 'object',
          properties: {
            [fieldName]: {
              type: 'string',
              format: 'binary',
              description: `CSV file (.csv) with columns: name, price, gst_rate, opening_stock (optional), deficit_threshold (optional). Max size: ${options.maxSize} bytes, Max rows: ${options.maxRows}`,
            },
          },
        },
      }),
    )(target, propertyKey, descriptor);
  };
}
