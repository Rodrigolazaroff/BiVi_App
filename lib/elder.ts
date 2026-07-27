/** Ficha del adulto mayor. Refleja la tabla `elders`. */
export interface Elder {
  id: string;
  profile_id: string;
  full_name: string;
  age: number;
  favorite_topics: string[];
}

/** Lo que necesita /talk: armar el prompt y registrar la conversacion. */
export type ElderProfile = Pick<Elder, 'id' | 'full_name' | 'age' | 'favorite_topics'>;
