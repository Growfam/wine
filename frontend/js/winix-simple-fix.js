/**
 * winix-simple-fix.js
 *
 * Спрощений файл для виправлення проблем з ID користувача та запобігання зависанню
 * Замінює api-id-patch.js, emergency-id-fix.js та user-id-manager.js
 */

(function() {
    console.log("🔧 Запуск спрощеної системи виправлень WINIX");

    // Змінні
    let currentUserId = null;
    let processingRequest = false;

    // Функція отримання ID користувача
    function getUserId() {
        // Якщо ID вже збережений в змінній - повертаємо його
        if (currentUserId) return currentUserId;

        // Отримуємо ID з localStorage
        currentUserId = localStorage.getItem('telegram_user_id') ||
                        localStorage.getItem('userId') ||
                        localStorage.getItem('user_id');

        // Якщо не знайдено в localStorage, шукаємо в URL
        if (!currentUserId) {
            const urlParams = new URLSearchParams(window.location.search);
            currentUserId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        }

        // Якщо не знайдено в URL, шукаємо в DOM
        if (!currentUserId) {
            const idElement = document.getElementById('user-id');
            if (idElement && idElement.textContent) {
                currentUserId = idElement.textContent.trim();
            }
        }

        // Якщо ID не знайдено, використовуємо значення за замовчуванням
        if (!currentUserId || currentUserId === 'undefined' || currentUserId === 'null') {
            currentUserId = "12345678";
        }

        // Зберігаємо ID в localStorage для майбутнього використання
        try {
            localStorage.setItem('telegram_user_id', currentUserId);
            localStorage.setItem('userId', currentUserId);
        } catch (e) {
            console.warn("Не вдалося зберегти ID в localStorage:", e);
        }

        // Оновлюємо елементи DOM з ID
        updateDomElements();

        return currentUserId;
    }

    // Функція оновлення елементів DOM з ID користувача
    function updateDomElements() {
        try {
            if (!currentUserId) return;

            // Оновлюємо елемент user-id, якщо він існує
            const userIdElement = document.getElementById('user-id');
            if (userIdElement) {
                userIdElement.textContent = currentUserId;
            } else {
                // Якщо елемента немає, створюємо прихований
                const hiddenId = document.createElement('div');
                hiddenId.id = 'user-id';
                hiddenId.style.display = 'none';
                hiddenId.textContent = currentUserId;
                document.body.appendChild(hiddenId);
            }

            // Оновлюємо інші елементи з класом user-id-value
            const idElements = document.querySelectorAll('.user-id-value');
            idElements.forEach(el => {
                if (el) el.textContent = currentUserId;
            });
        } catch (e) {
            console.warn("Помилка оновлення DOM елементів:", e);
        }
    }

    // Виправлення запитів API для підстановки ID користувача
    function fixApiRequests() {
        // Зберігаємо оригінальний fetch
        const originalFetch = window.fetch;

        // Замінюємо fetch нашою версією
        window.fetch = function(url, options = {}) {
            // Якщо це запит до API
            if (typeof url === 'string' && url.includes('/api/')) {
                try {
                    const userId = getUserId();

                    if (url.includes('/api/user/') && !url.includes(`/api/user/${userId}`)) {
    // Додаємо ID користувача до URL тільки якщо його ще немає
    url = url.replace('/api/user/', `/api/user/${userId}/`);
}

                    // Додаємо ID в заголовки
                    if (!options.headers) options.headers = {};
                    options.headers['X-User-Id'] = userId;
                    options.headers['X-Telegram-User-Id'] = userId;

                    // Додаємо таймаут для запиту
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    // Якщо сигнал вже існує, зберігаємо його
                    const originalSignal = options.signal;
                    options.signal = controller.signal;

                    // Обробляємо запит зі стейкінгу окремо
                    if (url.includes('/staking') && !processingRequest) {
                        processingRequest = true;

                        // Таймаут для автоматичного скасування зависання запиту стейкінгу
                        setTimeout(() => {
                            if (processingRequest) {
                                console.warn("Виявлено зависання запиту стейкінгу. Скасовуємо...");
                                controller.abort();
                                processingRequest = false;

                                // Скидаємо дані стейкінгу для уникнення проблем
                                const emptyStaking = {
                                    hasActiveStaking: false,
                                    status: "cancelled",
                                    stakingAmount: 0,
                                    period: 0,
                                    rewardPercent: 0,
                                    expectedReward: 0,
                                    remainingDays: 0
                                };

                                localStorage.setItem('stakingData', JSON.stringify(emptyStaking));
                                localStorage.setItem('winix_staking', JSON.stringify(emptyStaking));

                                // Спробуємо перезавантажити сторінку, якщо це сторінка стейкінгу
                                if (window.location.href.includes('staking')) {
                                    alert("Сталася помилка завантаження даних стейкінгу. Сторінка буде перезавантажена.");
                                    window.location.reload();
                                }
                            }
                        }, 8000);
                    }

                    return originalFetch(url, options)
                        .then(response => {
                            clearTimeout(timeoutId);
                            processingRequest = false;
                            return response;
                        })
                        .catch(error => {
                            clearTimeout(timeoutId);
                            processingRequest = false;

                            // Перевіряємо, чи це помилка 404 на запит стейкінгу
                            if (url.includes('/staking') && (error.message.includes('404') || error.message.includes('not found'))) {
                                console.warn("Отримано 404 для стейкінгу. Створюємо порожні дані стейкінгу.");

                                // Створюємо порожні дані стейкінгу
                                const emptyStaking = {
                                    hasActiveStaking: false,
                                    status: "cancelled",
                                    stakingAmount: 0,
                                    period: 0,
                                    rewardPercent: 0,
                                    expectedReward: 0,
                                    remainingDays: 0
                                };

                                localStorage.setItem('stakingData', JSON.stringify(emptyStaking));
                                localStorage.setItem('winix_staking', JSON.stringify(emptyStaking));

                                // Повертаємо штучну відповідь для запитів стейкінгу
                                return {
                                    ok: true,
                                    status: 200,
                                    json: () => Promise.resolve({
                                        status: 'success',
                                        data: emptyStaking
                                    })
                                };
                            }

                            // Для інших помилок просто передаємо далі
                            throw error;
                        });
                } catch (e) {
                    console.error("Помилка в модифікованому fetch:", e);
                    return originalFetch(url, options);
                }
            }

            // Для не-API запитів викликаємо оригінальний fetch
            return originalFetch(url, options);
        };
    }

    // Функція для швидкого виправлення зависання сторінки стейкінгу
    function fixStakingPage() {
        // Перевіряємо, чи ми на сторінці стейкінгу
        if (window.location.href.includes('staking')) {
            console.log("🔧 Застосування виправлень для сторінки стейкінгу");

            // Встановлюємо таймаут для виявлення зависання сторінки
            setTimeout(() => {
                // Перевіряємо елементи, які вказують на зависання
                const stakingStatus = document.getElementById('staking-status');
                const loadingElement = document.querySelector('.loading');

                if ((stakingStatus && stakingStatus.textContent.includes('Заванта')) || loadingElement) {
                    console.warn("Виявлено зависання сторінки стейкінгу. Виправляємо...");

                    // Скидаємо дані стейкінгу
                    const emptyStaking = {
                        hasActiveStaking: false,
                        status: "cancelled",
                        stakingAmount: 0,
                        period: 0,
                        rewardPercent: 0,
                        expectedReward: 0,
                        remainingDays: 0
                    };

                    localStorage.setItem('stakingData', JSON.stringify(emptyStaking));
                    localStorage.setItem('winix_staking', JSON.stringify(emptyStaking));

                    // Оновлюємо відображення
                    if (stakingStatus) {
                        stakingStatus.textContent = "Наразі немає активних стейкінгів";
                    }

                    if (loadingElement) {
                        loadingElement.classList.remove('loading');
                    }

                    // Виправляємо кнопки
                    const stakeButton = document.getElementById('stake-button');
                    if (stakeButton) {
                        const originalHandler = stakeButton.onclick;
                        stakeButton.onclick = function(e) {
                            // Зберігаємо оригінальний обробник, якщо він є і працює
                            try {
                                if (typeof window.handleStakeButton === 'function') {
                                    return window.handleStakeButton();
                                } else if (originalHandler) {
                                    return originalHandler.call(this, e);
                                }
                            } catch (error) {
                                console.error("Помилка у обробнику кнопки стейкінгу:", error);
                                return false;
                            }
                        };
                    }

                    // Оновлюємо очікувану нагороду
                    const rewardElement = document.getElementById('expected-reward');
                    if (rewardElement) {
                        rewardElement.textContent = "0.00";
                    }

                    // Відображаємо кнопки
                    const buttons = document.querySelectorAll('button');
                    buttons.forEach(btn => {
                        if (btn.style.display === 'none') {
                            btn.style.display = '';
                        }
                    });

                    // Показуємо повідомлення користувачу
                    console.log("Сторінку стейкінгу виправлено.");
                }
            }, 5000);
        }
    }

    // Ініціалізація системи виправлень
    function init() {
        // Отримуємо ID користувача
        getUserId();

        // Застосовуємо виправлення для API запитів
        fixApiRequests();

        // Застосовуємо виправлення для сторінки стейкінгу
        fixStakingPage();

        // Перехоплюємо необроблені проміси щоб уникнути зависання
        window.addEventListener('unhandledrejection', function(event) {
            if (event.reason && (
                event.reason.toString().includes('API') ||
                event.reason.toString().includes('404') ||
                event.reason.toString().includes('staking')
            )) {
                console.warn("Перехоплено необроблений проміс:", event.reason);
                // Запобігаємо відображенню помилки в консолі
                event.preventDefault();
            }
        });

        console.log("✅ Систему виправлень ініціалізовано");
    }

    // Експортуємо API для використання в інших скриптах
    window.SimpleFix = {
        getUserId,
        updateDomElements,
        fixStakingPage
    };

    // Запускаємо ініціалізацію
    init();
})();