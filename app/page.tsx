'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/login');
    } else {
      const elder = localStorage.getItem('bivi_elder');
      if (!elder) {
        router.push('/dashboard');
      } else {
        router.push('/talk');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <p className="text-gray-600">Cargando...</p>
    </div>
  );
}
