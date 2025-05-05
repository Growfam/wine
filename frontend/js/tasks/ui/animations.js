/**
 * Animations - оптимізований модуль анімацій UI для системи завдань
 * Відповідає за:
 * - Візуальні ефекти з оптимізованою продуктивністю
 * - Адаптивні анімації під різні пристрої
 * - Анімації нагород та завершення завдань
 * @version 3.0.0
 */

// Конфігурація з оптимізованими значеннями за замовчуванням
const config = {
    enabled: true,                // Чи включені анімації
    adaptiveMode: true,           // Адаптація під потужність пристрою
    rewardDuration: 3000,         // Тривалість анімації нагороди (мс)
    particleColors: [             // Кольори частинок
        '#4EB5F7', '#00C9A7', '#AD6EE5', '#FFD700', '#52C0BD'
    ],
    specialColors: [              // Кольори для особливих подій
        '#FFD700', '#FFA500', '#FF8C00'
    ],
    timingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
};

// Стан анімацій
const state = {
    initialized: false,
    devicePerformance: 'medium',  // 'low', 'medium', 'high'
    highQualityEffects: true,
    animationsInProgress: 0,
    timers: {},                   // Кеш активних таймерів
    lastAnimationTime: 0          // Час останньої анімації
};

/**
 * Ініціалізація модуля анімацій
 * @param {Object} options - Опції конфігурації
 */
export function init(options = {}) {
    // Запобігаємо повторній ініціалізації
    if (state.initialized) return;

    console.log('UI.Animations: Ініціалізація анімацій...');

    // Оновлюємо конфігурацію
    Object.assign(config, options);

    // Визначаємо продуктивність пристрою (спрощений алгоритм)
    detectDevicePerformance();

    // Додаємо стилі
    injectAnimationStyles();

    // Налаштовуємо обробники подій
    setupEventHandlers();

    // Відзначаємо, що модуль ініціалізовано
    state.initialized = true;

    console.log(`UI.Animations: Ініціалізація завершена (режим: ${state.devicePerformance})`);
}

/**
 * Визначення продуктивності пристрою (оптимізований алгоритм)
 */
function detectDevicePerformance() {
    try {
        // Завантажуємо збережені налаштування, якщо є
        const savedPerformance = localStorage.getItem('devicePerformance');
        if (savedPerformance) {
            state.devicePerformance = savedPerformance;
            state.highQualityEffects = savedPerformance === 'high';
            return;
        }

        // Швидкий тест продуктивності
        const startTime = performance.now();

        // Спрощений тест - менше ітерацій для швидкості
        let counter = 0;
        const iterations = 300000;
        for (let i = 0; i < iterations; i++) {
            counter += Math.sqrt(i);
        }

        const duration = performance.now() - startTime;

        // Визначаємо продуктивність за результатами
        if (duration > 50) {
            state.devicePerformance = 'low';
            state.highQualityEffects = false;
        } else if (duration > 25) {
            state.devicePerformance = 'medium';
            state.highQualityEffects = window.innerWidth >= 768;
        } else {
            state.devicePerformance = 'high';
            state.highQualityEffects = true;
        }

        // Додаткова корекція для мобільних пристроїв
        if (window.innerWidth < 600 && state.devicePerformance === 'high') {
            state.devicePerformance = 'medium';
        }

        // Зберігаємо результат
        try {
            localStorage.setItem('devicePerformance', state.devicePerformance);
        } catch (e) {
            console.warn('UI.Animations: Помилка збереження налаштувань:', e);
        }
    } catch (e) {
        // Запасний варіант у випадку помилки
        console.warn('UI.Animations: Помилка визначення продуктивності:', e);
        state.devicePerformance = 'medium';
        state.highQualityEffects = false;
    }
}

/**
 * Додавання CSS стилів (оптимізовано - винесено найважливіші стилі)
 */
