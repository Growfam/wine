// Загальна точка входу для всіх утиліт
export * from 'js/tasks/utils/core/index.js';
export * from 'js/tasks/utils/data/index.js';
export * from 'js/tasks/utils/dom/index.js';
export * from 'js/tasks/utils/time/index.js';
export * from 'js/tasks/utils/validation/index.js';
export * from 'js/tasks/utils/services/index.js'; // Додали експорт сервісів

// Експорт модулів для прямого доступу
import * as Core from 'js/tasks/utils/core/index.js';
import * as Data from 'js/tasks/utils/data/index.js';
import * as DOM from 'js/tasks/utils/dom/index.js';
import * as Time from 'js/tasks/utils/time/index.js';
import * as Validation from 'js/tasks/utils/validation/index.js';
import * as Services from 'js/tasks/utils/services/index.js'; // Додали імпорт сервісів

export { Core, Data, DOM, Time, Validation, Services }; // Додали Services

// Експорт фабрики сервісів для зручності
export { default as serviceFactory } from 'js/tasks/utils/services/index.js';