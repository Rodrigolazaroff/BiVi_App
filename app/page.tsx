import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Puerta de entrada. Se resuelve en el servidor para que no haya un
 * "Cargando..." intermedio antes del redirect.
 *
 * Sin ficha cargada -> el cuidador tiene que completarla.
 * Con ficha cargada -> se va derecho a conversar, que es como abre la PWA
 * instalada en el celular del adulto mayor.
 */
export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: elder } = await supabase.from('elders').select('id').maybeSingle();

  redirect(elder ? '/talk' : '/dashboard');
}
