export interface Medicamento {
  id: string;
  nombre: string;
  dosis: string;
  horarios: string[]; // "08:00:00"
  activo: boolean;
}

export interface TomaPendiente {
  medicationId: string;
  nombre: string;
  dosis: string;
  /** Hora prevista, en formato "HH:MM". */
  hora: string;
  /** Momento exacto previsto, para registrar la toma sin ambiguedad. */
  previstoPara: Date;
}

/** Minutos desde la medianoche de un "HH:MM[:SS]". */
function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatearHora(hora: string): string {
  return hora.slice(0, 5);
}

/**
 * Tomas de hoy que ya deberian haber ocurrido y todavia no se registraron.
 *
 * `ahora` entra por parametro para que la funcion sea pura: el resultado
 * depende solo de sus argumentos, se puede testear, y quien la llama decide
 * desde donde se lee el reloj.
 *
 * `toleranciaMin` evita mencionar algo apenas pasa la hora (seria molesto) y
 * tambien deja de insistir con lo de muy temprano en el dia.
 */
export function tomasPendientes(
  medicamentos: Medicamento[],
  yaRegistradas: { medication_id: string; previsto_para: string }[],
  ahora: Date,
  toleranciaMin = 15
): TomaPendiente[] {
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  const registradas = new Set(
    yaRegistradas.map((r) => `${r.medication_id}|${new Date(r.previsto_para).getTime()}`)
  );

  const pendientes: TomaPendiente[] = [];

  for (const med of medicamentos) {
    if (!med.activo) continue;

    for (const horario of med.horarios) {
      const minutosToma = aMinutos(horario);

      // Todavia no es la hora (o falta poco): no corresponde recordarlo.
      if (minutosAhora < minutosToma + toleranciaMin) continue;

      const previstoPara = new Date(ahora);
      const [h, m] = horario.split(':').map(Number);
      previstoPara.setHours(h, m || 0, 0, 0);

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
