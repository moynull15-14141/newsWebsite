import { IsBoolean, IsOptional } from 'class-validator';

/** Placement rows are seeded system config (see prisma/seed.ts), not admin-creatable — only the
 * site-wide kill switch is mutable via the API. */
export class UpdatePlacementDto {
  @IsBoolean()
  enabled!: boolean;
}
