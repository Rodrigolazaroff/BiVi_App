import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ElderProfile } from '@/lib/elder';
import TalkClient from './client';

/**
 * La ficha se resuelve en el servidor y baja como prop. Asi el prompt del
 * sistema ya esta armado en el primer render, sin depender de que el cliente
 * termine de hidratar.
 */
export default async function TalkPage() {
  const supabase = await createClient();

  const { data: elder } = await supabase
    .from('elders')
    .select('id, full_name, age, favorite_topics')
    .maybeSingle<ElderProfile>();

  // Sin ficha no hay con quien conversar: primero hay que completarla.
  if (!elder) redirect('/dashboard');

  return <TalkClient elder={elder} />;
}
