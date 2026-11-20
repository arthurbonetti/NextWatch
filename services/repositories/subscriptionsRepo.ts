import type { Subscription } from '@/constants/subscriptions';
import {
  classifySupabaseError,
  hasSupabaseConfig,
  supabase,
  type SupabaseOutcome,
} from '@/services/supabase';

const TABLE_NAME = 'user_subscriptions';
export const MAX_MONTHLY_PRICE = 10000;

type DbSubscriptionRow = {
  user_id: string;
  subscription_id: string;
  provider: string;
  monthly_price: number;
  billing_day: number;
  active: boolean;
  renewal_alert: boolean;
  alert_days: number;
};

export function isSubscription(value: unknown): value is Subscription {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Subscription>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 128 &&
    typeof item.provider === 'string' &&
    item.provider.length > 0 &&
    item.provider.length <= 64 &&
    typeof item.monthlyPrice === 'number' &&
    Number.isFinite(item.monthlyPrice) &&
    item.monthlyPrice > 0 &&
    item.monthlyPrice <= MAX_MONTHLY_PRICE &&
    typeof item.billingDay === 'number' &&
    Number.isInteger(item.billingDay) &&
    item.billingDay >= 1 &&
    item.billingDay <= 31 &&
    typeof item.active === 'boolean' &&
    typeof item.renewalAlert === 'boolean' &&
    (item.alertDays === 1 || item.alertDays === 3 || item.alertDays === 7)
  );
}

function mapRowToSubscription(row: Partial<DbSubscriptionRow>): Subscription | null {
  const mapped: Subscription = {
    id: String(row.subscription_id ?? '').slice(0, 128),
    provider: String(row.provider ?? '').slice(0, 64),
    monthlyPrice: Math.min(MAX_MONTHLY_PRICE, Math.max(0.01, Number(row.monthly_price) || 0)),
    billingDay: Math.min(31, Math.max(1, Math.trunc(Number(row.billing_day) || 1))),
    active: Boolean(row.active),
    renewalAlert: Boolean(row.renewal_alert),
    alertDays: row.alert_days === 1 || row.alert_days === 3 || row.alert_days === 7 ? row.alert_days : 3,
  };
  return isSubscription(mapped) ? mapped : null;
}

export async function fetchSubscriptions(userId: string): Promise<Subscription[] | null> {
  if (!userId || !supabase || !hasSupabaseConfig()) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userId);

    if (error || !Array.isArray(data)) return null;

    return (data as Partial<DbSubscriptionRow>[])
      .map(mapRowToSubscription)
      .filter((item): item is Subscription => item !== null);
  } catch {
    return null;
  }
}

export async function upsertSubscription(
  userId: string,
  sub: Subscription,
): Promise<SupabaseOutcome> {
  if (!userId || !supabase || !hasSupabaseConfig()) return 'retry';

  try {
    const { error, status } = await supabase
      .from(TABLE_NAME)
      .upsert({
        user_id: userId,
        subscription_id: sub.id,
        provider: sub.provider,
        monthly_price: sub.monthlyPrice,
        billing_day: sub.billingDay,
        active: sub.active,
        renewal_alert: sub.renewalAlert,
        alert_days: sub.alertDays,
      });

    return classifySupabaseError(error ? { code: error.code, status, message: error.message } : null);
  } catch {
    return 'retry';
  }
}

export async function deleteSubscription(
  userId: string,
  subId: string,
): Promise<SupabaseOutcome> {
  if (!userId || !supabase || !hasSupabaseConfig()) return 'retry';

  try {
    const { error, status } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId)
      .eq('subscription_id', subId);

    return classifySupabaseError(error ? { code: error.code, status, message: error.message } : null);
  } catch {
    return 'retry';
  }
}
