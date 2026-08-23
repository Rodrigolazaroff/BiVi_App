import { momentoLocal } from './medicamentos';

export interface SesionResumen {
  started_at: string;
  duration_seconds: number | null;
  status: string;
}

/** Una barra del grafico: un dia de la ultima semana. */
export interface DiaDeUso {
  /** "YYYY-MM-DD" en hora de Argentina. */
  fecha: string;
  /** Inicial del dia para el eje: L, M, X, J, V, S, D. */
  inicial: string;
  /** Nombre completo, para el lector de pantalla. */
  nombre: string;
  charlas: number;
  segundos: number;
}

export interface ResumenDeUso {
  /** Acumulado de siempre, no de la semana. */
  charlas: number;
  segundosTotales: number;
  promedioSegundos: number;
  ultima: SesionResumen | null;
  /** Los ultimos 7 dias, del mas viejo al mas nuevo. */
  porDia: DiaDeUso[];
  /** Todas las charlas reales, de la mas nueva a la mas vieja. */
  todas: SesionResumen[];
  hayDatos: boolean;
}

const INICIALES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * Calcula el resumen de uso.
 *
 * `ahora` se recibe en lugar de leer el reloj adentro para que la funcion sea
 * pura: siempre devuelve lo mismo con las mismas entradas, se puede testear, y
 * el componente que la usa no se vuelve impuro al renderizar.
 */
export function resumirUso(sesiones: SesionResumen[], ahora: number): ResumenDeUso {
  // Solo cuentan las conversaciones que efectivamente ocurrieron: una sesion
  // abandonada o de duracion cero inflaria las cifras sin representar uso real.
  const reales = sesiones.filter(
    (s) => s.status !== 'abandoned' && (s.duration_seconds ?? 0) > 0
  );

  const segundosTotales = reales.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  // Los ultimos 7 dias, en hora de Argentina: el servidor corre en UTC, asi
  // que agrupar por la fecha cruda mandaria las charlas de la noche al dia
  // siguiente.
  const porDia: DiaDeUso[] = [];
  for (let i = 6; i >= 0; i--) {
    const dia = new Date(ahora - i * UN_DIA);
    const { fecha } = momentoLocal(dia);
    // El indice del dia sale de la fecha local ya resuelta, no del Date crudo.
    const [a, m, d] = fecha.split('-').map(Number);
    const indice = new Date(Date.UTC(a, m - 1, d)).getUTCDay();

    porDia.push({
      fecha,
      inicial: INICIALES[indice],
      nombre: NOMBRES[indice],
      charlas: 0,
      segundos: 0,
    });
  }

  const porFecha = new Map(porDia.map((d) => [d.fecha, d]));
  reales.forEach((s) => {
    const { fecha } = momentoLocal(new Date(s.started_at));
    const dia = porFecha.get(fecha);
    if (dia) {
      dia.charlas += 1;
      dia.segundos += s.duration_seconds ?? 0;
    }
  });

  return {
    charlas: reales.length,
    segundosTotales,
    promedioSegundos: reales.length > 0 ? Math.round(segundosTotales / reales.length) : 0,
    ultima: reales[0] ?? null,
    porDia,
    todas: reales,
    hayDatos: reales.length > 0,
  };
}

/** "recién", "hace 2 horas", "ayer" — mas facil de leer que una fecha exacta. */
export function haceCuanto(iso: string, ahora: number): string {
  const minutos = Math.round((ahora - new Date(iso).getTime()) / 60000);

  if (minutos < 2) return 'recién';
  if (minutos < 60) return `hace ${minutos} minutos`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;

  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;

  return new Date(iso).toLocaleDateString('es-AR');
}

export function formatearDuracion(segundos: number): string {
  if (segundos < 60) return `${segundos} seg`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return seg === 0 ? `${min} min` : `${min} min ${seg} seg`;
}

/**
 * Parte una duracion en cifra y unidad, para mostrarla en grande sin que
 * desborde: "12 min 45 seg" a 30px no entra en media tarjeta de celular.
 */
export function partirDuracion(segundos: number): { valor: string; unidad: string } {
  if (segundos < 60) return { valor: String(segundos), unidad: 'seg' };

  const min = Math.round(segundos / 60);
  if (min < 60) return { valor: String(min), unidad: 'min' };

  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0
    ? { valor: String(horas), unidad: horas === 1 ? 'hora' : 'horas' }
    : { valor: `${horas} h ${resto}`, unidad: 'min' };
}
