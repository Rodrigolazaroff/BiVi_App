import { getElder } from './actions';
import DashboardClient from './client';

export const metadata = {
  title: 'Dashboard | BiVi',
};

export default async function DashboardPage() {
  const elder = await getElder();

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-4xl font-bold text-blue-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 mb-8">Datos del adulto mayor</p>

        <DashboardClient initialElder={elder} />
      </div>
    </main>
  );
}
