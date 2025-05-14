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
  ReferralLevelsActionTypes,

  // Функції для відсоткових винагород (Етап 4)
  fetchLevelRewards,
  LEVEL_1_REWARD_RATE,
  LEVEL_2_REWARD_RATE,
  levelRewardsReducer,
  initialLevelRewardsState,
  LevelRewardsActionTypes,

  // Функції для перевірки активності рефералів (Етап 5)
  fetchAndCheckReferralActivity,
  checkReferralsActivityWithAnalysis,
  checkSingleReferralActivity,
  MIN_DRAWS_PARTICIPATION,
  MIN_INVITED_REFERRALS,
  referralActivityReducer,
  initialReferralActivityState,
  ReferralActivityActionTypes,

  // Функції для бейджів та завдань (Етап 6)
  fetchUserBadges,
  fetchUserTasks,
  claimBadgeReward,
  claimTaskReward,
  BRONZE_BADGE_THRESHOLD,
  SILVER_BADGE_THRESHOLD,
  GOLD_BADGE_THRESHOLD,
  PLATINUM_BADGE_THRESHOLD,
  BRONZE_BADGE_REWARD,
  SILVER_BADGE_REWARD,
  GOLD_BADGE_REWARD,
  PLATINUM_BADGE_REWARD,
  REFERRAL_TASK_THRESHOLD,
  REFERRAL_TASK_REWARD,
  badgeReducer,
  initialBadgeState,
  BadgeActionTypes,

  // Функції для аналітики та рейтингу (Етап 7)
  getReferralRanking,
  getTopReferrals,
  findUserRankPosition,
  generateLeaderboard,
  analyzeEarningsStructure,
  sortReferralsByEarnings,
  sortByInvitedCount,
  sortByDrawsParticipation,
  filterAndSortReferrals,
  formatWinixAmount,

  // Функції для участі в розіграшах (Етап 7)
  fetchReferralDrawsAction,
  fetchDrawsStatsAction,
  fetchDrawsRankingAction,
  analyzeDrawsParticipationAction,
  getDrawsParticipationRecommendations,
  getReferralsByDrawsRanking,
  getDrawsParticipationSummary,
  drawParticipationReducer,
  initialDrawParticipationState,
  DrawParticipationActionTypes,

  // Функції для підсумкового розрахунку (Етап 8)
  calculateTotalRewardsAction,
  predictFutureRewardsAction,
  calculateROIAction,
  analyzeRewardsDistributionAction,
  comprehensiveRewardsAnalysisAction,
  calculateRewardsReducer,
  initialCalculateRewardsState,
  CalculateRewardsActionTypes
} from '../index.js';

// Стан додатку
let appState = {
  referralLink: initialReferralLinkState,
  directBonus: initialDirectBonusState,
  referralLevels: initialReferralLevelsState,
  levelRewards: initialLevelRewardsState,       // Відсоткові винагороди
  referralActivity: initialReferralActivityState, // Активність рефералів
  badges: initialBadgeState,                    // Бейджі та завдання
  drawParticipation: initialDrawParticipationState, // Участь у розіграшах
  rewardsCalculation: initialCalculateRewardsState, // Обчислення винагород
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
  // Обробка дій відсоткових винагород (Етап 4)
  else if (action.type.startsWith('FETCH_LEVEL_REWARDS') || action.type.startsWith('UPDATE_LEVEL')) {
    // Оновлюємо стан відсоткових винагород
    appState.levelRewards = levelRewardsReducer(appState.levelRewards, action);
    // Оновлюємо UI відсоткових винагород
    renderLevelRewardsUI();
  }
  // Обробка дій активності рефералів (Етап 5)
  else if (action.type.startsWith('FETCH_REFERRAL_ACTIVITY') || action.type.startsWith('CHECK_REFERRAL_ACTIVITY')) {
    // Оновлюємо стан активності рефералів
    appState.referralActivity = referralActivityReducer(appState.referralActivity, action);
    // Оновлюємо UI активності рефералів
    renderReferralActivityUI();
  }
  // Обробка дій бейджів та завдань (Етап 6)
  else if (action.type.startsWith('FETCH_BADGES') || action.type.startsWith('FETCH_TASKS') ||
           action.type.startsWith('CLAIM_BADGE') || action.type.startsWith('CLAIM_TASK')) {
    // Оновлюємо стан бейджів та завдань
    appState.badges = badgeReducer(appState.badges, action);
    // Оновлюємо UI бейджів та завдань
    renderBadgesAndTasksUI();
  }
  // Обробка дій участі в розіграшах (Етап 7)
  else if (action.type.startsWith('FETCH_REFERRAL_DRAWS') ||
           action.type.startsWith('FETCH_DRAWS_STATS') ||
           action.type.startsWith('FETCH_DRAWS_RANKING') ||
           action.type.startsWith('ANALYZE_DRAWS_PARTICIPATION')) {
    // Оновлюємо стан участі в розіграшах
    appState.drawParticipation = drawParticipationReducer(appState.drawParticipation, action);
    // Оновлюємо UI участі в розіграшах
    renderDrawParticipationUI();
  }
  // Обробка дій обчислення винагород (Етап 8)
  else if (action.type.startsWith('CALCULATE_TOTAL_REWARDS') ||
           action.type.startsWith('PREDICT_FUTURE_REWARDS') ||
           action.type.startsWith('CALCULATE_ROI') ||
           action.type.startsWith('ANALYZE_REWARDS_DISTRIBUTION') ||
           action.type.startsWith('COMPREHENSIVE_REWARDS_ANALYSIS')) {
    // Оновлюємо стан обчислення винагород
    appState.rewardsCalculation = calculateRewardsReducer(appState.rewardsCalculation, action);
    // Оновлюємо UI обчислення винагород
    renderTotalEarningsUI();
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

  // Отримуємо відсоткові винагороди (Етап 4)
  getLevelRewards(userId);

  // Отримуємо дані про активність рефералів (Етап 5)
  getReferralActivity(userId);

  // Автоматично обробляємо реферальний параметр з URL
autoProcessReferral();

  // Отримуємо дані про бейджі та завдання (Етап 6)
  getUserBadges(userId);
  getUserTasks(userId);

  // Налаштовуємо вкладки для структури рефералів
  setupReferralTabs();

  // Налаштовуємо обробник для деталей реферала
  setupReferralDetails();

  // Налаштовуємо обробники для бейджів та завдань
  setupBadgesAndTasksHandlers();

  // Отримуємо дані про участь у розіграшах (Етап 7)
  getReferralDrawsData(userId);
  getDrawsRanking(userId);

  // Налаштовуємо обробники для рейтингу та аналітики
  setupReferralRankingHandlers();

  // Отримуємо загальні дані про винагороди (Етап 8)
  calculateTotalEarnings(userId);
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

  // Відображаємо ставки відсоткових винагород у відповідних елементах
  const level1RateElements = document.querySelectorAll('.level1-rate');
  level1RateElements.forEach(element => {
    element.textContent = `${LEVEL_1_REWARD_RATE * 100}%`;
  });

  const level2RateElements = document.querySelectorAll('.level2-rate');
  level2RateElements.forEach(element => {
    element.textContent = `${LEVEL_2_REWARD_RATE * 100}%`;
  });

  // Відображаємо пороги активності
  const drawsThresholdElements = document.querySelectorAll('.draws-threshold');
  drawsThresholdElements.forEach(element => {
    element.textContent = MIN_DRAWS_PARTICIPATION;
  });

  const invitedThresholdElements = document.querySelectorAll('.invited-threshold');
  invitedThresholdElements.forEach(element => {
    element.textContent = MIN_INVITED_REFERRALS;
  });

  // Відображаємо пороги та винагороди за бейджі
  const bronzeThresholdElements = document.querySelectorAll('.bronze-threshold');
  bronzeThresholdElements.forEach(element => {
    element.textContent = BRONZE_BADGE_THRESHOLD;
  });

  const silverThresholdElements = document.querySelectorAll('.silver-threshold');
  silverThresholdElements.forEach(element => {
    element.textContent = SILVER_BADGE_THRESHOLD;
  });

  const goldThresholdElements = document.querySelectorAll('.gold-threshold');
  goldThresholdElements.forEach(element => {
    element.textContent = GOLD_BADGE_THRESHOLD;
  });

  const platinumThresholdElements = document.querySelectorAll('.platinum-threshold');
  platinumThresholdElements.forEach(element => {
    element.textContent = PLATINUM_BADGE_THRESHOLD;
  });

  const bronzeRewardElements = document.querySelectorAll('.bronze-reward');
  bronzeRewardElements.forEach(element => {
    element.textContent = BRONZE_BADGE_REWARD;
  });

  const silverRewardElements = document.querySelectorAll('.silver-reward');
  silverRewardElements.forEach(element => {
    element.textContent = SILVER_BADGE_REWARD;
  });

  const goldRewardElements = document.querySelectorAll('.gold-reward');
  goldRewardElements.forEach(element => {
    element.textContent = GOLD_BADGE_REWARD;
  });

  const platinumRewardElements = document.querySelectorAll('.platinum-reward');
  platinumRewardElements.forEach(element => {
    element.textContent = PLATINUM_BADGE_REWARD;
  });

  // Відображаємо пороги та винагороди за завдання
  const taskThresholdElements = document.querySelectorAll('.task-threshold');
  taskThresholdElements.forEach(element => {
    element.textContent = REFERRAL_TASK_THRESHOLD;
  });

  const taskRewardElements = document.querySelectorAll('.task-reward');
  taskRewardElements.forEach(element => {
    element.textContent = REFERRAL_TASK_REWARD;
  });
};

/**
 * Налаштовує вкладки для структури рефералів
 */
const setupReferralTabs = () => {
  console.log("Setting up tabs...");
  const tabs = document.querySelectorAll('.referral-tab');
  console.log("Found tabs:", tabs.length);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      console.log("Tab clicked:", tab.dataset.tab);

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
        console.log("Activated pane:", tabId);
      } else {
        console.error("Pane not found:", `${tabId}-tab`);
      }
    });
  });
};

