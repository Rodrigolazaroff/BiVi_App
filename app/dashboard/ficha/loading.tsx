import { EncabezadoEsqueleto, TarjetaEsqueleto } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <>
      <EncabezadoEsqueleto />
      <TarjetaEsqueleto lineas={5} />
    </>
  );
}
