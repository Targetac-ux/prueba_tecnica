import type { EventLevel } from '@event-logger/shared';
import styles from './LevelBadge.module.css';

const LEVEL_CLASS: Record<EventLevel, string> = {
  debug: styles.debug,
  info: styles.info,
  warning: styles.warning,
  error: styles.error,
  fatal: styles.fatal,
};

function LevelBadge({ level }: { level: EventLevel }) {
  return <span className={`${styles.badge} ${LEVEL_CLASS[level]}`}>{level}</span>;
}

export default LevelBadge;
