/**
 * WINIX Реферальна система - Модуль-адаптер для ES модулів
 *
 * Цей файл створений для забезпечення сумісності в середовищах,
 * де ES модулі можуть мати проблеми з прямим підключенням.
 * Він експортує всі необхідні модулі в глобальний об'єкт WinixReferral.
 */

// Імпортуємо модулі реферальної системи
import {
  generateReferralLink,
  formatReferralUrl,
  fetchReferralLinkFromAPI,
  fetchReferralLink,
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes,
  REFERRAL_URL_PATTERN
} from '../index.js';

// Створюємо глобальний об'єкт для доступу до функцій реферальної системи
window.WinixReferral = {
  // Основні функції
  generateReferralLink,
  formatReferralUrl,
  fetchReferralLinkFromAPI,

  // Функції для роботи зі станом
  fetchReferralLink,
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes,

  // Константи
  REFERRAL_URL_PATTERN
};

console.log('WINIX Реферальна система успішно ініціалізована!');