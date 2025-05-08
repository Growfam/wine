/**
 * Головний файл експорту сервісів завдань
 *
 * Експортує всі сервіси для роботи з завданнями
 */

// Експорт сервісів сховища
export { default as taskStore } from './store';

// Експорт сервісів прогресу
export { default as taskProgress } from './progress';

// Експорт сервісів верифікації
export { default as taskVerification } from './verification';

// Експорт сервісів інтеграції
export { default as taskIntegration } from './integration';