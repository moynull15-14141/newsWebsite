import { IsUUID, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class AssignPlacementDto {
  @IsUUID()
  campaignId!: string;

  @IsUUID()
  placementId!: string;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateCampaignPlacementDto {
  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
