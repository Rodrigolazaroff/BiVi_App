/** Ficha del adulto mayor. Refleja la tabla `elders`. */
export interface Elder {
  id: string;
  profile_id: string;
  full_name: string;
  age: number;
  favorite_topics: string[];
}

/** Lo que se necesita para armar el prompt en /talk. */
export type ElderProfile = Pick<Elder, 'full_name' | 'age' | 'favorite_topics'>;
