import { app } from './app.ts';
import { logger } from './lib/logger.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  logger.info(`API listening on port ${PORT}`);
});
