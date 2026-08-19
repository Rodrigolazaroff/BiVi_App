import type { ReactNode } from 'react';
import { formatearFecha, type EstudioItem, type Historia, type MedicacionItem } from '@/lib/historia';

/**
 * El documento en si. Es el UNICO layout de la historia clinica: lo que se ve
 * en el visor flotante es exactamente lo que sale impreso o en PDF, porque es
 * el mismo componente (las diferencias de impresion son variantes `print:`,
 * no otra maqueta).
 *
 * Estructura medica: antecedentes patologicos, medicacion habitual, enfermedad
 * actual, impresion diagnostica. Sin "plan": la conducta la indica el medico.
 */

function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-9 break-inside-avoid first:mt-0">
      <h3 className="flex items-baseline gap-2.5 border-b border-bivi-border pb-2">
        <span className="font-sans text-[0.7rem] font-bold tabular-nums text-bivi-blue">
          {numero}
        </span>
        <span className="font-display text-lg font-semibold tracking-tight text-bivi-text">
          {titulo}
        </span>
      </h3>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function SinDatos({ children }: { children: ReactNode }) {
  return <p className="text-sm text-bivi-muted italic">{children}</p>;
}

function Vinetas({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((texto, i) => (
        <li key={i} className="relative break-inside-avoid pl-5 leading-relaxed">
          <span
            aria-hidden
            className="absolute top-[0.62em] left-0 h-1.5 w-1.5 rounded-full bg-bivi-blue"
          />
          {texto}
        </li>
      ))}
    </ul>
  );
}

function Medicacion({ items }: { items: MedicacionItem[] }) {
  return (
    <ul className="divide-y divide-bivi-border/70 overflow-hidden rounded-xl border border-bivi-border/70">
      {items.map((m, i) => (
        <li key={i} className="break-inside-avoid px-4 py-3">
          <p className="font-bold text-bivi-text">{m.nombre}</p>
          <p className="mt-0.5 text-sm text-bivi-muted">{m.detalle}</p>
        </li>
      ))}
    </ul>
  );
}

function Estudio({ estudio }: { estudio: EstudioItem }) {
  return (
    <li className="break-inside-avoid rounded-xl border border-bivi-border/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-bold text-bivi-text">{estudio.titulo}</p>
        <p className="text-xs font-bold tabular-nums text-bivi-blue">
          {formatearFecha(estudio.fecha)}
        </p>
      </div>
      <p className="mt-0.5 text-xs tracking-wide text-bivi-muted uppercase">{estudio.tipo}</p>
      {estudio.resumen && <p className="mt-2.5 text-sm leading-relaxed">{estudio.resumen}</p>}
      {estudio.valores.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {estudio.valores.map((v, i) => (
            <li
              key={i}
              className="rounded-lg bg-bivi-blue-soft px-2 py-1 text-xs font-bold text-bivi-blue"
            >
              {v}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function HistoriaDocumento({ historia }: { historia: Historia }) {
  const { paciente, medicacion, medicacionPrevia, estudios } = historia;

  return (
    <article id="zona-impresion" data-selectable className="text-bivi-text">
      <header className="border-b-2 border-bivi-text/85 pb-4">
        <p className="text-xs font-bold tracking-[0.14em] text-bivi-blue uppercase">
          Historia clínica resumida
        </p>
        <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
          {paciente.nombre}
        </h2>
        <p className="mt-1 text-sm text-bivi-muted">
          {paciente.edad} años · Generada el {formatearFecha(historia.generadaEl)} con BiVi
        </p>
      </header>

      <div className="mt-7">
        <Seccion numero="01" titulo="Antecedentes patológicos">
          {historia.antecedentes.length > 0 ? (
            <Vinetas items={historia.antecedentes} />
          ) : (
            <SinDatos>No figuran antecedentes en la documentación cargada.</SinDatos>
          )}
        </Seccion>

        <Seccion numero="02" titulo="Medicación habitual">
          {medicacion.length > 0 ? (
            <Medicacion items={medicacion} />
          ) : (
            <SinDatos>Sin medicación en curso registrada.</SinDatos>
          )}

          {medicacionPrevia.length > 0 && (
            <>
              <p className="mt-5 mb-2.5 text-xs font-bold tracking-wide text-bivi-muted uppercase">
                Tratamientos previos registrados
              </p>
              <Medicacion items={medicacionPrevia} />
            </>
          )}
        </Seccion>

        <Seccion numero="03" titulo="Enfermedad actual">
          {historia.enfermedadActual.length > 0 ? (
            <div className="space-y-3">
              {historia.enfermedadActual.map((parrafo, i) => (
                <p key={i} className="leading-relaxed">
                  {parrafo}
                </p>
              ))}
            </div>
          ) : (
            <SinDatos>Sin datos cargados sobre el cuadro actual.</SinDatos>
          )}
        </Seccion>

        <Seccion numero="04" titulo="Impresión diagnóstica">
          {historia.impresionDiagnostica.length > 0 ? (
            <>
              <Vinetas items={historia.impresionDiagnostica} />
              <p className="mt-3 text-sm text-bivi-muted">
                Diagnósticos transcriptos de la documentación aportada. BiVi no elabora
                diagnósticos propios.
              </p>
            </>
          ) : (
            <SinDatos>
              No figuran diagnósticos escritos en la documentación cargada.
            </SinDatos>
          )}
        </Seccion>

        {estudios.length > 0 && (
          <Seccion numero="—" titulo="Estudios y documentos aportados">
            <ul className="space-y-3">
              {estudios.map((e, i) => (
                <Estudio key={i} estudio={e} />
              ))}
            </ul>
          </Seccion>
        )}
      </div>

      <footer className="mt-9 break-inside-avoid border-t border-bivi-border pt-4 text-sm text-bivi-muted">
        Este resumen solo ordena la información cargada por el cuidador. No incluye
        indicaciones ni plan de tratamiento: no es un documento médico ni reemplaza la
        consulta profesional.
      </footer>
    </article>
  );
}
