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

  // Функції для рівнів рефералів
  fetchReferralLevels,
  fetchReferralDetails,
  groupLevel2ByReferrers,

  // Стан для реферального посилання
  referralLinkReducer,
  initialReferralLinkState,
  ReferralLinkActionTypes,

  // Стан для прямих бонусів
  directBonusReducer,
  initialDirectBonusState,
  DirectBonusActionTypes,

  // Стан для рівнів рефералів
  referralLevelsReducer,
  initialReferralLevelsState,
  ReferralLevelsActionTypes
} from '../index.js';

// Стан додатку
let appState = {
  referralLink: initialReferralLinkState,
  directBonus: initialDirectBonusState,
  referralLevels: initialReferralLevelsState,
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
  } else if (action.type.startsWith('FETCH_REFERRAL_LEVELS') || action.type.startsWith('UPDATE_REFERRAL')) {
    // Оновлюємо стан рівнів рефералів
    appState.referralLevels = referralLevelsReducer(appState.referralLevels, action);
    // Оновлюємо UI після зміни стану
    renderReferralLevelsUI();
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

  // Отримуємо статистику рефералів
  getReferralStats(userId);

  // Налаштовуємо обробник для форми реєстрації реферала
  setupReferralRegistrationForm();

  // Налаштовуємо вкладки для структури рефералів
  setupReferralTabs();

  // Налаштовуємо обробник для деталей реферала
  setupReferralDetails();
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

      // Оновлюємо статистику рефералів після реєстрації
      await getReferralStats(appState.userId);
    } catch (error) {
      console.error('Error registering referral:', error);
      showToast(error.message || 'Помилка реєстрації реферала', 'error');
    }
  });
};

/**
 * Налаштовує вкладки для структури рефералів
 */
const setupReferralTabs = () => {
  const tabs = document.querySelectorAll('.referral-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Видаляємо клас active з усіх вкладок
      tabs.forEach(t => t.classList.remove('active'));

      // Додаємо клас active до обраної вкладки
      tab.classList.add('active');

      // Отримуємо ідентифікатор вкладки
      const tabId = tab.dataset.tab;

      // Приховуємо всі панелі
      const panes = document.querySelectorAll('.tab-pane');
      panes.forEach(pane => pane.classList.remove('active'));

      // Показуємо відповідну панель
      const activePane = document.getElementById(`${tabId}-tab`);
      if (activePane) {
        activePane.classList.add('active');
      }

      // Якщо це вкладка ієрархії, будуємо ієрархію рефералів
      if (tabId === 'hierarchy') {
        renderReferralHierarchy();
      }
    });
  });
};

/**
 * Налаштовує обробник для деталей реферала
 */
const setupReferralDetails = () => {
  // Налаштовуємо кнопку закриття деталей
  const closeButton = document.querySelector('.referral-details-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      const detailsContainer = document.getElementById('referral-details');
      if (detailsContainer) {
        detailsContainer.classList.remove('show');
      }
    });
  }

  // Налаштовуємо обробники кліків на елементи рефералів
  document.addEventListener('click', async (event) => {
    // Знаходимо найближчий елемент реферала
    const referralItem = event.target.closest('.referral-item');

    if (referralItem && referralItem.dataset.id) {
      // Отримуємо ID реферала
      const referralId = referralItem.dataset.id;

      try {
        // Відображаємо деталі реферала
        await showReferralDetails(referralId);
      } catch (error) {
        console.error('Error showing referral details:', error);
        showToast('Помилка отримання деталей реферала', 'error');
      }
    }
  });
};

/**
 * Відображає деталі реферала
 * @param {string} referralId - ID реферала
 */
