/**
 * Головний файл експорту сервісів завдань
 *
 * Експортує всі сервіси для роботи з завданнями
 */

// Експорт сервісів сховища
export { default as taskStore } from 'js/tasks/services/store/index.js';

// Експорт сервісів прогресу
export { default as taskProgress } from 'js/tasks/services/progress/index.js';

// Експорт сервісів верифікації
export { default as taskVerification } from 'js/tasks/services/verification/index.js';

// Експорт сервісів інтеграції
export { default as taskIntegration } from 'js/tasks/services/integration/index.js';

// Експорт сервісу щоденних бонусів
export { default as dailyBonusService } from 'js/tasks/services/daily-bonus/index.js';
