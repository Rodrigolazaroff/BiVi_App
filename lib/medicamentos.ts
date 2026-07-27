export interface Medicamento {
  id: string;
  nombre: string;
  dosis: string;
  horarios: string[]; // "08:00:00"
  activo: boolean;
  /** Primer dia del tratamiento, "YYYY-MM-DD". */
  desde: string;
  /** Ultimo dia inclusive. null = permanente. */
  hasta: string | null;
}

export interface TomaPendiente {
  medicationId: string;
  nombre: string;
  dosis: string;
  /** Hora prevista, "HH:MM". */
  hora: string;
  /** Momento exacto previsto, para registrar la toma sin ambiguedad. */
  previstoPara: Date;
}

/*
 * Toda la app razona en hora de Argentina, no en la del servidor.
 *
 * En Vercel el servidor corre en UTC, y como Argentina esta en UTC-3 un remedio
 * de las 08:00 se daba por vencido a las 05:00 hora real. Para un recordatorio
 * de medicacion eso no es un detalle.
 */
export const ZONA = 'America/Argentina/Buenos_Aires';

/** Fecha ("YYYY-MM-DD") y minutos desde medianoche, en la zona del adulto mayor. */
export function momentoLocal(instante: Date): { fecha: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instante);

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  // 'en-CA' da la fecha como YYYY-MM-DD, que es justo el formato de la columna.
  const fecha = `${valor('year')}-${valor('month')}-${valor('day')}`;
  const hora = Number(valor('hour')) % 24;

  return { fecha, minutos: hora * 60 + Number(valor('minute')) };
}

/**
 * Instante UTC que corresponde a una fecha y hora locales.
 *
 * Se calcula el desfase real de la zona en vez de restar 3 horas fijas: asi no
 * se rompe si en algun momento vuelve el horario de verano.
 */
function instanteLocal(fecha: string, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const tentativo = new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00Z`);

  const enZona = new Date(tentativo.toLocaleString('en-US', { timeZone: ZONA }));
  const enUtc = new Date(tentativo.toLocaleString('en-US', { timeZone: 'UTC' }));
  const desfase = enZona.getTime() - enUtc.getTime();

  return new Date(tentativo.getTime() - desfase);
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatearHora(hora: string): string {
  return hora.slice(0, 5);
}

/** Si el tratamiento corresponde en esa fecha ("YYYY-MM-DD"). */
export function vigenteEn(med: Medicamento, fecha: string): boolean {
  if (!med.activo) return false;
  if (med.desde > fecha) return false;
  // hasta null = permanente: no termina nunca.
  if (med.hasta !== null && med.hasta < fecha) return false;
  return true;
}

export function esPermanente(med: Medicamento): boolean {
  return med.hasta === null;
}

/** "Permanente" · "Hasta el 30/7" · "Terminó el 20/7" · "Desde el 1/8" */
export function describirPeriodo(med: Medicamento, hoy: string): string {
  const dia = (iso: string) => {
    const [a, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}${a !== hoy.slice(0, 4) ? `/${a}` : ''}`;
  };

  if (med.desde > hoy) return `Desde el ${dia(med.desde)}`;
  if (med.hasta === null) return 'Permanente';
  if (med.hasta < hoy) return `Terminó el ${dia(med.hasta)}`;
  if (med.hasta === hoy) return 'Último día';
  return `Hasta el ${dia(med.hasta)}`;
}

/**
 * Tomas de hoy que ya deberian haber ocurrido y todavia no se registraron.
 *
 * `ahora` entra por parametro para que la funcion sea pura: depende solo de sus
 * argumentos y se puede testear sin tocar el reloj.
 *
 * `toleranciaMin` evita mencionar algo apenas pasa la hora, que seria molesto.
 */
export function tomasPendientes(
  medicamentos: Medicamento[],
  yaRegistradas: { medication_id: string; previsto_para: string }[],
  ahora: Date,
  toleranciaMin = 15
): TomaPendiente[] {
  const { fecha: hoy, minutos: minutosAhora } = momentoLocal(ahora);

  const registradas = new Set(
    yaRegistradas.map((r) => `${r.medication_id}|${new Date(r.previsto_para).getTime()}`)
  );

  const pendientes: TomaPendiente[] = [];

  for (const med of medicamentos) {
    // Fuera del periodo del tratamiento no hay nada que recordar.
    if (!vigenteEn(med, hoy)) continue;

    for (const horario of med.horarios) {
      // Todavia no es la hora (o falta poco): no corresponde recordarlo.
      if (minutosAhora < aMinutos(horario) + toleranciaMin) continue;

      const previstoPara = instanteLocal(hoy, horario);
      if (registradas.has(`${med.id}|${previstoPara.getTime()}`)) continue;

      pendientes.push({
        medicationId: med.id,
        nombre: med.nombre,
        dosis: med.dosis,
        hora: formatearHora(horario),
        previstoPara,
      });
    }
  }

  return pendientes.sort((a, b) => a.previstoPara.getTime() - b.previstoPara.getTime());
}

/** Texto que se le pasa al modelo para que sepa que hay pendiente. */
export function describirPendientes(pendientes: TomaPendiente[]): string {
  if (pendientes.length === 0) return '';

  const lista = pendientes
    .map((p) => `- ${p.nombre}${p.dosis ? ` (${p.dosis})` : ''}, correspondía a las ${p.hora}`)
    .join('\n');

  return `Hoy todavía no confirmó estas tomas:\n${lista}`;
}