function injectAnimationStyles() {
    if (document.getElementById('premium-animations-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'premium-animations-styles';

    // Оптимізовано - скорочено кількість CSS правил
    styleElement.textContent = `
        /* Контейнер анімації винагороди */
        .premium-reward-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            pointer-events: none;
            z-index: 10000;
        }
        
        /* Фон */
        .premium-reward-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            opacity: 0;
            transition: opacity 0.7s ease;
            backdrop-filter: blur(8px);
        }
        
        .premium-reward-overlay.show {
            opacity: 1;
        }
        
        /* Картка винагороди */
        .premium-reward-card {
            background: linear-gradient(135deg, rgba(30, 39, 70, 0.85), rgba(15, 23, 42, 0.95));
            color: white;
            border-radius: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(78, 181, 247, 0.3) inset;
            padding: 40px;
            transform: scale(0.8) translateY(20px);
            opacity: 0;
            transition: all 0.7s ${config.timingFunction};
            text-align: center;
            position: relative;
            width: 90%;
            max-width: 400px;
        }
        
        .premium-reward-card.show {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        /* Заголовок і елементи винагороди */
        .premium-reward-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 0 0 10px rgba(0, 201, 167, 0.6);
        }
        
        .premium-reward-icon {
            width: 120px;
            height: 120px;
            margin: 25px auto;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #4eb5f7, #00C9A7);
            box-shadow: 0 0 30px rgba(0, 201, 167, 0.8);
            transform: scale(0);
            transition: transform 0.8s ${config.timingFunction} 0.3s;
        }
        
        .premium-reward-card.show .premium-reward-icon {
            transform: scale(1);
        }
        
        .premium-reward-icon.token-icon {
            background: linear-gradient(135deg, #FFD700, #FFA500);
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
        }
        
        /* Кількість винагороди */
        .premium-reward-amount {
            font-size: 42px;
            font-weight: bold;
            color: #FFD700;
            margin: 15px 0;
            text-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
            transform: scale(0);
            transition: transform 0.8s ${config.timingFunction} 0.4s;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
        }
        
        .premium-reward-card.show .premium-reward-amount {
            transform: scale(1);
        }
        
        /* Тип винагороди */
        .premium-reward-type {
            font-size: 18px;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.7s ease 0.5s;
        }
        
        .premium-reward-card.show .premium-reward-type {
            transform: translateY(0);
            opacity: 1;
        }
        
        /* Кнопка */
        .premium-reward-button {
            padding: 14px 35px;
            font-size: 18px;
            font-weight: bold;
            color: white;
            background: linear-gradient(90deg, #4eb5f7, #00C9A7);
            border: none;
            border-radius: 30px;
            cursor: pointer;
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease, transform 0.7s ease 0.6s, opacity 0.7s ease 0.6s;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        
        .premium-reward-card.show .premium-reward-button {
            transform: translateY(0);
            opacity: 1;
        }
        
        .premium-reward-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 25px rgba(0, 0, 0, 0.4);
        }
        
        /* Анімації для успішного виконання завдання */
        .task-item.success-pulse {
            animation: task-success-pulse 1.5s ease-out;
            position: relative;
            z-index: 2;
        }
        
        @keyframes task-success-pulse {
            0% { transform: scale(1); box-shadow: 0 5px 15px rgba(0, 201, 167, 0); }
            50% { transform: scale(1.03); box-shadow: 0 10px 30px rgba(0, 201, 167, 0.5); }
            100% { transform: scale(1); box-shadow: 0 5px 15px rgba(0, 201, 167, 0); }
        }
        
        /* Прогрес-бар */
        .progress-fill.pulse {
            animation: progress-bar-pulse 1.2s ease-out;
        }
        
        @keyframes progress-bar-pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5); }
            70% { box-shadow: 0 0 0 10px rgba(0, 201, 167, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0); }
        }
        
        /* Адаптивність */
        @media (max-width: 600px) {
            .premium-reward-card {
                padding: 30px 20px;
                max-width: 340px;
            }
            
            .premium-reward-title {
                font-size: 24px;
            }
            
            .premium-reward-icon {
                width: 100px;
                height: 100px;
                margin: 15px auto;
            }
            
            .premium-reward-amount {
                font-size: 36px;
            }
            
            .premium-reward-button {
                padding: 12px 30px;
                font-size: 16px;
            }
        }
        
        /* Анімація балансу */
        @keyframes balance-highlight {
            0% { color: inherit; text-shadow: none; }
            50% { color: #4eb5f7; text-shadow: 0 0 10px rgba(78, 181, 247, 0.8); }
            100% { color: inherit; text-shadow: none; }
        }
        
        .balance-updated {
            animation: balance-highlight 1.2s ease;
        }
    `;

    document.head.appendChild(styleElement);
}

/**
 * Налаштування обробників подій
 */
function setupEventHandlers() {
    try {
        // Обробник завершення завдання
        document.addEventListener('task-completed', function(event) {
            if (event.detail && event.detail.taskId) {
                animateSuccessfulCompletion(event.detail.taskId);
            }
        });

        // Обробник щоденного бонусу
        document.addEventListener('daily-bonus-claimed', function(event) {
            if (event.detail) {
                const { token_amount, day_reward, cycle_completed, completion_bonus } = event.detail;

                // Спочатку показуємо основну винагороду
                showDailyBonusReward(
                    day_reward || 0,
                    token_amount || 0,
                    cycle_completed,
                    completion_bonus
                );
            }
        });

        // Обробник зміни розміру вікна
        window.addEventListener('resize', debounce(function() {
            // Адаптуємо якість ефектів залежно від розміру екрану
            if (window.innerWidth < 768 && state.devicePerformance === 'high') {
                state.devicePerformance = 'medium';
            }
        }, 300));

        // Очищення ресурсів при виході зі сторінки
        window.addEventListener('beforeunload', cleanup);
    } catch (error) {
        console.error('UI.Animations: Помилка налаштування обробників подій:', error);
    }
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
    // Зупиняємо всі таймери
    Object.keys(state.timers).forEach(id => {
        clearTimeout(state.timers[id]);
        delete state.timers[id];
    });
}

/**
 * Відкладене виконання функції (утиліта)
 */
export function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Показ анімації винагороди
 * @param {Object} reward - Об'єкт винагороди {amount, type}
 * @param {Object} options - Додаткові опції
 */
export function showReward(reward, options = {}) {
    // Перевіряємо, чи можна показати анімацію зараз
    const now = Date.now();
    if (now - state.lastAnimationTime < 500) {
        setTimeout(() => showReward(reward, options), 700);
        return;
    }

    state.lastAnimationTime = now;
    state.animationsInProgress++;

    // Налаштування за замовчуванням
    const settings = {
        duration: config.rewardDuration,
        showConfetti: true,
        autoClose: true,
        onClose: null,
        specialDay: false,
        id: `reward_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    Object.assign(settings, options);

    // Формуємо дані винагороди
    const rewardAmount = reward.amount;
    const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';
    const iconType = reward.type === 'tokens' ? 'token' : 'coin';

    // Створюємо контейнер для анімації
    const container = document.createElement('div');
    container.className = 'premium-reward-container';

    // Створюємо затемнений фон
    const overlay = document.createElement('div');
    overlay.className = 'premium-reward-overlay';

    // Створюємо картку винагороди
    const card = document.createElement('div');
    card.className = 'premium-reward-card';

    // Визначаємо клас іконки
    const iconClass = (reward.type === 'coins' && settings.specialDay) ? 'token-icon' : '';

    // Наповнюємо картку контентом
    card.innerHTML = `
        <div class="premium-reward-title">${settings.specialDay ? 'Особливий день!' : 'Вітаємо!'}</div>
        
        <div class="premium-reward-icon ${iconClass}">
            <div class="premium-reward-icon-inner" data-icon-type="${iconType}"></div>
        </div>
        
        <div class="premium-reward-amount">
            +${rewardAmount} <span class="premium-reward-currency-icon" data-icon-type="${iconType}-small"></span>
        </div>
        
        <div class="premium-reward-type">Ви отримали ${rewardType}</div>
        
        <button class="premium-reward-button">Чудово!</button>
    `;

    // Збираємо елементи
    container.appendChild(overlay);
    container.appendChild(card);
    document.body.appendChild(container);

    // Показуємо анімацію
    setTimeout(() => {
        overlay.classList.add('show');
        card.classList.add('show');
    }, 100);

    // Додаємо обробник для кнопки
    const button = card.querySelector('.premium-reward-button');
    button.addEventListener('click', () => {
        closeRewardAnimation();
    });

    // Оновлюємо баланс користувача
    updateUserBalance(reward);

    // Автоматичне закриття
    if (settings.autoClose) {
        const timerId = `reward_${settings.id}`;
        state.timers[timerId] = setTimeout(() => {
            closeRewardAnimation();
        }, settings.duration);
    }

    // Функція закриття анімації
    function closeRewardAnimation() {
        // Очищаємо таймер
        const timerId = `reward_${settings.id}`;
        if (state.timers[timerId]) {
            clearTimeout(state.timers[timerId]);
            delete state.timers[timerId];
        }

        // Приховуємо елементи
        overlay.classList.remove('show');
        card.classList.remove('show');

        // Видаляємо контейнер після завершення анімації
        setTimeout(() => {
            container.remove();
            state.animationsInProgress--;

            // Викликаємо callback
            if (typeof settings.onClose === 'function') {
                settings.onClose();
            }
        }, 700);
    }
}

/**
 * Показ анімації для щоденного бонусу (оптимізовано)
 */
export function showDailyBonusReward(winixAmount, tokenAmount, cycleCompleted, completionBonus) {
    // Якщо цикл завершено, спочатку показуємо звичайний бонус
    if (cycleCompleted && completionBonus) {
        // Спочатку показуємо основний бонус
        showReward({
            type: 'tokens',
            amount: winixAmount
        }, {
            duration: config.rewardDuration,
            autoClose: true,
            showConfetti: true,
            onClose: () => {
                // Якщо є жетони, показуємо з затримкою
                if (tokenAmount > 0) {
                    setTimeout(() => {
                        showReward({
                            type: 'coins',
                            amount: tokenAmount
                        }, {
                            duration: config.rewardDuration,
                            autoClose: true,
                            showConfetti: true,
                            specialDay: true,
                            onClose: () => {
                                // Потім з затримкою показуємо бонус за завершення
                                setTimeout(() => {
                                    showCycleCompletionAnimation(completionBonus);
                                }, 700);
                            }
                        });
                    }, 700);
                } else {
                    // Якщо немає жетонів, одразу показуємо бонус за завершення
                    setTimeout(() => {
                        showCycleCompletionAnimation(completionBonus);
                    }, 700);
                }
            }
        });
    } else {
        // Для звичайного щоденного бонусу
        showReward({
            type: 'tokens',
            amount: winixAmount
        }, {
            duration: config.rewardDuration,
            autoClose: true,
            showConfetti: true,
            onClose: () => {
                // Якщо є жетони, показуємо з затримкою
                if (tokenAmount > 0) {
                    setTimeout(() => {
                        showReward({
                            type: 'coins',
                            amount: tokenAmount
                        }, {
                            duration: config.rewardDuration,
                            autoClose: true,
                            showConfetti: true,
                            specialDay: true
                        });
                    }, 700);
                }
            }
        });
    }
}

/**
 * Показати анімацію бонусу за завершення 30-денного циклу (спрощено)
 */
export function showCycleCompletionAnimation(bonusData) {
    if (!bonusData) return;

    showReward({
        type: 'tokens',
        amount: bonusData.amount || 0
    }, {
        duration: config.rewardDuration * 1.5,
        autoClose: true,
        showConfetti: true,
        specialDay: true,
        onClose: () => {
            // Якщо є додаткові жетони, показуємо їх окремо
            if (bonusData.tokens && bonusData.tokens > 0) {
                setTimeout(() => {
                    showReward({
                        type: 'coins',
                        amount: bonusData.tokens
                    }, {
                        duration: config.rewardDuration,
                        autoClose: true,
                        showConfetti: true,
                        specialDay: true
                    });
                }, 700);
            }
        }
    });
}

/**
 * Оновлення балансу користувача
 */
export function updateUserBalance(reward) {
    if (reward.type === 'tokens') {
        // Оновлюємо баланс токенів
        const userTokensElement = document.getElementById('user-tokens');
        if (userTokensElement) {
            const currentBalance = parseFloat(userTokensElement.textContent) || 0;
            const newBalance = currentBalance + reward.amount;
            userTokensElement.textContent = newBalance.toFixed(2);

            // Додаємо клас для анімації
            userTokensElement.classList.add('balance-updated');
            setTimeout(() => {
                userTokensElement.classList.remove('balance-updated');
            }, 2000);

            // Зберігаємо значення
            try {
                localStorage.setItem('userTokens', newBalance.toString());
            } catch (e) {
                console.warn('UI.Animations: Не вдалося зберегти баланс токенів:', e);
            }
        }
    } else if (reward.type === 'coins') {
        // Оновлюємо баланс жетонів
        const userCoinsElement = document.getElementById('user-coins');
        if (userCoinsElement) {
            const currentBalance = parseInt(userCoinsElement.textContent) || 0;
            const newBalance = currentBalance + reward.amount;
            userCoinsElement.textContent = newBalance.toString();

            // Додаємо клас для анімації
            userCoinsElement.classList.add('balance-updated');
            setTimeout(() => {
                userCoinsElement.classList.remove('balance-updated');
            }, 2000);

            // Зберігаємо значення
            try {
                localStorage.setItem('userCoins', newBalance.toString());
            } catch (e) {
                console.warn('UI.Animations: Не вдалося зберегти баланс жетонів:', e);
            }
        }
    }

    // Генеруємо подію про оновлення балансу
    document.dispatchEvent(new CustomEvent('balance-updated', {
        detail: {
            type: reward.type,
            amount: reward.amount
        }
    }));
}

/**
 * Анімація успішного виконання завдання
 */
export function animateSuccessfulCompletion(taskId) {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Додаємо клас для анімації
    taskElement.classList.add('success-pulse');

    // Додаємо анімацію часток для потужних пристроїв
    if (state.highQualityEffects) {
        createSuccessParticles(taskElement);
    }

    // Видаляємо клас анімації через певний час
    setTimeout(() => {
        taskElement.classList.remove('success-pulse');
    }, 2000);
}

/**
 * Створення часток для анімації успіху
 */
export function createSuccessParticles(element) {
    // Отримуємо розміри та позицію елемента
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Кількість частинок залежно від продуктивності
    const particleCount = state.devicePerformance === 'high' ? 15 : 8;

    // Створюємо частинки
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = `${Math.random() * 8 + 4}px`;
        particle.style.height = `${Math.random() * 8 + 4}px`;
        particle.style.backgroundColor = config.particleColors[Math.floor(Math.random() * config.particleColors.length)];
        particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        particle.style.top = `${centerY}px`;
        particle.style.left = `${centerX}px`;
        particle.style.position = 'fixed';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';
        particle.style.transform = 'translate(-50%, -50%)';

        // Додаємо до документу
        document.body.appendChild(particle);

        // Анімуємо частинку
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 100 + 50;
        const duration = Math.random() * 1.5 + 0.5;

        // Створюємо анімацію
        const animation = particle.animate([
            {
                transform: 'translate(-50%, -50%) scale(0.3)',
                opacity: 1
            },
            {
                transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1) rotate(${Math.random() * 360}deg)`,
                opacity: 0
            }
        ], {
            duration: duration * 1000,
            easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
            fill: 'forwards'
        });

        // Видаляємо частинку після завершення анімації
        animation.onfinish = () => {
            particle.remove();
        };
    }
}

