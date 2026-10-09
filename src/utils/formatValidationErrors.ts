import type { ValidationError } from 'class-validator';

export function formatValidationErrors(
  errors: ValidationError[],
  parentProperty = '',
): { property: string; message: string }[] {
  return errors.flatMap((error) => {
    const property = parentProperty
      ? `${parentProperty}.${error.property}`
      : error.property;

    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({
        property,
        message,
      })),
      ...formatValidationErrors(error.children ?? [], property),
    ];
  });
}
