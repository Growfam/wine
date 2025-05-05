/**
 * Це проста обгортка, що перенаправляє до TimeUtils
 * для зворотної сумісності
 *
 * @deprecated Використовуйте TimeUtils напряму
 */

import TimeUtils from './TimeUtils.js';

// Для зворотньої сумісності зі старим кодом створюємо глобальну змінну
window.TimeUtils = TimeUtils;

export default TimeUtils;