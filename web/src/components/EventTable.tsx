import { Fragment, useState, type KeyboardEvent } from 'react';
import type { Event } from '@event-logger/shared';
import LevelBadge from './LevelBadge';
import styles from './EventTable.module.css';

interface EventTableProps {
  events: Event[];
  loading: boolean;
  error: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function EventTable({ events, loading, error }: EventTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleKeyDown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded(id);
    }
  }

  if (loading && events.length === 0) {
    return (
      <div className={styles.stateMessage} role="status">
        Cargando eventos...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.stateMessage} ${styles.errorState}`} role="alert">
        Error al cargar eventos: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return <div className={styles.stateMessage}>No hay eventos que coincidan con los filtros.</div>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Nivel</th>
          <th>Mensaje</th>
          <th>Origen</th>
          <th>Recibido</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          const isExpanded = expandedId === event.id;
          return (
            <Fragment key={event.id}>
              <tr
                className={styles.row}
                onClick={() => toggleExpanded(event.id)}
                onKeyDown={(e) => handleKeyDown(e, event.id)}
                tabIndex={0}
                role="button"
                aria-expanded={isExpanded}
              >
                <td data-label="Nivel">
                  <LevelBadge level={event.level} />
                </td>
                <td data-label="Mensaje" className={styles.message}>
                  {event.message}
                </td>
                <td data-label="Origen">{event.source}</td>
                <td data-label="Recibido">{formatDate(event.received_at)}</td>
              </tr>
              {isExpanded && (
                <tr className={styles.expandedRow}>
                  <td colSpan={4}>
                    <pre className={styles.metadata}>{JSON.stringify(event.metadata, null, 2)}</pre>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export default EventTable;
