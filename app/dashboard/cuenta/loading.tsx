import { EncabezadoEsqueleto, TarjetaEsqueleto } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <>
      <EncabezadoEsqueleto />
      <div className="space-y-6">
        <TarjetaEsqueleto lineas={2} />
        <TarjetaEsqueleto lineas={2} />
        <TarjetaEsqueleto lineas={1} />
      </div>
    </>
  );
}
