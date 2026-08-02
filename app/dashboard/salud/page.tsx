import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Medicamentos from '@/components/Medicamentos';
import Notificaciones from '@/components/Notificaciones';
import Documentos from '@/components/Documentos';
import HistoriaClinica from '@/components/HistoriaClinica';
import { momentoLocal, type Medicamento } from '@/lib/medicamentos';
import type { Documento } from '@/lib/documentos';

/**
 * Salud: medicamentos, recordatorios y (proximamente) documentos medicos.
 */
export default async function SaludPage() {
  const supabase = await createClient();

  const { data: elder } = await supabase.from('elders').select('id, full_name').maybeSingle();

  const [{ data: medicamentos }, { data: documentos }] = elder
    ? await Promise.all([
        supabase
          .from('medications')
          .select('id, nombre, dosis, horarios, activo, desde, hasta')
          .eq('activo', true)
          .order('created_at'),
        supabase
          .from('documents')
          .select(
            'id, nombre, storage_path, mime_type, tamano, resumen, datos, procesado_en, created_at'
          )
          .order('created_at', { ascending: false }),
      ])
    : [{ data: null }, { data: null }];

  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  // El servidor de Vercel corre en UTC: "hoy" se calcula en hora de Argentina.
  const { fecha: hoy } = momentoLocal(new Date(ahora));

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
          Salud
        </h1>
        <p className="mt-1 text-bivi-muted">Medicamentos y recordatorios</p>
      </header>

      {elder ? (
        <div className="space-y-6">
          <Medicamentos
            elderId={elder.id as string}
            iniciales={(medicamentos ?? []) as Medicamento[]}
            hoy={hoy}
          />
          <Notificaciones />
          <Documentos
            elderId={elder.id as string}
            iniciales={(documentos ?? []) as Documento[]}
          />
          <HistoriaClinica />
        </div>
      ) : (
        <section className="rounded-2xl border border-bivi-border/70 bg-white p-8 text-center shadow-xl shadow-bivi-blue/5">
          <p className="mx-auto mb-6 max-w-sm text-bivi-muted">
            Antes de cargar medicamentos, completá la ficha del adulto mayor.
          </p>
          <Link
            href="/dashboard/ficha"
            className="inline-block rounded-xl bg-bivi-blue px-6 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99]"
          >
            Completar la ficha
          </Link>
        </section>
      )}
    </>
  );
}
