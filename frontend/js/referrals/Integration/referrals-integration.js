/**
 * Інтеграція реферальної системи з інтерфейсом користувача
 *
 * Використовує модульну реферальну систему для взаємодії з UI
 * Обробляє події користувача і відображає відповідну інформацію
 */

import {
  generateReferralLink,
  fetchReferralLink,
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes
} from '../index.js';

// Стан додатку
let appState = {
  referralLink: initialReferralLinkState,
  userId: null
};

// Простий механізм для обробки змін стану (імітація Redux)
const dispatch = (action) => {
  // Оновлюємо стан реферального посилання
  appState.referralLink = referralLinkReducer(appState.referralLink, action);

  // Оновлюємо UI після зміни стану
  renderReferralUI();
};

/**
 * Ініціалізує функціонал реферальної системи
 */
export const initReferralSystem = () => {
  // Отримуємо ID користувача (в реальному додатку це могло б бути з API або localStorage)
  const userId = getUserId();
  appState.userId = userId;

  // Елементи інтерфейсу
  setupUIElements();

  // Генеруємо реферальне посилання при ініціалізації
  getReferralLink(userId);
};

/**
 * Отримує ID поточного користувача
 * @returns {string} ID користувача
 */
const getUserId = () => {
  // В реальному додатку це могло б бути з API або localStorage
  // Отримуємо ID з елемента інтерфейсу (для демонстрації)
  const userIdElement = document.querySelector('.user-id-value');
  return userIdElement ? userIdElement.textContent : 'WX54321';
};

/**
 * Налаштовує елементи інтерфейсу
 */
const setupUIElements = () => {
  // Налаштовуємо кнопку копіювання
  const copyButton = document.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', handleCopyButtonClick);
  }
};

/**
 * Обробляє клік на кнопку копіювання
 * @param {Event} event - Подія кліку
 */
const handleCopyButtonClick = async (event) => {
  event.preventDefault();

  // Копіюємо реферальне посилання
  copyToClipboard(appState.referralLink.link);
};

/**
 * Копіює текст у буфер обміну
 * @param {string} text - Текст для копіювання
 */
const copyToClipboard = (text) => {
  if (!text) return;

  // Копіюємо текст у буфер обміну
  navigator.clipboard.writeText(text)
    .then(() => {
      // Відображаємо сповіщення про успішне копіювання
      showToast('Посилання скопійовано!');

      // Додаємо анімацію натискання
      const copyButton = document.querySelector('.copy-button');
      if (copyButton) {
        copyButton.classList.add('clicked');

        // Видаляємо клас після завершення анімації
        setTimeout(() => {
          copyButton.classList.remove('clicked');
        }, 300);
      }
    })
    .catch((err) => {
      console.error('Помилка при копіюванні:', err);
      // Запасний варіант копіювання
      fallbackCopy(text);
    });
};

/**
 * Запасний варіант копіювання тексту
 * @param {string} text - Текст для копіювання
 */
const fallbackCopy = (text) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('Посилання скопійовано!');
    } else {
      showToast('Помилка копіювання. Спробуйте вручну.', 'error');
    }
  } catch (err) {
    console.error('Помилка при резервному копіюванні:', err);
    showToast('Помилка копіювання. Спробуйте вручну.', 'error');
  }

  document.body.removeChild(textArea);
};

/**
 * Відображає спливаюче повідомлення
 * @param {string} message - Текст повідомлення
 * @param {string} [type='success'] - Тип повідомлення ('success' або 'error')
 */
const showToast = (message, type = 'success') => {
  const toast = document.getElementById('copy-toast');
  if (!toast) return;

  // Встановлюємо текст повідомлення
  toast.textContent = message;

  // Встановлюємо клас типу повідомлення
  toast.className = 'toast-message';
  if (type === 'error') {
    toast.classList.add('error');
  } else {
    toast.classList.add('success');
  }

  // Показуємо повідомлення
  toast.classList.add('show');

  // Автоматично ховаємо повідомлення через 3 секунди
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
};

/**
 * Генерує реферальне посилання для користувача
 * @param {string} userId - ID користувача
 */
const getReferralLink = async (userId) => {
  try {
    // Диспатчимо початок запиту
    dispatch({ type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_REQUEST });

    // Генеруємо посилання
    const link = await generateReferralLink(userId);

    // Диспатчимо успішне отримання
    dispatch({
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_SUCCESS,
      payload: { link }
    });
  } catch (error) {
    console.error('Error getting referral link:', error);

    // Диспатчимо помилку
    dispatch({
      type: ReferralLinkActionTypes.FETCH_REFERRAL_LINK_FAILURE,
      payload: { error: error.message || 'Failed to get referral link' }
    });

    // Показуємо повідомлення про помилку
    showToast('Помилка при отриманні реферального посилання. Спробуйте пізніше.', 'error');
  }
};

/**
 * Оновлює інтерфейс користувача відповідно до стану реферального посилання
 */
const renderReferralUI = () => {
  const { link, isLoading, error } = appState.referralLink;

  // Отримуємо елементи інтерфейсу
  const linkDisplay = document.querySelector('.link-display');
  const linkContainer = document.querySelector('.referral-link-container');
  const copyButton = document.querySelector('.copy-button');

  // Показуємо індикатор завантаження, якщо дані завантажуються
  if (isLoading) {
    // Додаємо клас завантаження до контейнера
    if (linkContainer) {
      linkContainer.classList.add('loading');
    }

    // Вимикаємо кнопку копіювання
    if (copyButton) {
      copyButton.disabled = true;
    }

    // Змінюємо текст на індикатор завантаження
    if (linkDisplay) {
      linkDisplay.textContent = 'Завантаження...';
    }

    return;
  }

  // Видаляємо клас завантаження
  if (linkContainer) {
    linkContainer.classList.remove('loading');
  }

  // Включаємо кнопку копіювання, якщо є посилання
  if (copyButton) {
    copyButton.disabled = !link;
  }

  // Показуємо помилку, якщо вона є
  if (error) {
    if (linkDisplay) {
      linkDisplay.textContent = 'Помилка отримання посилання';
    }
    return;
  }

  // Показуємо реферальне посилання, якщо воно є
  if (link && linkDisplay) {
    linkDisplay.textContent = link;
  }
};

// Ініціалізуємо реферальну систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initReferralSystem);

// Експортуємо функції для можливого використання з інших файлів
export { getReferralLink };