/**
 * Показати анімацію прогресу для завдання
 */
export function showProgressAnimation(taskId, progress) {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    const progressBar = taskElement.querySelector('.progress-fill');
    if (progressBar) {
        // Зберігаємо поточне значення
        const currentWidth = parseFloat(progressBar.style.width) || 0;

        // Встановлюємо нове значення з анімацією
        progressBar.style.transition = 'width 1s cubic-bezier(0.1, 0.8, 0.2, 1)';
        progressBar.style.width = `${progress}%`;

        // Додаємо ефект пульсації якщо прогрес збільшився
        if (progress > currentWidth) {
            progressBar.classList.add('pulse');
            setTimeout(() => {
                progressBar.classList.remove('pulse');
            }, 1200);

            // Якщо прогрес більше 95%, додаємо ефект світіння
            if (progress > 95) {
                progressBar.classList.add('glow');
            } else {
                progressBar.classList.remove('glow');
            }
        }

        // Якщо прогрес досягнув 100%, додаткова анімація
        if (progress >= 100 && currentWidth < 100) {
            // Додаємо клас до батьківського елемента
            setTimeout(() => {
                taskElement.classList.add('completed');
            }, 300);
        }
    }
}

/**
 * Анімація для дня з жетонами у щоденному бонусі
 */
