import { requestJson } from './api';

export type EventType = 
  | 'profile_view'
  | 'product_view'
  | 'service_view'
  | 'cart_add'
  | 'favourite_add'
  | 'portfolio_view'
  | 'contact_click'
  | 'checkout_initiated';

export async function trackEvent(
  eventType: EventType,
  targetUserId: number,
  itemId?: number
) {
  try {
    await requestJson('/api/analytics/log', {
      event_type: eventType,
      target_user_id: targetUserId,
      item_id: itemId,
    });
  } catch (error) {
    console.error('Failed to log analytics event:', error);
  }
}
