/**
 * Historia clinica: estructura de datos compartida entre el endpoint que la
 * arma y el componente que la muestra / imprime.
 *
 * La redaccion ya NO viaja en Markdown. El modelo devuelve solo las secciones
 * narrativas y el resto (medicacion, estudios) se arma en el servidor con lo
 * que hay en la base: menos tokens, cero riesgo de que invente una dosis, y un
 * unico layout para pantalla, overlay y PDF.
 */

export interface MedicacionItem {
  nombre: string;
  detalle: string;
}

export interface EstudioItem {
  fecha: string | null;
  titulo: string;
  tipo: string;
  resumen: string;
  valores: string[];
}

/** Lo unico que redacta el modelo. */
export interface SeccionesRedactadas {
  antecedentes_patologicos: string[];
  enfermedad_actual: string[];
  impresion_diagnostica: string[];
}

export interface Historia {
  paciente: { nombre: string; edad: number };
  generadaEl: string;
  antecedentes: string[];
  medicacion: MedicacionItem[];
  medicacionPrevia: MedicacionItem[];
  enfermedadActual: string[];
  impresionDiagnostica: string[];
  estudios: EstudioItem[];
}

/** "2026-08-17" -> "17/08/2026". Devuelve el original si no matchea. */
export function formatearFecha(iso: string | null): string {
  if (!iso) return 'sin fecha';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
