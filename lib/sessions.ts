import { createClient } from '@/lib/supabase/client';

/**
 * Registro de conversaciones. Guarda solo metadata (cuando empezo, cuanto duro,
 * como termino) y nunca el contenido de lo hablado: la Declaracion de MVP
 * decide explicitamente no almacenar transcripciones.
 */

export type SessionStatus = 'active' | 'completed' | 'error' | 'abandoned';

/**
 * Abre una conversacion y devuelve su id.
 *
 * De paso cierra las que hayan quedado abiertas: si alguien sale de la app sin
 * tocar "Terminar", la fila queda en 'active' para siempre. No se puede
 * cerrarlas al salir de forma confiable (el navegador no garantiza que un
 * pedido en beforeunload llegue), asi que se limpian al abrir la siguiente.
 */
export async function iniciarSesion(elderId: string): Promise<string | null> {
  const supabase = createClient();

  await supabase
    .from('sessions')
    .update({ status: 'abandoned', ended_at: new Date().toISOString() })
    .eq('elder_id', elderId)
    .eq('status', 'active');

  const { data, error } = await supabase
    .from('sessions')
    .insert({ elder_id: elderId, status: 'active' })
    .select('id')
    .single();

  // Que falle el registro no puede impedir que la persona converse: es
  // instrumentacion, no parte del producto.
  if (error) {
    console.error('No se pudo registrar el inicio de la conversación:', error.message);
    return null;
  }

  return data.id;
}

/** Cierra la conversacion con su duracion. */
export async function terminarSesion(
  sessionId: string | null,
  iniciadaEn: number,
  status: Exclude<SessionStatus, 'active'> = 'completed'
): Promise<void> {
  if (!sessionId) return;

  const supabase = createClient();
  const duracion = Math.max(0, Math.round((Date.now() - iniciadaEn) / 1000));

  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: duracion,
      status,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('No se pudo cerrar la conversación:', error.message);
  }
}
