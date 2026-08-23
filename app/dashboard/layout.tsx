import BottomNav from '@/components/BottomNav';

/**
 * Marco comun del panel: fondo, ancho y la navegacion inferior.
 *
 * El control de acceso ya lo hizo proxy.ts, y cada pestania busca solo sus
 * datos: separar las rutas evita que la pantalla de inicio pague las consultas
 * de medicamentos o documentos que quiza nadie mire.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-bivi-bg px-4 pt-10 pb-28">
      <div className="mx-auto max-w-xl">{children}</div>
      <BottomNav />
    </main>
  );
}
