/**
 * Модуль сервісних утиліт
 *
 * Експортує сервісні утиліти для роботи з системою завдань
 */

import serviceFactory from './service-factory.js';

// Експортуємо фабрику сервісів за замовчуванням
export default serviceFactory;

// Іменовані експорти для зручного використання
export {
  serviceFactory
};