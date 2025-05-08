/**
 * Модуль ядра API завдань
 *
 * Експортує базові компоненти для роботи API:
 * - Сервіс кешування
 * - Конфігурацію
 * - Сервіс запитів
 *
 * @version 3.1.0
 */

import cacheService from './cache.js';
import requestService from './request.js';
import { CONFIG, API_VERSION, API_ERROR_CODES } from './config.js';

export { cacheService, requestService, CONFIG, API_VERSION, API_ERROR_CODES };

export default {
  cache: cacheService,
  request: requestService,
  config: CONFIG,
  version: API_VERSION,
  errorCodes: API_ERROR_CODES,
};
