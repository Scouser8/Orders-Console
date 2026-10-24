import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/use-auth";
import { listOrders } from "../api/list-orders";
import {
  DEFAULT_ORDER_QUERY,
  orderQueryKeys,
} from "../constants/order.constants";
import type { OrderQuery } from "../types/order.types";

export function useOrders(query: OrderQuery = DEFAULT_ORDER_QUERY) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: orderQueryKeys.list(session?.user.id, query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      if (!session) throw new Error("Sign in to view orders.");
      return listOrders(query, pageParam, session.accessToken, signal);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: session !== null,
  });
}
