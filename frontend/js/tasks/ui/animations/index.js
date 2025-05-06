/**
 * Animations - модуль анімацій UI для системи завдань
 * Відповідає за:
 * - Візуальні ефекти з оптимізованою продуктивністю
 * - Адаптивні анімації під різні пристрої
 * - Анімації нагород та завершення завдань
 * @version 3.0.0
 */

// Імпортуємо модулі
import { init, getConfig, getState, setPerformanceMode } from './core.js';
import { showReward, showDailyBonusReward, showCycleCompletionAnimation, updateUserBalance, animateTokenDay } from './rewards.js';
import { animateSuccessfulCompletion, showProgressAnimation, animateTaskStatusChange, animateTasksAppear, animateTasksFiltering } from './progress.js';
import { debounce, cleanup, createSuccessParticles, highlightElement, pulseElement, createRippleEffect } from './utils.js';

// Створюємо об'єкт для експорту
const Animations = {
    // Ініціалізація
    init,

    // Функції винагород
    showReward,
    showDailyBonusReward,
    showCycleCompletionAnimation,
    updateUserBalance,
    animateTokenDay,

    // Функції прогресу
    showProgressAnimation,
    animateSuccessfulCompletion,
    animateTaskStatusChange,
    animateTasksAppear,
    animateTasksFiltering,

    // Утиліти
    debounce,
    cleanup,
    createSuccessParticles,
    highlightElement,
    pulseElement,
    createRippleEffect,

    // Конфігурація
    getConfig,
    getState,
    setPerformanceMode
};

// Ініціалізуємо модуль при завантаженні сторінки
document.addEventListener('DOMContentLoaded', init);

// Для зворотної сумісності зі старим кодом
window.UI = window.UI || {};
window.UI.Animations = Animations;

// Експортуємо за замовчуванням
export default Animations;