import {
  Controller,
  Body,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Query,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '../generated/prisma/enums.js';
import { OrdersService } from './orders.service.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import type { AuthenticatedRequest } from '../auth/types/auth.types.js';

@Controller('api/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get()
  listOrders(@Query() query: ListOrdersDto) {
    return this.orders.listOrders(query);
  }

  @Post()
  createOrder(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key: unknown,
    @Body() body: CreateOrderDto,
  ) {
    if (!request.user) throw new UnauthorizedException();
    return this.orders.createOrder(request.user.id, key, body);
  }

  @Delete(':id')
  @Roles([Role.ADMIN])
  deleteOrder(@Param('id') id: string) {
    return this.orders.deleteOrder(id);
  }
}
