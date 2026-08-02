export interface Documento {
  id: string;
  nombre: string;
  storage_path: string;
  mime_type: string;
  tamano: number;
  resumen: string | null;
  datos: DatosExtraidos | null;
  procesado_en: string | null;
  created_at: string;
}

/** Lo que Gemini extrae de cada archivo al subirlo. */
export interface DatosExtraidos {
  tipo_documento: string;
  fecha_documento: string | null;
  titulo: string;
  valores_relevantes: string[];
}

export const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Tope comodo para el envio inline a Gemini (el bucket tambien lo aplica). */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
