import { useEffect, useState } from 'react';
import type { EventLevel } from '@event-logger/shared';
import type { FilterState } from '../hooks/useFilters';
import LevelBadge from './LevelBadge';
import styles from './Filters.module.css';

const ALL_LEVELS: EventLevel[] = ['debug', 'info', 'warning', 'error', 'fatal'];

interface FiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

function Filters({ filters, onChange }: FiltersProps) {
  const [qInput, setQInput] = useState(filters.q);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (qInput !== filters.q) {
        onChange({ ...filters, q: qInput });
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  function toggleLevel(level: EventLevel) {
    const nextLevels = filters.level.includes(level)
      ? filters.level.filter((l) => l !== level)
      : [...filters.level, level];
    onChange({ ...filters, level: nextLevels });
  }

  return (
    <div className={styles.filters}>
      <div className={styles.levelGroup} role="group" aria-label="Filtrar por nivel">
        {ALL_LEVELS.map((level) => (
          <label key={level} className={styles.levelOption}>
            <input
              type="checkbox"
              checked={filters.level.includes(level)}
              onChange={() => toggleLevel(level)}
            />
            <LevelBadge level={level} />
          </label>
        ))}
      </div>

      <div className={styles.dateGroup}>
        <label className={styles.dateField}>
          <span>Desde</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
          />
        </label>
        <label className={styles.dateField}>
          <span>Hasta</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
          />
        </label>
      </div>

      <input
        type="search"
        className={styles.search}
        placeholder="Buscar en el mensaje..."
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
        aria-label="Buscar en el mensaje"
      />
    </div>
  );
}

export default Filters;