const showReferralDetails = async (referralId) => {
  // Отримуємо деталі реферала
  try {
    const details = await fetchReferralDetails(referralId);

    // Оновлюємо елементи інтерфейсу
    document.getElementById('detail-id').textContent = details.id;

    // Форматуємо дату
    const regDate = new Date(details.registrationDate);
    document.getElementById('detail-date').textContent =
      `${regDate.getDate()}.${regDate.getMonth() + 1}.${regDate.getFullYear()}`;

    // Встановлюємо статус
    document.getElementById('detail-status').textContent =
      details.active ? 'Активний' : 'Неактивний';
    document.getElementById('detail-status').className =
      details.active ? 'detail-value active' : 'detail-value inactive';

    // Встановлюємо заробіток
    document.getElementById('detail-earnings').textContent =
      details.earnings || 0;

    // Форматуємо дату останньої активності
    if (details.lastActivity) {
      const lastActivityDate = new Date(details.lastActivity);
      document.getElementById('detail-last-activity').textContent =
        `${lastActivityDate.getDate()}.${lastActivityDate.getMonth() + 1}.${lastActivityDate.getFullYear()}`;
    } else {
      document.getElementById('detail-last-activity').textContent = '-';
    }

    // Встановлюємо кількість рефералів
    document.getElementById('detail-referral-count').textContent =
      details.referralCount || 0;

    // Показуємо контейнер деталей
    const detailsContainer = document.getElementById('referral-details');
    if (detailsContainer) {
      detailsContainer.classList.add('show');
    }
  } catch (error) {
    console.error('Error fetching referral details:', error);
    showToast('Помилка отримання деталей реферала', 'error');
    throw error;
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
 * Отримує статистику рефералів користувача
 * @param {string} userId - ID користувача
 */
const getReferralStats = async (userId) => {
  try {
    // Використовуємо дію для отримання статистики рефералів через Redux
    const statsData = await fetchReferralLevels(userId)(dispatch);

    // Додаткова обробка статистики (якщо потрібно)
    console.log('Referral stats loaded:', statsData);

    // Заповнюємо списки рефералів
    renderReferralLists(statsData);
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    showToast('Помилка при отриманні статистики рефералів', 'error');
  }
};

/**
 * Заповнює списки рефералів
 * @param {Object} statsData - Дані про рефералів
 */
const renderReferralLists = (statsData) => {
  // Заповнюємо список рефералів 1-го рівня
  const level1List = document.getElementById('level1-list');
  if (level1List && statsData.level1Data) {
    // Очищуємо список
    level1List.innerHTML = '';

    // Додаємо елементи
    statsData.level1Data.forEach(referral => {
      const referralItem = document.createElement('div');
      referralItem.className = 'referral-item level-1';
      referralItem.dataset.id = referral.id;
      referralItem.dataset.level = 1;

      // Форматуємо дату
      const regDate = new Date(referral.registrationDate);
      const formattedDate = `${regDate.getDate()}.${regDate.getMonth() + 1}.${regDate.getFullYear()}`;

      // Формуємо HTML для елемента
      referralItem.innerHTML = `
        <div class="referral-info">
          <div class="referral-id">${referral.id}</div>
          <div class="referral-date">${formattedDate}</div>
        </div>
        <div class="referral-stats">
          <div class="referral-earnings">+50</div>
          <div class="referral-status ${referral.active ? 'active' : 'inactive'}">${referral.active ? 'Активний' : 'Неактивний'}</div>
        </div>
      `;

      // Додаємо до списку
      level1List.appendChild(referralItem);
    });

    // Якщо список порожній, додаємо повідомлення
    if (statsData.level1Data.length === 0) {
      level1List.innerHTML = '<div class="empty-list">У вас ще немає рефералів 1-го рівня</div>';
    }
  }

  // Заповнюємо список рефералів 2-го рівня
  const level2List = document.getElementById('level2-list');
  if (level2List && statsData.level2Data) {
    // Очищуємо список
    level2List.innerHTML = '';

    // Додаємо елементи
    statsData.level2Data.forEach(referral => {
      const referralItem = document.createElement('div');
      referralItem.className = 'referral-item level-2';
      referralItem.dataset.id = referral.id;
      referralItem.dataset.level = 2;
      referralItem.dataset.referrerId = referral.referrerId;

      // Форматуємо дату
      const regDate = new Date(referral.registrationDate);
      const formattedDate = `${regDate.getDate()}.${regDate.getMonth() + 1}.${regDate.getFullYear()}`;

      // Формуємо HTML для елемента
      referralItem.innerHTML = `
        <div class="referral-info">
          <div class="referral-id">${referral.id}</div>
          <div class="referral-date">${formattedDate}</div>
          <div class="referral-referrer">Запросив: ${referral.referrerId}</div>
        </div>
        <div class="referral-stats">
          <div class="referral-earnings">+25</div>
          <div class="referral-status ${referral.active ? 'active' : 'inactive'}">${referral.active ? 'Активний' : 'Неактивний'}</div>
        </div>
      `;

      // Додаємо до списку
      level2List.appendChild(referralItem);
    });

    // Якщо список порожній, додаємо повідомлення
    if (statsData.level2Data.length === 0) {
      level2List.innerHTML = '<div class="empty-list">У вас ще немає рефералів 2-го рівня</div>';
    }
  }
};

/**
 * Будує ієрархію рефералів
 */
const renderReferralHierarchy = () => {
  const { level1Data, level2Data } = appState.referralLevels;
  const hierarchyContainer = document.getElementById('referral-hierarchy');

  if (!hierarchyContainer || !level1Data || !level2Data) return;

  // Очищуємо контейнер
  hierarchyContainer.innerHTML = '';

  // Якщо немає рефералів, показуємо повідомлення
  if (level1Data.length === 0) {
    hierarchyContainer.innerHTML = '<div class="empty-list">У вас ще немає рефералів</div>';
    return;
  }

  // Групуємо рефералів 2-го рівня за рефералами 1-го рівня
  const groupedReferrals = groupLevel2ByReferrers(level2Data, level1Data);

  // Додаємо елементи ієрархії
  level1Data.forEach(referral => {
    // Створюємо елемент реферала 1-го рівня
    const level1Node = document.createElement('div');
    level1Node.className = 'hierarchy-node level-1';
    level1Node.dataset.id = referral.id;

    // Форматуємо дату
    const regDate = new Date(referral.registrationDate);
    const formattedDate = `${regDate.getDate()}.${regDate.getMonth() + 1}.${regDate.getFullYear()}`;

    // Формуємо HTML для елемента
    level1Node.innerHTML = `
      <div class="hierarchy-user-id">${referral.id}</div>
      <div class="hierarchy-registration-date">${formattedDate}</div>
      <div class="hierarchy-active-badge ${referral.active ? 'active' : 'inactive'}">${referral.active ? 'Активний' : 'Неактивний'}</div>
    `;

    // Додаємо до контейнера
    hierarchyContainer.appendChild(level1Node);

    // Додаємо рефералів 2-го рівня, якщо є
    const group = groupedReferrals[referral.id];
    if (group && group.referrals && group.referrals.length > 0) {
      group.referrals.forEach(level2Referral => {
        // Створюємо елемент реферала 2-го рівня
        const level2Node = document.createElement('div');
        level2Node.className = 'hierarchy-node level-2';
        level2Node.dataset.id = level2Referral.id;

        // Додаємо з'єднувач
        const connector = document.createElement('div');
        connector.className = 'hierarchy-connector';
        level2Node.appendChild(connector);

        // Форматуємо дату
        const level2RegDate = new Date(level2Referral.registrationDate);
        const level2FormattedDate = `${level2RegDate.getDate()}.${level2RegDate.getMonth() + 1}.${level2RegDate.getFullYear()}`;

        // Формуємо HTML для елемента
        level2Node.innerHTML += `
          <div class="hierarchy-user-id">${level2Referral.id}</div>
          <div class="hierarchy-registration-date">${level2FormattedDate}</div>
          <div class="hierarchy-active-badge ${level2Referral.active ? 'active' : 'inactive'}">${level2Referral.active ? 'Активний' : 'Неактивний'}</div>
        `;

        // Додаємо до контейнера
        hierarchyContainer.appendChild(level2Node);
      });
    }
  });
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
  const totalEarningsElement = document.querySelector('.stats-card:nth-child(3) .stats-value');
  if (totalEarningsElement) {
    // Тут можемо оновити загальний заробіток з урахуванням всіх джерел доходу
    // У наступних етапах це буде сума бонусів та відсоткових винагород
    totalEarningsElement.textContent = totalBonus;
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

/**
 * Оновлює інтерфейс користувача відповідно до стану рівнів рефералів
 */
const renderReferralLevelsUI = () => {
  const {
    level1Count,
    level2Count,
    activeReferralsCount,
    totalReferralsCount,
    conversionRate,
    isLoading,
    error
  } = appState.referralLevels;

  // Оновлюємо кількість рефералів 1-го рівня
  const level1CountElement = document.querySelector('#level1-stats .stats-value');
  if (level1CountElement) {
    level1CountElement.textContent = level1Count;
  }

  // Оновлюємо кількість рефералів 2-го рівня
  const level2CountElement = document.querySelector('#level2-stats .stats-value');
  if (level2CountElement) {
    level2CountElement.textContent = level2Count;
  }

  // Оновлюємо кількість рефералів у лідерській дошці
  const referralCountElement = document.querySelector('.current-user .referral-count');
  if (referralCountElement) {
    referralCountElement.textContent = `${totalReferralsCount} рефералів`;
  }

  // Оновлюємо інформацію про структуру рефералів
  const totalReferralsCountElement = document.querySelector('.total-referrals-count');
  if (totalReferralsCountElement) {
    totalReferralsCountElement.textContent = totalReferralsCount;
  }

  const activeReferralsCountElement = document.querySelector('.active-referrals-count');
  if (activeReferralsCountElement) {
    activeReferralsCountElement.textContent = activeReferralsCount;
  }

  const conversionRateElement = document.querySelector('.conversion-rate');
  if (conversionRateElement) {
    // Форматуємо відсоток конверсії
    const formattedRate = (conversionRate * 100).toFixed(1);
    conversionRateElement.textContent = `${formattedRate}%`;
  }

  // Додаємо анімацію для елементів, якщо змінилась кількість
  if (level1Count > 0) {
    level1CountElement?.classList.add('increasing');
    setTimeout(() => {
      level1CountElement?.classList.remove('increasing');
    }, 1500);
  }

  if (level2Count > 0) {
    level2CountElement?.classList.add('increasing');
    setTimeout(() => {
      level2CountElement?.classList.remove('increasing');
    }, 1500);
  }

  // Відображаємо індикатор завантаження, якщо потрібно
  if (isLoading) {
    const statCards = document.querySelectorAll('.stats-card');
    statCards.forEach(card => {
      card.classList.add('loading');
    });
  } else {
    const statCards = document.querySelectorAll('.stats-card');
    statCards.forEach(card => {
      card.classList.remove('loading');
    });
  }

  // Відображаємо помилку, якщо вона є
  if (error) {
    console.error('Referral levels error:', error);
    // Тут можна додати логіку для відображення помилки
  }
};

// Ініціалізуємо реферальну систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initReferralSystem);

// Експортуємо функції для можливого використання з інших файлів
export {
  getReferralLink,
  registerNewReferral,
  getDirectBonusHistory,
  getReferralStats
};