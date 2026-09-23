import { registerDecorator, ValidationOptions } from 'class-validator';

/** #RGB or #RRGGBB only — the one shape every `background: <value>` CSS consumer downstream (the admin
 * color picker, the live preview, and the public ticker) can render safely with no further escaping.
 * This is the actual defense against "never allow arbitrary unsafe CSS values to be injected": no
 * `url()`, no `calc()`, no semicolons, nothing but a hex triplet ever reaches a style attribute. */
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function IsHexColor(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isHexColor',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a valid hex color (e.g. #D32F2F or #FFF)`, ...validationOptions },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
        },
      },
    });
  };
}

export const BACKGROUND_MODES = ['SOLID', 'GRADIENT'] as const;
export type BackgroundMode = (typeof BACKGROUND_MODES)[number];

export const GRADIENT_DIRECTIONS = ['LEFT_RIGHT', 'RIGHT_LEFT', 'TOP_BOTTOM', 'BOTTOM_TOP', 'DIAGONAL'] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];
