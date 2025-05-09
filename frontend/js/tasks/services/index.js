/**
 * Головний файл експорту сервісів завдань
 *
 * Експортує всі сервіси для роботи з завданнями
 */

// Експорт сервісів сховища
export { default as taskStore } from './store/index.js';

// Експорт сервісів прогресу
export { default as taskProgress } from './progress/index.js';

// Експорт сервісів верифікації
export { default as taskVerification } from './verification/index.js';

// Експорт сервісів інтеграції
export { default as taskIntegration } from './integration/index.js';

// Експорт сервісу щоденних бонусів
export { default as dailyBonusService } from './daily-bonus/index.js';
