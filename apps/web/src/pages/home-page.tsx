import { useState } from "react";
import { useAuth } from "../features/auth/hooks/use-auth";
import { OrdersTable } from "../features/orders/components/orders-table";
import { CreateOrderForm } from "../features/orders/components/create-order-form";
import { PageContainer } from "../shared/components/page-container";
import { Button } from "../shared/components/ui/button";

export function HomePage() {
  const { session, signOut } = useAuth();
  const [createdOrderId, setCreatedOrderId] = useState<string>();
  return (
    <PageContainer>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          {session?.user.email} · {session?.user.role}
        </p>
        <Button onClick={signOut}>Sign out</Button>
      </header>
      <p className="text-sm font-semibold tracking-widest text-indigo-700">
        SARH
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Orders Console
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        Find and manage customer orders.
      </p>
      <CreateOrderForm onCreated={(order) => setCreatedOrderId(order.id)} />
      <OrdersTable key={createdOrderId} createdOrderId={createdOrderId} />
    </PageContainer>
  );
}
