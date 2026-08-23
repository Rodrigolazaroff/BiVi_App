import { Bloque, EncabezadoEsqueleto } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <>
      <EncabezadoEsqueleto />
      <div className="space-y-6">
        <Bloque className="h-[76px] rounded-2xl" />
        <div className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
          <Bloque className="h-6 w-44" />
          <Bloque className="mt-3 h-4 w-full max-w-sm" />
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Bloque className="h-[88px] rounded-xl" />
            <Bloque className="h-[88px] rounded-xl" />
          </div>
          <Bloque className="mt-7 h-[100px] rounded-xl" />
        </div>
      </div>
    </>
  );
}
