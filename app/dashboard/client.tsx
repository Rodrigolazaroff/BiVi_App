'use client';

import { useState, useEffect } from 'react';
import InstallButton from '@/components/InstallButton';
import { useAuth } from '@/lib/auth-context';

interface Elder {
  full_name: string;
  age: number;
  favorite_topics: string[];
}

export default function DashboardClient() {
  const { logout } = useAuth();
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [topics, setTopics] = useState<[string, string, string]>(['', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bivi_elder');
    if (stored) {
      try {
        const elder: Elder = JSON.parse(stored);
        setFullName(elder.full_name);
        setAge(elder.age.toString());
        setTopics([
          elder.favorite_topics[0] || '',
          elder.favorite_topics[1] || '',
          elder.favorite_topics[2] || '',
        ] as [string, string, string]);
      } catch (e) {
        console.error('Failed to load elder:', e);
      }
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (!fullName.trim() || !age) {
        throw new Error('Nombre y edad son requeridos');
      }

      const elder: Elder = {
        full_name: fullName,
        age: parseInt(age),
        favorite_topics: topics.filter(Boolean),
      };

      localStorage.setItem('bivi_elder', JSON.stringify(elder));
      setSuccess('Datos guardados correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Ficha del adulto */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Ficha del adulto mayor</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <input
            type="text"
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="number"
            placeholder="Edad"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min="18"
            max="150"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Temas favoritos (máximo 3)</label>
            {[0, 1, 2].map((idx) => (
              <input
                key={idx}
                type="text"
                placeholder={`Tema ${idx + 1}`}
                value={topics[idx]}
                onChange={(e) => {
                  const newTopics = [...topics] as [string, string, string];
                  newTopics[idx] = e.target.value;
                  setTopics(newTopics);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        {error && <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}
        {success && <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg">{success}</div>}
      </div>

      {/* Instalación PWA */}
      {fullName && <InstallButton elderName={fullName} />}

      {/* Logout */}
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <button
          onClick={logout}
          className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