/**
 * Автоматично обробляє реферальний параметр з URL
 */
const autoProcessReferral = async () => {
  // Отримуємо реферальний параметр з URL
  const urlParams = new URLSearchParams(window.location.search);
  const referrerId = urlParams.get('ref') || urlParams.get('referrer_id');

  // Перевіряємо наявність параметра та чи не є поточний користувач сам своїм рефералом
  if (referrerId && referrerId !== appState.userId) {
    try {
      // Зберігаємо referrerId в localStorage, щоб використати його при реєстрації
      localStorage.setItem('referrer_id', referrerId);

      // Перевіряємо, чи не було вже зараховано цього реферала
      const isProcessed = localStorage.getItem('referral_processed');

      if (!isProcessed) {
        // Реєструємо реферала і нараховуємо бонус
        await registerNewReferral(referrerId, appState.userId);

        // Позначаємо, що реферал був зарахований
        localStorage.setItem('referral_processed', 'true');

        // Оновлюємо статистику
        await getReferralStats(appState.userId);
        await getLevelRewards(appState.userId);
        await getReferralActivity(appState.userId);
        await getUserBadges(appState.userId);
        await getUserTasks(appState.userId);

        console.log(`Користувач автоматично зареєстрований як реферал користувача ${referrerId}`);
      }
    } catch (error) {
      console.error('Error auto-processing referral:', error);
      // Не показуємо помилку користувачу, оскільки процес відбувається автоматично
    }
  }
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
 * Налаштовує обробники для бейджів та завдань
 */
const setupBadgesAndTasksHandlers = () => {
  // Налаштовуємо обробники для кнопок отримання винагороди за бейджі
  document.addEventListener('click', async (event) => {
    const claimBadgeButton = event.target.closest('.claim-badge-button');
    if (claimBadgeButton && claimBadgeButton.dataset.badge) {
      const badgeType = claimBadgeButton.dataset.badge;
      try {
        await claimBadgeReward(appState.userId, badgeType)(dispatch);
        showToast(`Бейдж ${badgeType} успішно отримано!`);
        await getUserBadges(appState.userId);
        updateUserBalance(getBadgeReward(badgeType));

        // Оновлюємо загальний заробіток після нарахування винагороди
        calculateTotalEarnings(appState.userId);
      } catch (error) {
        console.error('Error claiming badge reward:', error);
        showToast(error.message || 'Помилка отримання винагороди за бейдж', 'error');
      }
    }
  });

  // Налаштовуємо обробники для кнопок отримання винагороди за завдання
  document.addEventListener('click', async (event) => {
    const claimTaskButton = event.target.closest('.claim-task-button');
    if (claimTaskButton && claimTaskButton.dataset.task) {
      const taskType = claimTaskButton.dataset.task;
      try {
        await claimTaskReward(appState.userId, taskType)(dispatch);
        showToast(`Винагороду за завдання успішно отримано!`);
        await getUserTasks(appState.userId);
        updateUserBalance(getTaskReward(taskType));

        // Оновлюємо загальний заробіток після нарахування винагороди
        calculateTotalEarnings(appState.userId);
      } catch (error) {
        console.error('Error claiming task reward:', error);
        showToast(error.message || 'Помилка отримання винагороди за завдання', 'error');
      }
    }
  });
};

/**
 * Отримує винагороду за бейдж за його типом
 * @param {string} badgeType - Тип бейджа
 * @returns {number} Винагорода за бейдж
 */
const getBadgeReward = (badgeType) => {
  switch (badgeType) {
    case 'BRONZE': return BRONZE_BADGE_REWARD;
    case 'SILVER': return SILVER_BADGE_REWARD;
    case 'GOLD': return GOLD_BADGE_REWARD;
    case 'PLATINUM': return PLATINUM_BADGE_REWARD;
    default: return 0;
  }
};

/**
 * Отримує винагороду за завдання за його типом
 * @param {string} taskType - Тип завдання
 * @returns {number} Винагорода за завдання
 */
const getTaskReward = (taskType) => {
  switch (taskType) {
    case 'REFERRAL_COUNT': return REFERRAL_TASK_REWARD;
    default: return 0;
  }
};

/**
 * Відображає деталі реферала
 * @param {string} referralId - ID реферала
 */
const showReferralDetails = async (referralId) => {
  // Отримуємо деталі реферала
  try {
    const details = await fetchReferralDetails(referralId);

    // Отримуємо дані про активність реферала
    const activityDetails = await checkSingleReferralActivity(referralId);

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

    // Відображаємо дані про активність
    if (activityDetails) {
      // Додаємо інформацію про участь у розіграшах
      const drawsElement = document.getElementById('detail-draws');
      if (drawsElement) {
        drawsElement.textContent = activityDetails.activityDetails.drawsParticipation || 0;
      }

      // Додаємо інформацію про запрошених користувачів
      const invitedElement = document.getElementById('detail-invited');
      if (invitedElement) {
        invitedElement.textContent = activityDetails.activityDetails.invitedReferrals || 0;
      }

      // Додаємо причину активності
      const activityReasonElement = document.getElementById('detail-activity-reason');
      if (activityReasonElement) {
        const reason = activityDetails.activityDetails.reasonForActivity;
        let reasonText = 'Неактивний';

        if (reason === 'draws_criteria') {
          reasonText = 'Розіграші';
        } else if (reason === 'invited_criteria') {
          reasonText = 'Запрошення';
        } else if (reason === 'both_criteria') {
          reasonText = 'Розіграші та запрошення';
        } else if (reason === 'manual_activation') {
          reasonText = 'Ручна активація';
        }

        activityReasonElement.textContent = reasonText;
      }
    }

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
 * Отримує дані про відсоткові винагороди
 * @param {string} userId - ID користувача
 */
const getLevelRewards = async (userId) => {
  try {
    // Отримуємо дані про відсоткові винагороди
    const rewardsData = await fetchLevelRewards(userId)(dispatch);

    // Додаткова обробка даних про винагороди
    console.log('Level rewards data loaded:', rewardsData);

    // Заповнюємо інтерфейс даними про винагороди
    renderRewardsUI(rewardsData);
  } catch (error) {
    console.error('Error fetching level rewards:', error);
    showToast('Помилка при отриманні даних про винагороди', 'error');
  }
};

/**
 * Отримує дані про активність рефералів
 * @param {string} userId - ID користувача
 */
const getReferralActivity = async (userId) => {
  try {
    // Отримуємо дані про активність рефералів
    const activityData = await fetchAndCheckReferralActivity(userId)(dispatch);

    // Додаткова обробка даних про активність
    console.log('Referral activity data loaded:', activityData);

    // Отримуємо аналіз активності з рекомендаціями
    const analysisData = await checkReferralsActivityWithAnalysis(userId)(dispatch);

    // Заповнюємо інтерфейс даними про активність
    renderActivityUI(activityData, analysisData);
  } catch (error) {
    console.error('Error fetching referral activity:', error);
    showToast('Помилка при отриманні даних про активність рефералів', 'error');
  }
};

/**
 * Отримує дані про бейджі користувача
 * @param {string} userId - ID користувача
 */
const getUserBadges = async (userId) => {
  try {
    // Отримуємо кількість рефералів користувача
    const referralsCount = appState.referralLevels.totalReferralsCount || 0;

    // Отримуємо дані про бейджі
    const badgesData = await fetchUserBadges(userId, referralsCount)(dispatch);

    // Додаткова обробка даних про бейджі
    console.log('Badges data loaded:', badgesData);

    // Оновлюємо інтерфейс даними про бейджі
    renderBadgesUI(badgesData);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    showToast('Помилка при отриманні даних про бейджі', 'error');
  }
};

/**
 * Отримує дані про завдання користувача
 * @param {string} userId - ID користувача
 */
const getUserTasks = async (userId) => {
  try {
    // Отримуємо дані про завдання
    const tasksData = await fetchUserTasks(userId)(dispatch);

    // Додаткова обробка даних про завдання
    console.log('Tasks data loaded:', tasksData);

    // Оновлюємо інтерфейс даними про завдання
    renderTasksUI(tasksData);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    showToast('Помилка при отриманні даних про завдання', 'error');
  }
};

/**
 * Отримує дані про участь у розіграшах для конкретного реферала
 * @param {string} userId - ID користувача
 */
const getReferralDrawsData = async (userId) => {
  try {
    // Використовуємо дію для отримання даних про участь у розіграшах
    const drawsData = await fetchReferralDrawsAction(userId)(dispatch);

    // Оновлюємо інтерфейс
    renderDrawParticipationUI();

    return drawsData;
  } catch (error) {
    console.error('Error fetching referral draws data:', error);
    showToast('Помилка при отриманні даних про участь у розіграшах', 'error');
  }
};

/**
 * Отримує рейтинг рефералів за участю в розіграшах
 * @param {string} ownerId - ID власника рефералів
 */
const getDrawsRanking = async (ownerId) => {
  try {
    // Використовуємо дію для отримання рейтингу
    const rankingData = await fetchDrawsRankingAction(ownerId)(dispatch);

    // Отримуємо аналіз участі
    const analysisData = await analyzeDrawsParticipationAction(ownerId, { includeDetails: true })(dispatch);

    // Оновлюємо інтерфейс
    renderDrawsRankingUI(rankingData, analysisData);

    return { rankingData, analysisData };
  } catch (error) {
    console.error('Error fetching draws ranking:', error);
    showToast('Помилка при отриманні рейтингу за участю в розіграшах', 'error');
  }
};

/**
 * Обчислює загальний заробіток від реферальної програми
 * @param {string} userId - ID користувача
 */
const calculateTotalEarnings = async (userId) => {
  try {
    // Використовуємо дію для розрахунку загальних винагород
    const totalRewardsData = await calculateTotalRewardsAction(userId)(dispatch);

    // Оновлюємо інтерфейс
    renderTotalEarningsUI();

    return totalRewardsData;
  } catch (error) {
    console.error('Error calculating total earnings:', error);
    showToast('Помилка при розрахунку загального заробітку', 'error');
  }
};

/**
 * Налаштовує обробники для рейтингу та аналітики рефералів
 */
const setupReferralRankingHandlers = () => {
  // Налаштовуємо кнопки сортування рейтингу
  const sortButtons = document.querySelectorAll('.sort-ranking-button');
  if (sortButtons.length > 0) {
    sortButtons.forEach(button => {
      button.addEventListener('click', () => {
        const sortBy = button.dataset.sortBy || 'earnings';
        renderReferralRankingUI(sortBy);
      });
    });
  }

  // Налаштовуємо перемикач для показу/приховання неактивних рефералів
  const showInactiveToggle = document.getElementById('show-inactive-toggle');
  if (showInactiveToggle) {
    showInactiveToggle.addEventListener('change', () => {
      renderReferralRankingUI();
    });
  }

  // Налаштовуємо кнопку аналізу заробітку
  const analyzeEarningsButton = document.getElementById('analyze-earnings-button');
  if (analyzeEarningsButton) {
    analyzeEarningsButton.addEventListener('click', async () => {
      try {
        await analyzeReferralEarnings();
      } catch (error) {
        console.error('Error analyzing earnings:', error);
        showToast('Помилка при аналізі заробітку', 'error');
      }
    });
  }

  // Налаштовуємо кнопку перегляду лідерської дошки
  const viewMoreButton = document.querySelector('.view-more-button');
  if (viewMoreButton) {
    viewMoreButton.addEventListener('click', () => {
      generateAndDisplayLeaderboard();
    });
  }
};

/**
 * Аналізує заробіток рефералів
 */
const analyzeReferralEarnings = async () => {
  try {
    // Об'єднуємо усіх рефералів
    const allReferrals = [...appState.referralLevels.level1Data, ...appState.referralLevels.level2Data];

    // Отримуємо аналіз заробітку
    const earningsData = await analyzeEarningsStructure(appState.userId, allReferrals);

    // Відображаємо аналіз
    renderEarningsAnalysisUI(earningsData);

    return earningsData;
  } catch (error) {
    console.error('Error analyzing referral earnings:', error);
    showToast('Помилка при аналізі заробітку рефералів', 'error');
    throw error;
  }
};

/**
 * Генерує та відображає лідерську дошку
 */
const generateAndDisplayLeaderboard = async () => {
  try {
    // Об'єднуємо усіх рефералів
    const allReferrals = [...appState.referralLevels.level1Data, ...appState.referralLevels.level2Data];

    // Отримуємо дані для лідерської дошки
    const leaderboardData = await generateLeaderboard(appState.userId, allReferrals, {
      topCount: 10,
      includeUserPosition: true,
      sortBy: 'earnings'
    });

    // Відображаємо лідерську дошку
    renderLeaderboardUI(leaderboardData);

    return leaderboardData;
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    showToast('Помилка при генерації лідерської дошки', 'error');
  }
};

/**
 * Відображає деталі бейджів
 */
const renderBadgesDetails = () => {
  // Якщо дані про бейджі відсутні, отримуємо їх
  if (!appState.badges.badgesProgress || appState.badges.badgesProgress.length === 0) {
    getUserBadges(appState.userId);
    return;
  }

  const badgesContainer = document.getElementById('badges-details');
  if (!badgesContainer) return;

  // Оновлюємо контент
  renderBadgesAndTasksUI();
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
 * Відображає деталі про відсоткові винагороди
 */
const renderReferralRewardsDetails = () => {
  const { level1Rewards, level2Rewards, summary } = appState.levelRewards;
  const rewardsContainer = document.getElementById('rewards-details');

  if (!rewardsContainer) return;

  // Очищуємо контейнер
  rewardsContainer.innerHTML = '';

  // Формуємо HTML для деталей винагород
  const rewardsContent = document.createElement('div');
  rewardsContent.className = 'rewards-content';

  // Додаємо загальну інформацію про винагороди
  rewardsContent.innerHTML = `
    <div class="rewards-summary">
      <h4>Загальна інформація</h4>
      <div class="summary-item">
        <div class="summary-label">Загальна сума відсоткових винагород:</div>
        <div class="summary-value">${summary.totalPercentageReward || 0}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Загальний заробіток рефералів:</div>
        <div class="summary-value">${summary.totalReferralsEarnings || 0}</div>
      </div>
    </div>
    
    <div class="rewards-details-section">
      <h4>Винагороди з 1-го рівня (${LEVEL_1_REWARD_RATE * 100}%)</h4>
      <div class="rewards-stat">
        <div class="stat-label">Загальна сума:</div>
        <div class="stat-value">${level1Rewards.totalReward || 0}</div>
      </div>
      <div class="rewards-stat">
        <div class="stat-label">Кількість рефералів:</div>
        <div class="stat-value">${level1Rewards.referralsCount || 0}</div>
      </div>
      <div class="rewards-stat">
        <div class="stat-label">Активних рефералів:</div>
        <div class="stat-value">${level1Rewards.activeReferralsCount || 0}</div>
      </div>
    </div>
    
    <div class="rewards-details-section">
      <h4>Винагороди з 2-го рівня (${LEVEL_2_REWARD_RATE * 100}%)</h4>
      <div class="rewards-stat">
        <div class="stat-label">Загальна сума:</div>
        <div class="stat-value">${level2Rewards.totalReward || 0}</div>
      </div>
      <div class="rewards-stat">
        <div class="stat-label">Кількість рефералів:</div>
        <div class="stat-value">${level2Rewards.referralsCount || 0}</div>
      </div>
      <div class="rewards-stat">
        <div class="stat-label">Активних рефералів:</div>
        <div class="stat-value">${level2Rewards.activeReferralsCount || 0}</div>
      </div>
    </div>
  `;

  // Додаємо елемент до контейнера
  rewardsContainer.appendChild(rewardsContent);

  // Відображаємо останні нарахування, якщо є історія
  if (appState.levelRewards.history && appState.levelRewards.history.length > 0) {
    const historyContent = document.createElement('div');
    historyContent.className = 'rewards-history';
    historyContent.innerHTML = '<h4>Останні нарахування</h4>';

    const historyList = document.createElement('div');
    historyList.className = 'rewards-history-list';

    // Додаємо останні 5 записів історії
    appState.levelRewards.history.slice(0, 5).forEach(historyItem => {
      const itemDate = new Date(historyItem.timestamp);
      const formattedDate = `${itemDate.getDate()}.${itemDate.getMonth() + 1}.${itemDate.getFullYear()}`;

      const historyItemElement = document.createElement('div');
      historyItemElement.className = 'history-item';
      historyItemElement.innerHTML = `
        <div class="history-date">${formattedDate}</div>
        <div class="history-details">
          <div class="history-label">Рівень 1: ${historyItem.level1Amount}, Рівень 2: ${historyItem.level2Amount}</div>
          <div class="history-total">Загалом: ${historyItem.totalAmount}</div>
        </div>
      `;

      historyList.appendChild(historyItemElement);
    });

    historyContent.appendChild(historyList);
    rewardsContainer.appendChild(historyContent);
  }
};

/**
 * Відображає деталі про активність рефералів
 */
const renderReferralActivityDetails = () => {
  const { activeReferrals, activityStats, activityReasons, recommendations } = appState.referralActivity;
  const activityContainer = document.getElementById('activity-details');

  if (!activityContainer) return;

  // Очищуємо контейнер
  activityContainer.innerHTML = '';

  // Формуємо HTML для деталей активності
  const activityContent = document.createElement('div');
  activityContent.className = 'activity-content';

  // Додаємо загальну статистику активності
  activityContent.innerHTML = `
    <div class="activity-summary">
      <h4>Загальна статистика</h4>
      <div class="summary-item">
        <div class="summary-label">Загальна кількість рефералів:</div>
        <div class="summary-value">${activityStats.totalReferrals || 0}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Кількість активних рефералів:</div>
        <div class="summary-value">${activityStats.activeReferralsCount || 0}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Кількість неактивних рефералів:</div>
        <div class="summary-value">${activityStats.inactiveReferralsCount || 0}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Відсоток конверсії:</div>
        <div class="summary-value">${(activityStats.conversionRate * 100).toFixed(1)}%</div>
      </div>
    </div>
    
    <div class="activity-details-section">
      <h4>Розподіл за причинами активності</h4>
      <div class="activity-stat">
        <div class="stat-label">Розіграші (мін. ${MIN_DRAWS_PARTICIPATION}):</div>
        <div class="stat-value">${activityReasons.drawsCriteria || 0}</div>
      </div>
      <div class="activity-stat">
        <div class="stat-label">Запрошення (мін. ${MIN_INVITED_REFERRALS}):</div>
        <div class="stat-value">${activityReasons.invitedCriteria || 0}</div>
      </div>
      <div class="activity-stat">
        <div class="stat-label">Обидва критерії:</div>
        <div class="stat-value">${activityReasons.bothCriteria || 0}</div>
      </div>
      <div class="activity-stat">
        <div class="stat-label">Ручна активація:</div>
        <div class="stat-value">${activityReasons.manualActivation || 0}</div>
      </div>
    </div>
  `;

  // Додаємо рекомендації, якщо є
  if (recommendations && recommendations.length > 0) {
    const recommendationsSection = document.createElement('div');
    recommendationsSection.className = 'recommendations-section';
    recommendationsSection.innerHTML = '<h4>Рекомендації</h4>';

    const recommendationsList = document.createElement('div');
    recommendationsList.className = 'recommendations-list';

    // Додаємо всі рекомендації
    recommendations.forEach(recommendation => {
      const recommendationItem = document.createElement('div');
      recommendationItem.className = `recommendation-item ${recommendation.priority}`;
      recommendationItem.innerHTML = `
        <div class="recommendation-title">${recommendation.title}</div>
        <div class="recommendation-description">${recommendation.description}</div>
      `;

      recommendationsList.appendChild(recommendationItem);
    });

    recommendationsSection.appendChild(recommendationsList);
    activityContent.appendChild(recommendationsSection);
  }

  // Додаємо елемент до контейнера
  activityContainer.appendChild(activityContent);

  // Додаємо інформацію про потенційні активації
  if (appState.referralActivity.potentialActivations) {
    const potentialSection = document.createElement('div');
    potentialSection.className = 'potential-activations-section';
    potentialSection.innerHTML = `
      <h4>Потенційні активації</h4>
      <div class="potential-stat">
        <div class="stat-label">Близькі до виконання критерію розіграшів:</div>
        <div class="stat-value">${appState.referralActivity.potentialActivations.closeToDrawsCriteria || 0}</div>
      </div>
      <div class="potential-stat">
        <div class="stat-label">Близькі до виконання критерію запрошення:</div>
        <div class="stat-value">${appState.referralActivity.potentialActivations.closeToInvitedCriteria || 0}</div>
      </div>
    `;

    activityContainer.appendChild(potentialSection);
  }
};

/**
 * Оновлює інтерфейс даними про бейджі та завдання
 */
const renderBadgesAndTasksUI = () => {
  renderBadgesUI(appState.badges);
  renderTasksUI(appState.badges);
};

/**
 * Відображає дані про бейджі в інтерфейсі
 * @param {Object} badgesData - Дані про бейджі
 */
const renderBadgesUI = (badgesData) => {
  const { badgesProgress, earnedBadges, availableBadges } = badgesData;

  // Оновлюємо прогрес для бейджів у розділі бейджів
  if (badgesProgress && badgesProgress.length > 0) {
    badgesProgress.forEach(badge => {
      // Оновлюємо прогрес
      const progressElement = document.querySelector(`.${badge.type.toLowerCase()}-progress`);
      if (progressElement) {
        progressElement.style.width = `${badge.progress}%`;
      }

      // Оновлюємо статус
      const statusElement = document.querySelector(`.${badge.type.toLowerCase()}-status`);
      if (statusElement) {
        statusElement.textContent = badge.isEligible ? 'Доступний' : 'Недоступний';
        statusElement.className = `badge-status ${badge.isEligible ? 'available' : 'unavailable'}`;
      }

      // Оновлюємо кнопку отримання
      const claimButton = document.querySelector(`.claim-badge-button[data-badge="${badge.type}"]`);
      if (claimButton) {
        // Кнопка активна, якщо бейдж доступний і ще не отриманий
        const isAvailable = availableBadges && availableBadges.includes(badge.type);
        const isDisabled = !isAvailable || (appState.badges.claimedBadges && appState.badges.claimedBadges.includes(badge.type));

        claimButton.disabled = isDisabled;
        claimButton.textContent = isDisabled ? (isAvailable ? 'Отримано' : 'Недоступно') : 'Отримати винагороду';
      }
    });
  }

  // Оновлюємо наступний бейдж (якщо є)
  const nextBadge = badgesData.nextBadge;
  if (nextBadge) {
    const nextBadgeElement = document.querySelector('.next-badge-info');
    if (nextBadgeElement) {
      nextBadgeElement.innerHTML = `
        <div class="next-badge-title">Наступний бейдж: ${nextBadge.type}</div>
        <div class="next-badge-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${nextBadge.progress}%"></div>
          </div>
          <div class="progress-text">${nextBadge.progress.toFixed(1)}% (${appState.referralLevels.totalReferralsCount || 0}/${nextBadge.threshold})</div>
        </div>
        <div class="next-badge-remaining">Залишилось: ${nextBadge.remaining} рефералів</div>
      `;
    }
  }

  // Оновлюємо загальну статистику бейджів
  const totalElement = document.querySelector('.total-badges-count');
  if (totalElement) {
    totalElement.textContent = badgesData.totalBadgesCount || 0;
  }

  const earnedElement = document.querySelector('.earned-badges-count');
  if (earnedElement) {
    earnedElement.textContent = (earnedBadges && earnedBadges.length) || 0;
  }

  const remainingElement = document.querySelector('.remaining-badges-count');
  if (remainingElement) {
    const total = badgesData.totalBadgesCount || 0;
    const earned = (earnedBadges && earnedBadges.length) || 0;
    remainingElement.textContent = total - earned;
  }

  // Вставляємо на сторінку бейджі
  renderBadgesList(badgesData);
};

/**
 * Відображає список бейджів
 * @param {Object} badgesData - Дані про бейджі
 */
const renderBadgesList = (badgesData) => {
  const badgesListContainer = document.getElementById('badges-list');
  if (!badgesListContainer) return;

  // Очищуємо контейнер
  badgesListContainer.innerHTML = '';

  // Порядок бейджів
  const badgeOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

  // Формуємо HTML для кожного бейджа
  badgeOrder.forEach(badgeType => {
    const badge = badgesData.badgesProgress.find(b => b.type === badgeType);
    if (!badge) return;

    const isEligible = badge.isEligible;
    const isClaimed = badgesData.claimedBadges && badgesData.claimedBadges.includes(badgeType);

    const badgeElement = document.createElement('div');
    badgeElement.className = `badge-item ${isEligible ? 'eligible' : 'not-eligible'} ${isClaimed ? 'claimed' : ''}`;

    // Визначаємо винагороду за бейдж
    const reward = getBadgeReward(badgeType);

    // Визначаємо поріг бейджа
    const threshold = badge.threshold;

    badgeElement.innerHTML = `
      <div class="badge-icon ${badgeType.toLowerCase()}-icon"></div>
      <div class="badge-info">
        <div class="badge-title">${getBadgeName(badgeType)}</div>
        <div class="badge-description">Залучіть ${threshold} рефералів</div>
        <div class="badge-reward">Винагорода: ${reward} winix</div>
        <div class="badge-progress-container">
          <div class="badge-progress-bar">
            <div class="badge-progress-fill" style="width: ${badge.progress}%"></div>
          </div>
          <div class="badge-progress-text">${badge.progress.toFixed(1)}% (${appState.referralLevels.totalReferralsCount || 0}/${threshold})</div>
        </div>
        <button class="claim-badge-button" data-badge="${badgeType}" ${!isEligible || isClaimed ? 'disabled' : ''}>
          ${isClaimed ? 'Отримано' : (isEligible ? 'Отримати винагороду' : 'Недоступно')}
        </button>
      </div>
    `;

    badgesListContainer.appendChild(badgeElement);
  });

  // Якщо немає бейджів, показуємо повідомлення
  if (badgeOrder.length === 0) {
    badgesListContainer.innerHTML = '<div class="empty-list">Немає доступних бейджів</div>';
  }
};

/**
 * Відображає дані про завдання в інтерфейсі
 * @param {Object} tasksData - Дані про завдання
 */
const renderTasksUI = (tasksData) => {
  const { tasksProgress, completedTasks } = tasksData;

  // Оновлюємо прогрес для завдань
  if (tasksProgress) {
    for (const [taskType, progress] of Object.entries(tasksProgress)) {
      // Оновлюємо прогрес
      const progressElement = document.querySelector(`.${taskType.toLowerCase()}-progress`);
      if (progressElement) {
        progressElement.style.width = `${progress.progress}%`;
      }

      // Оновлюємо статус
      const statusElement = document.querySelector(`.${taskType.toLowerCase()}-status`);
      if (statusElement) {
        statusElement.textContent = progress.completed ? 'Виконано' : 'В процесі';
        statusElement.className = `task-status ${progress.completed ? 'completed' : 'in-progress'}`;
      }

      // Оновлюємо кнопку отримання
      const claimButton = document.querySelector(`.claim-task-button[data-task="${taskType}"]`);
      if (claimButton) {
        // Кнопка активна, якщо завдання виконано і винагорода ще не отримана
        const isCompleted = progress.completed;
        const isDisabled = !isCompleted;

        claimButton.disabled = isDisabled;
        claimButton.textContent = isCompleted ? 'Отримати винагороду' : 'Недоступно';
      }
    }
  }

  // Оновлюємо загальну статистику завдань
  const totalElement = document.querySelector('.total-tasks-count');
  if (totalElement) {
    totalElement.textContent = tasksData.allTasks ? tasksData.allTasks.length : 0;
  }

  const completedElement = document.querySelector('.completed-tasks-count');
  if (completedElement) {
    completedElement.textContent = completedTasks ? completedTasks.length : 0;
  }

  // Вставляємо на сторінку завдання
  renderTasksList(tasksData);
};

/**
 * Відображає список завдань
 * @param {Object} tasksData - Дані про завдання
 */
const renderTasksList = (tasksData) => {
  const tasksListContainer = document.getElementById('tasks-list');
  if (!tasksListContainer) return;

  // Очищуємо контейнер
  tasksListContainer.innerHTML = '';

  // Інформація про завдання
  const tasksInfo = {
    REFERRAL_COUNT: {
      title: 'Запросити 100 рефералів',
      description: 'Запросіть 100 нових користувачів',
      reward: REFERRAL_TASK_REWARD,
      threshold: REFERRAL_TASK_THRESHOLD
    }
    // Додайте інші типи завдань тут
  };

  // Формуємо HTML для кожного завдання
  if (tasksData.tasksProgress) {
    for (const [taskType, progress] of Object.entries(tasksData.tasksProgress)) {
      const taskInfo = tasksInfo[taskType];
      if (!taskInfo) continue;

      const isCompleted = progress.completed;

      const taskElement = document.createElement('div');
      taskElement.className = `task-item ${isCompleted ? 'completed' : 'in-progress'}`;

      taskElement.innerHTML = `
        <div class="task-info">
          <div class="task-title">${taskInfo.title}</div>
          <div class="task-description">${taskInfo.description}</div>
          <div class="task-reward">Винагорода: ${taskInfo.reward} winix</div>
          <div class="task-progress-container">
            <div class="task-progress-bar">
              <div class="task-progress-fill" style="width: ${progress.progress}%"></div>
            </div>
            <div class="task-progress-text">${progress.progress.toFixed(1)}% (${progress.current}/${progress.threshold})</div>
          </div>
          <button class="claim-task-button" data-task="${taskType}" ${!isCompleted ? 'disabled' : ''}>
            ${isCompleted ? 'Отримати винагороду' : 'Недоступно'}
          </button>
        </div>
      `;

      tasksListContainer.appendChild(taskElement);
    }
  }

  // Якщо немає завдань, показуємо повідомлення
  if (!tasksData.tasksProgress || Object.keys(tasksData.tasksProgress).length === 0) {
    tasksListContainer.innerHTML = '<div class="empty-list">Немає доступних завдань</div>';
  }
};

/**
 * Повертає назву бейджа за його типом
 * @param {string} badgeType - Тип бейджа
 * @returns {string} Назва бейджа
 */
const getBadgeName = (badgeType) => {
  switch (badgeType) {
    case 'BRONZE': return 'Бронзовий бейдж';
    case 'SILVER': return 'Срібний бейдж';
    case 'GOLD': return 'Золотий бейдж';
    case 'PLATINUM': return 'Платиновий бейдж';
    default: return 'Невідомий бейдж';
  }
};

/**
 * Заповнює інтерфейс даними про винагороди
 * @param {Object} rewardsData - Дані про винагороди
 */
const renderRewardsUI = (rewardsData) => {
  if (!rewardsData) return;

  // Оновлюємо елементи статистики
  const level1RewardElement = document.querySelector('.level1-reward');
  if (level1RewardElement) {
    level1RewardElement.textContent = rewardsData.level1Rewards.totalReward || 0;
  }

  const level2RewardElement = document.querySelector('.level2-reward');
  if (level2RewardElement) {
    level2RewardElement.textContent = rewardsData.level2Rewards.totalReward || 0;
  }

  // Оновлюємо загальний заробіток
  updateTotalEarnings();
};

/**
 * Відображає дані про активність рефералів в інтерфейсі
 * @param {Object} activityData - Дані про активність
 * @param {Object} analysisData - Результат аналізу активності
 */
const renderActivityUI = (activityData, analysisData) => {
  if (!activityData) return;

  // Оновлюємо елементи статистики активності
  const activeReferralsElement = document.querySelector('.active-referrals-count');
  if (activeReferralsElement) {
    activeReferralsElement.textContent = activityData.summary.active || 0;
  }

  const conversionRateElement = document.querySelector('.conversion-rate');
  if (conversionRateElement) {
    const formattedRate = ((activityData.summary.conversionRate || 0) * 100).toFixed(1);
    conversionRateElement.textContent = `${formattedRate}%`;
  }

  // Оновлюємо статус активності для рефералів у списках
  updateReferralItemsStatus(activityData);

  // Відображаємо рекомендації, якщо є відповідний контейнер
  if (analysisData && analysisData.recommendations) {
    renderActivityRecommendations(analysisData.recommendations);
  }
};

/**
 * Оновлює статус елементів рефералів у списках
 * @param {Object} activityData - Дані про активність рефералів
 */
const updateReferralItemsStatus = (activityData) => {
  if (!activityData || !activityData.level1 || !activityData.level2) return;

  // Створюємо мапу активних рефералів 1-го рівня
  const activeLevel1Map = {};
  activityData.level1.referrals.forEach(ref => {
    activeLevel1Map[ref.id] = ref.isActive;
  });

  // Оновлюємо елементи рефералів 1-го рівня
  const level1Items = document.querySelectorAll('.referral-item.level-1');
  level1Items.forEach(item => {
    const referralId = item.dataset.id;
    const statusElement = item.querySelector('.referral-status');

    if (statusElement && referralId in activeLevel1Map) {
      const isActive = activeLevel1Map[referralId];

      statusElement.classList.toggle('active', isActive);
      statusElement.classList.toggle('inactive', !isActive);
      statusElement.textContent = isActive ? 'Активний' : 'Неактивний';
    }
  });

  // Створюємо мапу активних рефералів 2-го рівня
  const activeLevel2Map = {};
  activityData.level2.referrals.forEach(ref => {
    activeLevel2Map[ref.id] = ref.isActive;
  });

  // Оновлюємо елементи рефералів 2-го рівня
  const level2Items = document.querySelectorAll('.referral-item.level-2');
  level2Items.forEach(item => {
    const referralId = item.dataset.id;
    const statusElement = item.querySelector('.referral-status');

    if (statusElement && referralId in activeLevel2Map) {
      const isActive = activeLevel2Map[referralId];

      statusElement.classList.toggle('active', isActive);
      statusElement.classList.toggle('inactive', !isActive);
      statusElement.textContent = isActive ? 'Активний' : 'Неактивний';
    }
  });
};

/**
 * Відображає рекомендації щодо активності рефералів
 * @param {Array} recommendations - Масив рекомендацій
 */
const renderActivityRecommendations = (recommendations) => {
  const recommendationsContainer = document.querySelector('.activity-recommendations');
  if (!recommendationsContainer) return;

  // Очищуємо контейнер
  recommendationsContainer.innerHTML = '';

  // Додаємо заголовок
  const header = document.createElement('h4');
  header.textContent = 'Рекомендації';
  recommendationsContainer.appendChild(header);

  // Додаємо рекомендації
  recommendations.forEach(recommendation => {
    const recommendationItem = document.createElement('div');
    recommendationItem.className = `recommendation-item ${recommendation.priority}`;

    recommendationItem.innerHTML = `
      <div class="recommendation-title">${recommendation.title}</div>
      <div class="recommendation-description">${recommendation.description}</div>
    `;

    recommendationsContainer.appendChild(recommendationItem);
  });
};

/**
 * Відображає інтерфейс участі в розіграшах
 */
const renderDrawParticipationUI = () => {
  // Оновлюємо дані про участь у розіграшах, якщо вони доступні
  if (appState.drawParticipation.referralDraws.data) {
    // Тут можна додати оновлення елементів інтерфейсу для даних про розіграші
    // Наприклад, показати кількість розіграшів у відповідних елементах
  }

  // Оновлюємо статистику по розіграшах
  if (appState.drawParticipation.drawsStats.data) {
    // Оновлюємо статистику розіграшів
  }

  // Оновлюємо рейтинг рефералів по розіграшах
  if (appState.drawParticipation.drawsRanking.data) {
    // Оновлюємо таблицю рейтингу
  }
};

/**
 * Відображає рейтинг участі в розіграшах
 * @param {Array} rankingData - Дані про рейтинг
 * @param {Object} analysisData - Дані аналізу
 */
const renderDrawsRankingUI = (rankingData, analysisData) => {
  // Тут можна реалізувати відображення рейтингу рефералів за участю в розіграшах
};

/**
 * Відображає інтерфейс загального заробітку
 */
const renderTotalEarningsUI = () => {
  // Оновлюємо загальний заробіток, якщо є дані
  if (appState.rewardsCalculation.totalRewards.data) {
    const totalEarnings = appState.rewardsCalculation.totalRewards.data.totalEarnings || 0;
    const totalEarningsElement = document.querySelector('#total-earnings-stats .stats-value');
    if (totalEarningsElement) {
      totalEarningsElement.textContent = totalEarnings;
    }
  }
};

/**
 * Відображає рейтинг рефералів
 * @param {string} sortBy - Критерій сортування
 */
const renderReferralRankingUI = (sortBy = 'earnings') => {
  // Отримуємо дані рефералів
  const referrals = [...appState.referralLevels.level1Data, ...appState.referralLevels.level2Data];

  // Перевіряємо, чи показувати неактивних рефералів
  const showInactiveToggle = document.getElementById('show-inactive-toggle');
  const showInactive = showInactiveToggle ? showInactiveToggle.checked : true;

  // Фільтруємо реферали, якщо потрібно
  const filteredReferrals = showInactive
    ? referrals
    : referrals.filter(ref => ref.active);

  // Сортуємо реферали за вибраним критерієм
  const sortedReferrals = filterAndSortReferrals(filteredReferrals, {}, { by: sortBy });

  // Відображаємо рейтинг в контейнері
  const rankingContainer = document.getElementById('referrals-ranking-container');
  if (!rankingContainer) return;

  // Очищуємо контейнер
  rankingContainer.innerHTML = '';

  if (sortedReferrals.length === 0) {
    rankingContainer.innerHTML = '<div class="empty-list">Немає даних про рефералів</div>';
    return;
  }

  // Створюємо таблицю рейтингу
  const table = document.createElement('table');
  table.className = 'referrals-ranking-table';

  // Створюємо заголовок таблиці
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="rank-col">Місце</th>
      <th class="id-col">ID реферала</th>
      <th class="level-col">Рівень</th>
      <th class="earnings-col">Заробіток</th>
      <th class="invited-col">Запрошено</th>
      <th class="draws-col">Розіграші</th>
      <th class="status-col">Статус</th>
    </tr>
  `;
  table.appendChild(thead);

  // Створюємо тіло таблиці
  const tbody = document.createElement('tbody');

  sortedReferrals.forEach((referral, index) => {
    const row = document.createElement('tr');
    row.className = referral.active ? 'active-row' : '';
    row.dataset.id = referral.id;

    // Форматуємо заробіток
    const formattedEarnings = formatWinixAmount(referral.totalEarnings || 0, { showCurrency: false });

    row.innerHTML = `
      <td class="rank-col">${index + 1}</td>
      <td class="id-col">${referral.id}</td>
      <td class="level-col">${referral.level || 1}</td>
      <td class="earnings-col">${formattedEarnings}</td>
      <td class="invited-col">${referral.invitedCount || 0}</td>
      <td class="draws-col">${referral.drawsParticipation || 0}</td>
      <td class="status-col">
        <span class="status-badge ${referral.active ? 'active' : 'inactive'}">
          ${referral.active ? 'Активний' : 'Неактивний'}
        </span>
      </td>
    `;

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  rankingContainer.appendChild(table);

  // Додаємо обробники кліків на рядки таблиці
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const referralId = row.dataset.id;
      if (referralId) {
        showReferralDetails(referralId);
      }
    });
  });
};

/**
 * Відображає лідерську дошку
 * @param {Object} leaderboardData - Дані для лідерської дошки
 */
const renderLeaderboardUI = (leaderboardData) => {
  const leaderboardContainer = document.querySelector('.leaderboard-items');
  if (!leaderboardContainer) return;

  // Очищуємо контейнер
  leaderboardContainer.innerHTML = '';

  // Якщо немає даних, показуємо повідомлення
  if (!leaderboardData || !leaderboardData.topUsers || leaderboardData.topUsers.length === 0) {
    leaderboardContainer.innerHTML = '<div class="empty-list">Немає даних для лідерської дошки</div>';
    return;
  }

  // Додаємо топ користувачів
  leaderboardData.topUsers.forEach((user, index) => {
    const position = index + 1;
    const isTopThree = position <= 3;

    const userItem = document.createElement('div');
    userItem.className = 'leaderboard-item';

    userItem.innerHTML = `
      <div class="position ${isTopThree ? 'top-3' : ''}">${position}</div>
      <div class="user-info">
        <div class="username">${user.id}</div>
        <div class="referral-count">${user.referralCount || 0} рефералів</div>
      </div>
      <div class="user-reward">${formatWinixAmount(user.totalEarnings || 0)}</div>
    `;

    leaderboardContainer.appendChild(userItem);
  });

  // Додаємо поточного користувача, якщо він не в топі
  if (leaderboardData.userEntry && !leaderboardData.topUsers.some(user => user.id === leaderboardData.userEntry.id)) {
    const userItem = document.createElement('div');
    userItem.className = 'leaderboard-item current-user';

    userItem.innerHTML = `
      <div class="position">${leaderboardData.userPosition || '-'}</div>
      <div class="user-info">
        <div class="username">Ви</div>
        <div class="referral-count">${leaderboardData.userEntry.referralCount || 0} рефералів</div>
      </div>
      <div class="user-reward">${formatWinixAmount(leaderboardData.userEntry.totalEarnings || 0)}</div>
    `;

    leaderboardContainer.appendChild(userItem);
  }
};

/**
 * Відображає аналіз заробітку
 * @param {Object} earningsData - Дані аналізу заробітку
 */
const renderEarningsAnalysisUI = (earningsData) => {
  // Тут можна реалізувати відображення аналізу заробітку
};

/**
 * Оновлює загальний заробіток з урахуванням різних джерел доходу
 */
const updateTotalEarnings = () => {
  // Отримуємо суму прямих бонусів
  const directBonusAmount = appState.directBonus.totalBonus || 0;

  // Отримуємо суму відсоткових винагород
  const percentageRewardAmount = appState.levelRewards.summary
    ? appState.levelRewards.summary.totalPercentageReward || 0
    : 0;

  // Отримуємо суму винагород за бейджі та завдання
  const badgesRewardAmount = appState.badges.earnedBadgesReward || 0;
  const tasksRewardAmount = appState.badges.totalTasksReward || 0;

  // Розраховуємо загальний заробіток
  const totalEarnings = directBonusAmount + percentageRewardAmount + badgesRewardAmount + tasksRewardAmount;

  // Оновлюємо елемент інтерфейсу
  const totalEarningsElement = document.querySelector('#total-earnings-stats .stats-value');
  if (totalEarningsElement) {
    totalEarningsElement.textContent = totalEarnings;
  }

  // Оновлюємо винагороду в лідерській дошці
  const userRewardElement = document.querySelector('.current-user .user-reward');
  if (userRewardElement) {
    userRewardElement.textContent = totalEarnings;
  }
};

/**
 * Реєструє нового реферала і нараховує бонус
 * @param {string} referrerId - ID користувача, який запросив
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
  updateTotalEarnings();

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
};

/**
 * Допоміжна функція для вибору правильної форми слова "реферал"
 * @param {number} count - Кількість
 * @returns {string} Відмінювана форма слова
 */
const pluralizeReferral = (count) => {
  if (count === 1) {
    return 'реферал';
  } else if (count >= 2 && count <= 4) {
    return 'реферали';
  } else {
    return 'рефералів';
  }
};

// Експортуємо функції для можливого використання з інших файлів
export {
  getReferralLink,
  registerNewReferral,
  getDirectBonusHistory,
  getReferralStats,
  getLevelRewards,
  getReferralActivity,
  getUserBadges,
  getUserTasks,
  getReferralDrawsData,
  getDrawsRanking,
  analyzeReferralEarnings,
  calculateTotalEarnings
};