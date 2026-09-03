import { useEffect, useState } from 'react';

function formatRelative(date: Date, now: Date): string {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 5) return 'justo ahora';
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `hace ${minutes} min`;
}

function LastUpdated({ date }: { date: Date | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!date) return null;

  return <span>Actualizado {formatRelative(date, now)}</span>;
}

export default LastUpdated;
