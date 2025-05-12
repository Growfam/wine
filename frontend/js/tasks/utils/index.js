// Загальна точка входу для всіх утиліт
export * from './core/index.js';
export * from './data/index.js';
export * from './dom/index.js';
export * from './time/index.js';
export * from './validation/index.js';
export * from './services/index.js'; // Додали експорт сервісів

// Експорт модулів для прямого доступу
import * as Core from './core/index.js';
import * as Data from './data/index.js';
import * as DOM from './dom/index.js';
import * as Time from './time/index.js';
import * as Validation from './validation/index.js';
import * as Services from '../utils/services/index.js'; // Додали імпорт сервісів

export { Core, Data, DOM, Time, Validation, Services }; // Додали Services

// Експорт фабрики сервісів для зручності
export { default as serviceFactory } from './services/index.js';