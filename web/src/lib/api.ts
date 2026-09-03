const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function checkHealth(): Promise<{ status: string; db: string }> {
  const res = await fetch(`${API_URL}/health`);
  return res.json();
}
