/**
 * Piezas grises para los `loading.tsx` de cada pestania.
 *
 * No son un spinner: replican la forma de lo que viene, asi la pantalla no
 * salta cuando el contenido real reemplaza al esqueleto.
 *
 * El pulso se apaga solo con `prefers-reduced-motion`: la regla global de
 * globals.css ya recorta la duracion de toda animacion.
 */

export function Bloque({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-lg bg-bivi-border/70 ${className}`} />;
}

/** Encabezado de pestania: titulo grande y bajada. */
export function EncabezadoEsqueleto() {
  return (
    <div className="mb-8">
      <Bloque className="h-9 w-52" />
      <Bloque className="mt-2.5 h-4 w-64" />
    </div>
  );
}

/** Tarjeta con titulo, bajada y unas lineas de cuerpo. */
export function TarjetaEsqueleto({ lineas = 3 }: { lineas?: number }) {
  return (
    <div className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
      <Bloque className="h-6 w-44" />
      <Bloque className="mt-3 h-4 w-full max-w-xs" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: lineas }).map((_, i) => (
          <Bloque key={i} className="h-4" />
        ))}
      </div>
    </div>
  );
}
