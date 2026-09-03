import { useState, type FormEvent } from 'react';
import { setApiKey } from '../lib/auth';
import styles from './ApiKeyGate.module.css';

interface ApiKeyGateProps {
  onSubmit: () => void;
  wasInvalid?: boolean;
}

function ApiKeyGate({ onSubmit, wasInvalid }: ApiKeyGateProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    onSubmit();
  }

  return (
    <div className={styles.overlay}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Event Logger</h1>
        <p className={styles.subtitle}>Ingresa tu API key para continuar</p>
        {wasInvalid && <p className={styles.error}>La API key no es válida. Intenta de nuevo.</p>}
        <input
          className={styles.input}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="API key"
          autoFocus
        />
        <button className={styles.button} type="submit" disabled={!value.trim()}>
          Entrar
        </button>
      </form>
    </div>
  );
}

export default ApiKeyGate;