export function animateTokenDay(dayElement) {
    if (!dayElement) return;

    // Додаємо класи для анімації
    dayElement.classList.add('token-day-pulse');

    // Створюємо ефект світіння
    const glow = document.createElement('div');
    glow.className = 'token-day-glow';
    glow.style.position = 'absolute';
    glow.style.top = '0';
    glow.style.left = '0';
    glow.style.width = '100%';
    glow.style.height = '100%';
    glow.style.borderRadius = 'inherit';
    glow.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.7)';
    glow.style.animation = 'token-day-pulse 2s infinite ease-in-out';
    glow.style.zIndex = '-1';

    // Якщо у елемента є стилі position: relative, додаємо ефект
    const position = window.getComputedStyle(dayElement).position;
    if (position === 'static') {
        dayElement.style.position = 'relative';
    }

    dayElement.appendChild(glow);

    // Видаляємо ефект через 3 секунди
    setTimeout(() => {
        dayElement.classList.remove('token-day-pulse');
        glow.style.opacity = '1';
        glow.style.transition = 'opacity 1s ease';
        glow.style.opacity = '0';

        setTimeout(() => {
            if (glow.parentNode) {
                glow.parentNode.removeChild(glow);
            }
        }, 1000);
    }, 3000);
}

/**
 * Налаштування режиму продуктивності
 */
