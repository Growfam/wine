/**
 * Оновлений індексний файл сервісів
 *
 * Експортує всі сервіси з модуля для зручного імпорту
 * Додано експорт сервісу перевірки активності рефералів
 */

// Експортуємо сервіс генерації реферального посилання
export * from './generateReferralLink';

// Експортуємо сервіс розрахунку прямих бонусів
export * from './calculateDirectBonus';

// Експортуємо сервіси розрахунку кількості рефералів
export * from './calculateLevel1Count';
export * from './calculateLevel2Count';

// Експортуємо сервіси розрахунку винагород за рівнями
export * from './calculateLevel1Reward';
export * from './calculateLevel2Reward';

// Експортуємо сервіс перевірки активності рефералів
export * from './checkReferralActivity';