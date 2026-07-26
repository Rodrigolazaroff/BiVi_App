import Image from 'next/image';

/**
 * Marca BiVi.
 *
 * El archivo original es cuadrado, con fondo celeste y un destello decorativo
 * en la esquina inferior derecha. Se recorta en circulo para quedarnos con el
 * emblema limpio: el degrade azul-verde y la palabra BiVi ya vienen adentro,
 * asi que no hace falta repetir el nombre al lado.
 */
export default function BiviLogo({
  size = 88,
  className = '',
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-bivi.png"
      alt="BiVi"
      width={size}
      height={size}
      priority={priority}
      className={`rounded-full ring-1 ring-bivi-border/60 shadow-sm ${className}`}
    />
  );
}
