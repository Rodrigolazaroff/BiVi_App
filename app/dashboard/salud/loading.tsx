import { EncabezadoEsqueleto, TarjetaEsqueleto } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <>
      <EncabezadoEsqueleto />
      <div className="space-y-6">
        <TarjetaEsqueleto lineas={4} />
        <TarjetaEsqueleto lineas={1} />
        <TarjetaEsqueleto lineas={3} />
        <TarjetaEsqueleto lineas={1} />
      </div>
    </>
  );
}
