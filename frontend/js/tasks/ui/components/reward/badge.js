/**
 * RewardBadge - компонент для відображення винагороди за завдання
 *
 * Відповідає за:
 * - Відображення типу та кількості винагороди
 * - Анімацію при отриманні винагороди
 * - Різні формати відображення (компактний, розширений)
 */

// Імпорт необхідних залежностей
import { UI } from '../../index.js';
import { TaskRewards } from '../../services/task-store.js';

// Конфігурація
const CONFIG = {
    tokenSymbol: '$WINIX',
    coinLabel: 'жетонів',
    coinLabelSingle: 'жетон',
    coinLabelFew: 'жетони',
    animationDuration: 2000
};

/**
 * Створення бейджа з винагородою
 * @param {Object} reward - Дані про винагороду {type, amount}
 * @param {Object} options - Додаткові опції
 * @returns {HTMLElement} DOM елемент з винагородою
 */
export function create(reward, options = {}) {
    if (!reward || !reward.amount) {
        return document.createElement('div');
    }

    const badge = document.createElement('div');
    badge.className = 'reward-badge';

    if (options.compact) {
        badge.classList.add('compact');
    }

    if (reward.type === 'tokens') {
        badge.classList.add('token-reward');
    } else {
        badge.classList.add('coin-reward');
    }

    const symbol = reward.type === 'tokens'
        ? CONFIG.tokenSymbol
        : getCoinsLabel(reward.amount);

    badge.innerHTML = `
        <span class="reward-amount">${formatNumber(reward.amount)}</span>
        <span class="reward-symbol">${symbol}</span>
    `;

    return badge;
}

/**
 * Визначення правильної форми слова "жетон" залежно від кількості
 * @param {number} amount - Кількість жетонів
 * @returns {string} Правильна форма слова
 */
export function getCoinsLabel(amount) {
    // Спеціальні випадки для української мови
    if (amount % 10 === 1 && amount % 100 !== 11) {
        return CONFIG.coinLabelSingle;
    } else if ([2, 3, 4].includes(amount % 10) &&
              ![12, 13, 14].includes(amount % 100)) {
        return CONFIG.coinLabelFew;
    } else {
        return CONFIG.coinLabel;
    }
}

/**
 * Форматування числа для відображення
 * @param {number} number - Число для форматування
 * @returns {string} Відформатоване число
 */
export function formatNumber(number) {
    // Використовуємо форматтер з модуля task-formatter, якщо доступний
    if (typeof import('../../utils/formatter.js').formatNumber === 'function') {
        return import('../../utils/formatter.js').formatNumber(number);
    }

    // Запасний варіант - просте форматування
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Показати анімацію отримання винагороди
 * @param {Object} reward - Дані про винагороду {type, amount}
 * @param {Object} options - Додаткові опції
 */
export function showAnimation(reward, options = {}) {
    if (!reward || !reward.amount) return;

    // Перевіряємо наявність модуля анімацій
    if (UI && UI.Animations && UI.Animations.showReward) {
        UI.Animations.showReward(reward);
        return;
    }

    // Власна реалізація анімації
    const symbol = reward.type === 'tokens'
        ? CONFIG.tokenSymbol
        : getCoinsLabel(reward.amount);

    // Створюємо елемент анімації
    const anim = document.createElement('div');
    anim.className = 'reward-animation';
    anim.classList.add(reward.type === 'tokens' ? 'token-reward' : 'coin-reward');

    anim.innerHTML = `
        <span class="animation-prefix">+</span>
        <span class="animation-amount">${formatNumber(reward.amount)}</span>
        <span class="animation-symbol">${symbol}</span>
    `;

    // Додаємо до тіла документа
    document.body.appendChild(anim);

    // Запускаємо анімацію
    setTimeout(() => {
        anim.classList.add('show');

        // Видаляємо після завершення
        setTimeout(() => {
            anim.classList.remove('show');
            setTimeout(() => {
                anim.remove();
            }, 300);
        }, CONFIG.animationDuration);
    }, 10);

    // Оновлюємо баланс користувача, якщо доступний сервіс
    if (TaskRewards && TaskRewards.updateBalance) {
        TaskRewards.updateBalance(reward);
    }
}

// Експортуємо об'єкт з усіма функціями для зручності використання
export default {
    create,
    showAnimation,
    formatNumber,
    getCoinsLabel
};