export function setPerformanceMode(mode) {
    if (['low', 'medium', 'high'].includes(mode)) {
        state.devicePerformance = mode;
        state.highQualityEffects = mode === 'high';
        localStorage.setItem('devicePerformance', mode);
        return true;
    }
    return false;
}

/**
 * Отримання поточних налаштувань
 */
export function getConfig() {
    return {...config};
}

/**
 * Отримання поточного стану
 */
export function getState() {
    return {
        devicePerformance: state.devicePerformance,
        highQualityEffects: state.highQualityEffects,
        animationsInProgress: state.animationsInProgress,
        initialized: state.initialized
    };
}

// Створюємо об'єкт для експорту
const Animations = {
    init,
    showReward,
    showProgressAnimation,
    animateSuccessfulCompletion,
    showDailyBonusReward,
    animateTokenDay,
    updateUserBalance,
    setPerformanceMode,
    getConfig,
    getState,
    cleanup,
    debounce,
    createSuccessParticles,
    showCycleCompletionAnimation
};

// Ініціалізуємо модуль при завантаженні сторінки
document.addEventListener('DOMContentLoaded', init);

// Для зворотної сумісності зі старим кодом
window.UI = window.UI || {};
window.UI.Animations = Animations;

// Експортуємо за замовчуванням
export default Animations;