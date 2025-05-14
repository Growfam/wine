/**
 * Індексний файл сервісів
 *
 * Експортує всі сервіси з модуля для зручного імпорту
 */

// Експортуємо сервіс генерації реферального посилання
export * from './generateReferralLink';

// Експортуємо сервіс розрахунку прямих бонусів
export * from './calculateDirectBonus';

// Експортуємо сервіси розрахунку кількості рефералів
export * from './calculateLevel1Count';
export * from './calculateLevel2Count';