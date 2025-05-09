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

// Вирішення циклічної залежності: пряме імпортування замість імпорту з індексного файлу
import cacheService from 'js/tasks/api/core/cache.js';
import requestService from 'js/tasks/api/core/request.js';
import { CONFIG, API_VERSION, API_ERROR_CODES } from 'js/tasks/api/core/config.js';

// Експорт базових компонентів
export { cacheService, requestService, CONFIG, API_VERSION, API_ERROR_CODES };

// Експорт за замовчуванням
export default {
  cache: cacheService,
  request: requestService,
  config: CONFIG,
  version: API_VERSION,
  errorCodes: API_ERROR_CODES,
};