/**
 * Точка входу для основних утиліт
 *
 * Експортує всі функції модулів logger та dependency
 * для зручного імпорту.
 *
 * @version 1.0.0
 */

import container, { DependencyContainer } from './dependency.js';
import logger, * as loggerExports from './logger.js';

// Реекспорт всіх утиліт
export {
  // Dependency container
  container,
  DependencyContainer,

  // Logger
  logger,
  getLogger,
  configure as configureLogger,
  getLogs,
  clearLogs,
  disableLogging,
  enableLogging,
  LOG_LEVELS,
  LOG_CATEGORIES,
  ERROR_LEVELS,
  ERROR_CATEGORIES,
  errorHandler,
} from './logger.js';

// Експорт за замовчуванням
export default {
  // Dependency container
  container,
  DependencyContainer,

  // Logger
  logger,
  ...loggerExports,
};
