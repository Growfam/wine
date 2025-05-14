/**
 * Інтеграція реферальної системи з інтерфейсом користувача
 *
 * Використовує модульну реферальну систему для взаємодії з UI
 * Обробляє події користувача і відображає відповідну інформацію
 */

import {
  // Базові функції реферальної системи
  generateReferralLink,
  fetchReferralLink,

  // Функції для прямих бонусів
  registerReferralAndAwardBonus,
  fetchDirectBonusHistory,
  DIRECT_BONUS_AMOUNT,

  // Стан для реферального посилання
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes,

  // Стан для прямих бонусів
  directBonusReducer,
  initialDirectBonusState,
  DirectBonusActionTypes
} from '../index.js';

// Стан додатку
let appState = {
  referralLink: initialReferralLinkState,
  directBonus: initialDirectBonusState,
  userId: null
};

// Простий механізм для обробки змін стану (імітація Redux)
const dispatch = (action) => {
  // Визначаємо, який редуктор використовувати на основі типу дії
  if (action.type.startsWith('FETCH_REFERRAL_LINK')) {
    // Оновлюємо стан реферального посилання
    appState.referralLink = referralLinkReducer(appState.referralLink, action);
    // Оновлюємо UI після зміни стану
    renderReferralUI();
  } else if (action.type.startsWith('REGISTER_REFERRAL') || action.type.startsWith('FETCH_DIRECT_BONUS')) {
    // Оновлюємо стан прямих бонусів
    appState.directBonus = directBonusReducer(appState.directBonus, action);
    // Оновлюємо UI після зміни стану
    renderDirectBonusUI();
  }
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

  // Отримуємо історію прямих бонусів
  getDirectBonusHistory(userId);

  // Налаштовуємо обробник для форми реєстрації реферала
  setupReferralRegistrationForm();
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

  // Відображаємо розмір бонусу у відповідних елементах інтерфейсу
  const bonusAmountElements = document.querySelectorAll('.bonus-amount');
  bonusAmountElements.forEach(element => {
    element.textContent = DIRECT_BONUS_AMOUNT;
  });
};

/**
 * Налаштовує форму реєстрації реферала
 */
const setupReferralRegistrationForm = () => {
  const registerForm = document.querySelector('#referral-registration-form');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const referralId = registerForm.querySelector('#referral-id').value.trim();
    if (!referralId) {
      showToast('Будь ласка, введіть ID реферала', 'error');
      return;
    }

    try {
      // Реєструємо реферала і нараховуємо бонус
      await registerNewReferral(appState.userId, referralId);
    } catch (error) {
      console.error('Error registering referral:', error);
      showToast(error.message || 'Помилка реєстрації реферала', 'error');
    }
  });
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
 * Отримує історію прямих бонусів користувача
 * @param {string} userId - ID користувача
 */
const getDirectBonusHistory = async (userId) => {
  try {
    // Використовуємо дію для отримання історії бонусів через Redux
    const historyData = await fetchDirectBonusHistory(userId)(dispatch);

    // Додаткова обробка історії (якщо потрібно)
    console.log('Bonus history loaded:', historyData);
  } catch (error) {
    console.error('Error fetching bonus history:', error);
    showToast('Помилка при отриманні історії бонусів', 'error');
  }
};

/**
 * Реєструє нового реферала і нараховує бонус
 * @param {string} referrerId - ID реферера (поточного користувача)
 * @param {string} userId - ID нового користувача (реферала)
 */
const registerNewReferral = async (referrerId, userId) => {
  try {
    // Використовуємо дію для реєстрації реферала через Redux
    const bonusData = await registerReferralAndAwardBonus(referrerId, userId)(dispatch);

    // Оновлюємо загальний баланс користувача
    updateUserBalance(bonusData.bonusAmount);

    // Показуємо повідомлення про успішне нарахування бонусу
    showToast(`Бонус ${bonusData.bonusAmount} winix нараховано!`);

    // Очищуємо форму
    const referralIdInput = document.querySelector('#referral-id');
    if (referralIdInput) {
      referralIdInput.value = '';
    }

    return bonusData;
  } catch (error) {
    console.error('Error registering referral:', error);
    throw error;
  }
};

/**
 * Оновлює баланс користувача
 * @param {number} amount - Сума для додавання до балансу
 */
const updateUserBalance = (amount) => {
  const userCoinsElement = document.getElementById('user-coins');
  if (!userCoinsElement) return;

  // Отримуємо поточний баланс
  const currentBalance = parseInt(userCoinsElement.textContent, 10) || 0;

  // Додаємо бонус
  const newBalance = currentBalance + amount;

  // Оновлюємо відображення з анімацією
  userCoinsElement.classList.add('increasing');
  userCoinsElement.textContent = newBalance;

  // Видаляємо клас анімації після її завершення
  setTimeout(() => {
    userCoinsElement.classList.remove('increasing');
  }, 1500);
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

/**
 * Оновлює інтерфейс користувача відповідно до стану прямих бонусів
 */
const renderDirectBonusUI = () => {
  const { totalBonus, history, isLoading, error } = appState.directBonus;

  // Оновлюємо відображення загальної суми бонусів
  const totalBonusElement = document.querySelector('.total-bonus-amount');
  if (totalBonusElement) {
    totalBonusElement.textContent = totalBonus;
  }

  // Оновлюємо дані в статистиці
  const statsValueElement = document.querySelector('.stats-card:nth-child(3) .stats-value');
  if (statsValueElement) {
    statsValueElement.textContent = totalBonus;
  }

  // Оновлюємо лічильник рефералів
  const referralsCountElement = document.querySelector('.stats-card:nth-child(1) .stats-value');
  if (referralsCountElement && history) {
    referralsCountElement.textContent = history.length;
  }

  // Оновлюємо історію бонусів (якщо є відповідний контейнер)
  const historyContainer = document.querySelector('.bonus-history-items');
  if (historyContainer && history && history.length > 0) {
    // Очищуємо контейнер
    historyContainer.innerHTML = '';

    // Додаємо нові елементи
    history.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'bonus-history-item';

      // Форматуємо дату
      const date = new Date(item.timestamp);
      const formattedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;

      // Формуємо HTML для елемента історії
      historyItem.innerHTML = `
        <div class="history-date">${formattedDate}</div>
        <div class="history-info">
          <div class="history-type">Запрошено реферала</div>
          <div class="history-user-id">ID: ${item.userId}</div>
        </div>
        <div class="history-amount">+${item.bonusAmount}</div>
      `;

      // Додаємо до контейнера
      historyContainer.appendChild(historyItem);
    });

    // Показуємо контейнер
    historyContainer.style.display = 'block';
  }

  // Оновлюємо текст лідерської дошки
  const userReferralCount = document.querySelector('.current-user .referral-count');
  if (userReferralCount && history) {
    userReferralCount.textContent = `${history.length} рефералів`;
  }

  // Оновлюємо текст винагороди користувача
  const userReward = document.querySelector('.current-user .user-reward');
  if (userReward) {
    userReward.textContent = totalBonus;
  }

  // Відображаємо індикатор завантаження, якщо потрібно
  if (isLoading) {
    // Тут можна додати логіку для відображення індикатора завантаження
  }

  // Відображаємо помилку, якщо вона є
  if (error) {
    console.error('Direct bonus error:', error);
    // Тут можна додати логіку для відображення помилки
  }
};

// Ініціалізуємо реферальну систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initReferralSystem);

// Експортуємо функції для можливого використання з інших файлів
export {
  getReferralLink,
  registerNewReferral,
  getDirectBonusHistory
};