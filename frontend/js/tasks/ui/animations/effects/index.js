/**
 * Експорт модулів анімаційних ефектів
 * Єдиний інтерфейс для всіх анімаційних ефектів системи завдань
 */

// Прямий експорт з підмодулів
export * from 'js/tasks/ui/animations/effects/particles.js';
export * from 'js/tasks/ui/animations/effects/transitions.js';

// Імпорт для агрегованого експорту
import * as particlesModule from 'js/tasks/ui/animations/effects/particles.js';
import * as transitionsModule from 'js/tasks/ui/animations/effects/transitions.js';

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