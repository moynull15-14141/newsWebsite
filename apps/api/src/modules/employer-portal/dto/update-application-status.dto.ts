import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Mirrors JobApplicationsAdminController's UpdateApplicationStatusDto exactly (same allowed values) —
// the employer-portal review flow re-scopes the same admin business rule to ownership instead of RBAC.
export class UpdateApplicationStatusDto {
  @IsIn(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED'])
  status!: string;

  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
