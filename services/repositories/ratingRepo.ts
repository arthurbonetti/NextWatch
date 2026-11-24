import { getConfiguredSupabaseClient } from '@/services/supabase';

const TABLE_NAME = 'user_title_ratings';

export type UserTitleRating = {
  userId: string;
  titleId: string;
  rating: number;
  updatedAt: string;
};

type RatingRow = {
  user_id: string;
  title_id: string;
  rating: number;
  updated_at: string;
};

export async function fetchTitleRating(
  userId: string,
  titleId: string,
): Promise<{ found: boolean; rating: number | null }> {
  const client = getConfiguredSupabaseClient();
  if (!client) return { found: false, rating: null };

  const { data, error } = await client
    .from(TABLE_NAME)
    .select('rating')
    .eq('user_id', userId)
    .eq('title_id', titleId)
    .maybeSingle<Pick<RatingRow, 'rating'>>();

  if (error || !data) return { found: false, rating: null };
  const normalized = data.rating > 5 ? Math.round(data.rating / 2) : data.rating;
  return { found: true, rating: Math.max(0, Math.min(5, normalized)) };
}

export async function upsertTitleRating(
  userId: string,
  titleId: string,
  rating: number,
): Promise<boolean> {
  const client = getConfiguredSupabaseClient();
  if (!client) return false;

  const { error } = await client.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      title_id: titleId,
      rating: Math.max(0, Math.min(5, Math.round(rating))),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,title_id' },
  );

  return !error;
}

export async function deleteTitleRating(userId: string, titleId: string): Promise<boolean> {
  const client = getConfiguredSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from(TABLE_NAME)
    .delete()
    .eq('user_id', userId)
    .eq('title_id', titleId);

  return !error;
}
