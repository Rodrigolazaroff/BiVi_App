'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function saveElder(
  fullName: string,
  age: number,
  favoriteTopics: string[]
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get or create elder
  const { data: existingElder } = await supabase
    .from('elders')
    .select('id')
    .eq('profile_id', user.id)
    .single();

  if (existingElder) {
    // Update
    const { error } = await supabase
      .from('elders')
      .update({
        full_name: fullName,
        age,
        favorite_topics: favoriteTopics.filter(Boolean),
      })
      .eq('id', existingElder.id);

    if (error) throw error;
  } else {
    // Insert
    const { error } = await supabase.from('elders').insert({
      profile_id: user.id,
      full_name: fullName,
      age,
      favorite_topics: favoriteTopics.filter(Boolean),
    });

    if (error) throw error;
  }
}

export async function getElder() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data, error } = await supabase
    .from('elders')
    .select('*')
    .eq('profile_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || null;
}
