import { Controller, Delete, Inject, Param, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '../generated/prisma/enums.js';
import { OrdersService } from './orders.service.js';

@Controller('api/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Delete(':id')
  @Roles([Role.ADMIN])
  deleteOrder(@Param('id') id: string) {
    return this.orders.deleteOrder(id);
  }
}
