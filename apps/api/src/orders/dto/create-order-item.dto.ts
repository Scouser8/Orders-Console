import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_ORDER_NAME_LENGTH,
  MAX_ORDER_QUANTITY,
} from '../constants/order-create.constants.js';
import { MAX_ORDER_AMOUNT } from '../constants/order-query.constants.js';

export class CreateOrderItemDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ORDER_NAME_LENGTH)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_QUANTITY)
  quantity!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_ORDER_AMOUNT)
  unitPrice!: number;
}
