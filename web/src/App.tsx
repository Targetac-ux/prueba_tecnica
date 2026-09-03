import { useEffect, useState } from 'react';
import { checkHealth } from './lib/api.ts';

function App() {
  const [status, setStatus] = useState<string>('checking...');

  useEffect(() => {
    checkHealth()
      .then((data) => setStatus(`status: ${data.status}, db: ${data.db}`))
      .catch(() => setStatus('status: error (no se pudo conectar a la API)'));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Event Logger</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;
