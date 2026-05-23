import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TalkClient from './client';

export const metadata = {
  title: 'Conversa | BiVi',
};

export default async function TalkPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: elder, error } = await supabase
    .from('elders')
    .select('*')
    .eq('profile_id', user.id)
    .single();

  if (error || !elder) {
    redirect('/dashboard');
  }

  return <TalkClient elder={elder} userId={user.id} />;
}
