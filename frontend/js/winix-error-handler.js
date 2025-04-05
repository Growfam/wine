// winix-error-handler.js
(function() {
    console.log("🔧 Ініціалізація системи перехоплення помилок WINIX");

    // Функція для безпечного виклику методів
    function safeMethodCall(obj, path, fallback) {
        try {
            // Розбиваємо шлях на частини (наприклад, "WinixCore.Staking.calculateExpectedReward")
            const parts = path.split('.');
            let current = window;

            // Проходимо по частинах шляху
            for (const part of parts) {
                if (current[part] === undefined) {
                    console.warn(`⚠️ Об'єкт ${part} не знайдено в ${path}`);
                    return fallback;
                }
                current = current[part];
            }

            // Якщо це функція, повертаємо безпечну обгортку
            if (typeof current === 'function') {
                return function() {
                    try {
                        return current.apply(obj, arguments);
                    } catch (e) {
                        console.error(`❌ Помилка виклику ${path}:`, e);
                        if (typeof fallback === 'function') {
                            return fallback.apply(null, arguments);
                        }
                        return fallback;
                    }
                };
            }

            // Якщо це не функція, просто повертаємо значення
            return current;
        } catch (e) {
            console.error(`❌ Помилка доступу до ${path}:`, e);
            return fallback;
        }
    }

    // Функція для створення прокладки між об'єктами
    function createProxyObject(target, fallbacks) {
        // Створюємо проксі-об'єкт, який перехоплює доступ до властивостей
        return new Proxy(target || {}, {
            get: function(target, prop) {
                // Якщо властивість існує, використовуємо її
                if (prop in target) {
                    const value = target[prop];

                    // Якщо це об'єкт, робимо і його проксі для глибокого перехоплення
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        return createProxyObject(value, fallbacks);
                    }

                    // Якщо це функція, створюємо безпечну обгортку
                    if (typeof value === 'function') {
                        return function() {
                            try {
                                return value.apply(target, arguments);
                            } catch (e) {
                                console.error(`❌ Помилка виклику ${String(prop)}:`, e);

                                // Шукаємо запасний варіант
                                const fallback = fallbacks[String(prop)];
                                if (typeof fallback === 'function') {
                                    return fallback.apply(null, arguments);
                                }

                                // Повертаємо null, якщо немає запасного варіанту
                                return null;
                            }
                        };
                    }

                    return value;
                }

                // Якщо властивість не існує, але є запасний варіант
                if (fallbacks && prop in fallbacks) {
                    return fallbacks[prop];
                }

                // Створюємо новий проксі-об'єкт для вкладеного шляху
                return createProxyObject({}, fallbacks);
            }
        });
    }

    // Функції-замінники для критичних методів
    const fallbacks = {
        // Розрахунок очікуваної винагороди
        calculateExpectedReward: function(amount, period) {
            amount = parseFloat(amount) || 0;
            period = parseInt(period) || 14;

            // Базові ставки відсотків
            const rates = {
                7: 4,    // 4% за 7 днів
                14: 9,   // 9% за 14 днів
                28: 15   // 15% за 28 днів
            };

            const rate = rates[period] || 9; // За замовчуванням 9%
            const reward = (amount * rate) / 100;

            return parseFloat(reward.toFixed(2));
        },

        // Отримання даних стейкінгу
        getStakingData: function() {
            try {
                const data = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                return data ? JSON.parse(data) : {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    period: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                };
            } catch (e) {
                console.error("❌ Помилка отримання даних стейкінгу:", e);
                return {
                    hasActiveStaking: false,
                    stakingAmount: 0,
                    period: 0,
                    rewardPercent: 0,
                    expectedReward: 0,
                    remainingDays: 0
                };
            }
        }
    };

    // Створюємо проксі для WinixCore, якщо він не існує
    if (!window.WinixCore) {
        window.WinixCore = createProxyObject({}, fallbacks);
    }

    // Створюємо проксі для WinixCore.Staking, якщо він не існує
    if (!window.WinixCore.Staking) {
        window.WinixCore.Staking = createProxyObject({}, fallbacks);
    }

    // Безпечний доступ до calculateExpectedReward
    window.WinixCore.Staking.calculateExpectedReward = safeMethodCall(
        window.WinixCore.Staking,
        'WinixCore.Staking.calculateExpectedReward',
        fallbacks.calculateExpectedReward
    );

    console.log("✅ Система перехоплення помилок WINIX успішно ініціалізована");
})();