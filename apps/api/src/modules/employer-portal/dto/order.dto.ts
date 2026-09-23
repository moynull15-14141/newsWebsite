import { IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  planId!: string;
}
