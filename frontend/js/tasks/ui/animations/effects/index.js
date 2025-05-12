/**
 * Експорт модулів анімаційних ефектів
 * Єдиний інтерфейс для всіх анімаційних ефектів системи завдань
 */

// Прямий експорт з підмодулів
export * from './particles.js';
export * from './transitions.js';

// Імпорт для агрегованого експорту
import * as particlesModule from './particles.js';
import * as transitionsModule from '../../../ui/animations/effects/transitions.js';

// Отримання експорту за замовчуванням або модуля цілком
const particles = particlesModule.default || particlesModule;
const transitions = transitionsModule.default || transitionsModule;

// Додатковий експорт для зручності
export const Effects = {
  particles,
  transitions,
};

// Експорт за замовчуванням
export default Effects;