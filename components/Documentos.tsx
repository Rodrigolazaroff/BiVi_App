'use client';

import { useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatearTamano,
  TAMANO_MAXIMO,
  TIPOS_PERMITIDOS,
  type Documento,
} from '@/lib/documentos';

/**
 * Documentacion medica del adulto mayor: informes, analisis, recetas.
 *
 * El archivo sube directo del navegador al Storage (las policies del bucket
 * limitan a la carpeta del cuidador); despues el servidor lo procesa una vez
 * con Gemini y guarda el resumen, que es lo que usa la historia clinica.
 */
export default function Documentos({
  elderId,
  iniciales,
}: {
  elderId: string;
  iniciales: Documento[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [lista, setLista] = useState<Documento[]>(iniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function recargar() {
    const { data } = await supabase
      .from('documents')
      .select('id, nombre, storage_path, mime_type, tamano, resumen, datos, procesado_en, created_at')
      .order('created_at', { ascending: false });
    setLista((data ?? []) as Documento[]);
  }

  async function procesar(documentId: string) {
    setProcesando(documentId);
    try {
      const r = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error || 'No pudimos procesar el documento.');
      }
      await recargar();
    } finally {
      setProcesando(null);
    }
  }

  async function subir(archivo: File) {
    setError('');

    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      return setError('Solo se aceptan PDF o imágenes (JPG, PNG).');
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return setError(`El archivo pesa ${formatearTamano(archivo.size)}; el máximo es 10 MB.`);
    }

    setSubiendo(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setError('Tu sesión expiró. Volvé a ingresar.');

      // La carpeta raiz DEBE ser el uid: es lo que validan las policies.
      const extension = archivo.name.split('.').pop()?.toLowerCase() || 'bin';
      const ruta = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: falloSubida } = await supabase.storage
        .from('documentos')
        .upload(ruta, archivo, { contentType: archivo.type });
      if (falloSubida) return setError('No pudimos subir el archivo. Probá de nuevo.');

      const { data: fila, error: falloFila } = await supabase
        .from('documents')
        .insert({
          elder_id: elderId,
          nombre: archivo.name,
          storage_path: ruta,
          mime_type: archivo.type,
          tamano: archivo.size,
        })
        .select('id')
        .single();

      if (falloFila || !fila) {
        // Sin fila la subida queda huerfana: se limpia el archivo.
        await supabase.storage.from('documentos').remove([ruta]);
        return setError('No pudimos registrar el documento. Probá de nuevo.');
      }

      await recargar();
      // La extraccion corre aparte: si falla (p. ej. cuota), el archivo ya
      // esta a salvo y queda el boton para reintentar.
      await procesar(fila.id);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function quitar(doc: Documento) {
    setError('');
    const { error: falloBorrado } = await supabase.from('documents').delete().eq('id', doc.id);
    if (falloBorrado) return setError('No pudimos borrar el documento.');
    await supabase.storage.from('documentos').remove([doc.storage_path]);
    await recargar();
  }

  function describirFecha(doc: Documento): string {
    const iso = doc.datos?.fecha_documento || doc.created_at.slice(0, 10);
    const [a, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}/${a}`;
  }

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">Documentos médicos</h2>
      <p className="mt-1 mb-6 text-bivi-muted">
        Informes, análisis y recetas. BiVi los resume para armar la historia clínica; no
        interpreta resultados ni da indicaciones.
      </p>

      {lista.length > 0 && (
        <ul className="mb-6 divide-y divide-bivi-border/60">
          {lista.map((doc) => (
            <li key={doc.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-bivi-text">
                    {doc.datos?.titulo || doc.nombre}
                  </p>
                  <p className="text-sm text-bivi-muted">
                    {describirFecha(doc)} · {formatearTamano(doc.tamano)}
                    {doc.datos?.tipo_documento && ` · ${doc.datos.tipo_documento}`}
                  </p>
                  {doc.resumen ? (
                    <p className="mt-1 text-sm text-bivi-text/80">{doc.resumen}</p>
                  ) : (
                    <button
                      onClick={() => procesar(doc.id)}
                      disabled={procesando === doc.id}
                      className="mt-1 text-sm font-bold text-bivi-blue underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      {procesando === doc.id ? 'Leyendo el documento...' : 'Reintentar lectura'}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => quitar(doc)}
                  className="shrink-0 text-sm font-bold text-bivi-muted underline-offset-2 hover:text-red-700 hover:underline"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_PERMITIDOS.join(',')}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subir(archivo);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="w-full rounded-xl border-2 border-dashed border-bivi-border px-4 py-4 font-bold text-bivi-blue transition hover:border-bivi-blue hover:bg-bivi-blue-soft disabled:opacity-60"
      >
        {subiendo ? 'Subiendo...' : '+ Subir documento (PDF o foto)'}
      </button>

      <div aria-live="polite">
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
