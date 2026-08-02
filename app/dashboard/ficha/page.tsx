import FichaForm from './client';

export default function FichaPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
          Ficha
        </h1>
        <p className="mt-1 text-bivi-muted">Los datos de quien conversa con BiVi</p>
      </header>
      <FichaForm />
    </>
  );
}
