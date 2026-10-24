import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums.js';
import {
  DEFAULT_ORDER_PAGE_SIZE,
  MAX_ORDER_CURSOR_LENGTH,
  MAX_ORDER_PAGE_SIZE,
  MAX_ORDER_SEARCH_LENGTH,
  ORDER_SORT_DIRECTIONS,
  ORDER_SORT_FIELDS,
} from '../constants/order-query.constants.js';
import type {
  OrderSortDirection,
  OrderSortField,
} from '../types/order-query.types.js';

export class ListOrdersDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_ORDER_SEARCH_LENGTH)
  search = '';

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsIn(ORDER_SORT_FIELDS)
  sortBy: OrderSortField = 'createdAt';

  @IsIn(ORDER_SORT_DIRECTIONS)
  sortDirection: OrderSortDirection = 'desc';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ORDER_PAGE_SIZE)
  limit = DEFAULT_ORDER_PAGE_SIZE;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ORDER_CURSOR_LENGTH)
  cursor?: string;
}
