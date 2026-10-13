import {createFileRoute} from '@tanstack/react-router';
import {purchaseOrdersUnavailable} from '@/lib/purchase-order.server';
// Deliberately no activation env flag: production adapters require a reviewed code change.
export const Route=createFileRoute('/api/purchase-orders')({server:{handlers:{GET:purchaseOrdersUnavailable,POST:purchaseOrdersUnavailable}}});
