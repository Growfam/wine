// Основні експорти з core
export { init, setPerformanceMode, getConfig, getState } from './core.js';

// Тільки для зовнішніх імпортів, внутрішні компоненти продовжують
// використовувати state і config безпосередньо з core.js
