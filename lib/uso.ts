export interface SesionResumen {
  started_at: string;
  duration_seconds: number | null;
  status: string;
}

export interface ResumenDeUso {
  charlasEstaSemana: number;
  promedioSegundos: number;
  ultimaEn: string | null;
  recientes: SesionResumen[];
  hayDatos: boolean;
}

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

  const desde = ahora - 7 * 24 * 60 * 60 * 1000;
  const semana = reales.filter((s) => new Date(s.started_at).getTime() >= desde);

  const total = semana.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  return {
    charlasEstaSemana: semana.length,
    promedioSegundos: semana.length > 0 ? Math.round(total / semana.length) : 0,
    ultimaEn: reales[0]?.started_at ?? null,
    recientes: reales.slice(0, 5),
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
