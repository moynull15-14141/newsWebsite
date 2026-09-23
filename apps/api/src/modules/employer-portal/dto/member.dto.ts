import { IsEmail, IsEnum, IsIn, MaxLength } from 'class-validator';
import { EmployerMembershipRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsEnum(EmployerMembershipRole)
  role!: EmployerMembershipRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(EmployerMembershipRole)
  role!: EmployerMembershipRole;
}
