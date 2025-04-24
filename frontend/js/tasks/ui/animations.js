/**
 * Animations - преміальний модуль анімацій для системи завдань
 * Адаптований на основі системи розіграшів з додатковими функціями
 */

// Створюємо namespace для UI компонентів, якщо його ще немає
window.UI = window.UI || {};

window.UI.Animations = (function() {
    // Константи для анімацій
    const ANIMATION_DURATION = 2000; // мс
    const PARTICLE_COUNT = 30;
    const PARTICLE_COLORS = ['#4eb5f7', '#00C9A7', '#AD6EE5', '#FFD700'];

    // Налаштування анімацій
    const config = {
        // Чи включені преміальні анімації
        enabled: true,
        // Чи включена адаптація для слабких пристроїв
        adaptiveMode: true,
        // Тривалість анімацій в мс (можна змінювати для оптимізації)
        animationDuration: 500,
        // Максимальна кількість частинок для ефектів
        maxParticles: 15,
        // Швидкість анімації для різних ефектів
        speeds: {
            fast: 300,
            normal: 500,
            slow: 800
        }
    };

    // Стан анімацій
    const state = {
        // Чи були ініціалізовані анімації
        initialized: false,
        // Чи були створені частинки
        particlesCreated: false,
        // Продуктивність пристрою (визначається автоматично)
        devicePerformance: 'high', // 'low', 'medium', 'high'
        // Таймери для різних анімацій
        timers: {},
        // Обмеження для паралельних анімацій
        animationsInProgress: 0
    };

    /**
     * Ініціалізація модуля анімацій
     */
    function init() {
        console.log('UI.Animations: Ініціалізація преміальних анімацій...');

        // Запобігаємо повторній ініціалізації
        if (state.initialized) return;

        // Визначаємо продуктивність пристрою
        detectDevicePerformance();

        // Додаємо стилі для анімацій
        injectAnimationStyles();

        // Створюємо частинки для фону, якщо потрібно
        if (document.querySelector('.particles-container')) {
            createParticles();
        }

        // Додаємо обробники подій
        setupEventHandlers();

        // Встановлюємо флаг ініціалізації
        state.initialized = true;

        console.log('UI.Animations: Преміальні анімації успішно ініціалізовано');
    }

    /**
     * Визначення продуктивності пристрою
     */
    function detectDevicePerformance() {
        try {
            const startTime = performance.now();
            // Проста тестова операція
            let counter = 0;
            for (let i = 0; i < 500000; i++) {
                counter++;
            }
            const endTime = performance.now();
            const duration = endTime - startTime;

            // Визначення категорії пристрою
            if (duration > 50) {
                state.devicePerformance = 'low';
                config.maxParticles = 5;
                config.animationDuration = 300;
            } else if (duration > 20) {
                state.devicePerformance = 'medium';
                config.maxParticles = 10;
            } else {
                state.devicePerformance = 'high';
            }

            console.log(`UI.Animations: Визначено продуктивність пристрою: ${state.devicePerformance}`);

            // Адаптація налаштувань для мобільних пристроїв
            if (window.innerWidth < 768) {
                config.maxParticles = Math.max(5, Math.floor(config.maxParticles * 0.7));
            }
        } catch (e) {
            console.warn('UI.Animations: Помилка при визначенні продуктивності пристрою:', e);
            state.devicePerformance = 'medium';
        }
    }

    /**
     * Вставка стилів анімацій в DOM
     */
    function injectAnimationStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('premium-animations-style')) return;

        const style = document.createElement('style');
        style.id = 'premium-animations-style';
        style.textContent = `
            /* Анімація винагороди */
            .reward-animation-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                z-index: 1000;
            }
            
            .reward-animation {
                background: linear-gradient(135deg, #4eb5f7, #00C9A7);
                color: white;
                font-size: 1.5rem;
                font-weight: bold;
                padding: 1rem 1.5rem;
                border-radius: 0.9375rem;
                box-shadow: 0 0 1.25rem rgba(0, 201, 167, 0.5);
                transform: scale(0);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex;
                align-items: center;
                gap: 0.625rem;
                backdrop-filter: blur(0.625rem);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .reward-animation.show {
                transform: scale(1);
                opacity: 1;
            }
            
            .reward-icon {
                font-size: 1.75rem;
                animation: icon-pulse 2s infinite;
            }
            
            @keyframes icon-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
            }
            
            /* Анімація частинок */
            .particles-container {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 100%;
                pointer-events: none;
                overflow: hidden;
                z-index: -1;
            }
            
            .particle {
                position: absolute;
                border-radius: 50%;
                background: rgba(78, 181, 247, 0.6);
                box-shadow: 0 0 0.625rem rgba(78, 181, 247, 0.4);
                animation: float 15s infinite linear;
            }
            
            @keyframes float {
                0% { transform: translateY(0) translateX(0); }
                25% { transform: translateY(-30px) translateX(10px); }
                50% { transform: translateY(-10px) translateX(20px); }
                75% { transform: translateY(-20px) translateX(-10px); }
                100% { transform: translateY(0) translateX(0); }
            }
            
            /* Анімація конфетті */
            .confetti {
                position: fixed;
                width: 0.625rem;
                height: 0.625rem;
                border-radius: 50%;
                animation: confetti-fall 4s ease-out forwards;
                z-index: 999;
                pointer-events: none;
            }
            
            @keyframes confetti-fall {
                0% {
                    transform: translate(-50%, -50%) translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translate(-50%, -50%) translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
            
            /* Анімації для входження елементів */
            .fade-in-up {
                opacity: 0;
                animation: fadeInUp 0.5s ease forwards;
            }
            
            .fade-in-right {
                opacity: 0;
                animation: fadeInRight 0.5s ease forwards;
            }
            
            .fade-in-down {
                opacity: 0;
                animation: fadeInDown 0.5s ease forwards;
            }
            
            .scale-in {
                opacity: 0;
                animation: scaleIn 0.5s ease forwards;
            }
            
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeInRight {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes fadeInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes scaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            /* Поступова поява елементів з різними затримками */
            .stagger-item:nth-child(1) { animation-delay: 0.1s; }
            .stagger-item:nth-child(2) { animation-delay: 0.2s; }
            .stagger-item:nth-child(3) { animation-delay: 0.3s; }
            .stagger-item:nth-child(4) { animation-delay: 0.4s; }
            .stagger-item:nth-child(5) { animation-delay: 0.5s; }
            
            /* Преміальні стилі для кнопок */
            .action-button {
                position: relative;
                overflow: hidden;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                z-index: 1;
            }
            
            .action-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg,
                    rgba(255, 255, 255, 0),
                    rgba(255, 255, 255, 0.2),
                    rgba(255, 255, 255, 0));
                transition: all 0.6s;
                z-index: -1;
            }
            
            .action-button:hover::before {
                left: 100%;
            }
            
            .action-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 0.25rem 0.9375rem rgba(0, 0, 0, 0.3);
            }
            
            .action-button:active {
                transform: translateY(1px);
                box-shadow: 0 0.125rem 0.3125rem rgba(0, 0, 0, 0.3);
            }
            
            /* Ефект свічення для таймера */
            .timer-container {
                animation: glow-pulse 10s infinite;
            }
            
            @keyframes glow-pulse {
                0% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
                50% { box-shadow: 0 0 15px rgba(0, 201, 167, 0.8), 0 0 30px rgba(0, 201, 167, 0.5); }
                100% { box-shadow: 0 0 5px rgba(0, 201, 167, 0.3); }
            }
            
            /* Анімація для виділення балансу */
            .highlight {
                animation: highlight-animation 2s ease-out;
            }
            
            @keyframes highlight-animation {
                0% {
                    color: white;
                    text-shadow: 0 0 10px rgba(0, 201, 167, 0.8);
                }
                50% {
                    color: #00C9A7;
                    text-shadow: 0 0 15px rgba(0, 201, 167, 1);
                }
                100% {
                    color: white;
                    text-shadow: none;
                }
            }
            
            /* Преміальні стилі для завдань */
            .task-item {
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                border-left: 3px solid transparent;
                overflow: hidden;
                backface-visibility: hidden;
                position: relative;
            }
            
            .task-item:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                border-left: 3px solid rgba(0, 201, 167, 0.8);
            }
            
            .task-item::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background-color: rgba(0, 201, 167, 0.05);
                background-image: radial-gradient(rgba(0, 201, 167, 0.1) 0%, transparent 70%);
                animation: rotate 30s infinite linear;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.5s ease;
            }
            
            .task-item:hover::before {
                opacity: 1;
            }
            
            @keyframes rotate {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            /* Анімація успішного виконання завдання */
            .success-pulse {
                animation: success-pulse 1s ease;
            }
            
            @keyframes success-pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5);
                }
                50% {
                    box-shadow: 0 0 30px 5px rgba(0, 201, 167, 0.8);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5);
                }
            }
            
            /* Адаптивні стилі для різних пристроїв */
            @media (max-width: 768px) {
                .reward-animation {
                    font-size: 1.25rem;
                    padding: 0.75rem 1.25rem;
                }
                
                .reward-icon {
                    font-size: 1.5rem;
                }
            }
            
            /* Адаптація для слабких пристроїв */
            .low-performance-mode .task-item::before,
            .low-performance-mode .action-button::before {
                display: none;
            }
            
            .low-performance-mode .task-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Створення частинок для фону
     */
    function createParticles() {
        if (!config.enabled || state.particlesCreated) return;

        // Знаходимо всі контейнери для частинок
        const containers = document.querySelectorAll('.particles-container');
        if (!containers.length) return;

        // Очищаємо контейнери
        containers.forEach(container => {
            container.innerHTML = '';
        });

        // Визначаємо кількість частинок в залежності від продуктивності
        let particleCount = config.maxParticles;
        if (state.devicePerformance === 'low') {
            particleCount = 5;
        } else if (state.devicePerformance === 'medium') {
            particleCount = 8;
        }

        // Створюємо частинки
        containers.forEach(container => {
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';

                // Випадковий розмір
                const size = Math.random() * 5 + 2;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;

                // Випадкова початкова позиція
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;

                // Випадкова прозорість
                particle.style.opacity = (Math.random() * 0.5 + 0.1).toString();

                // Випадковий колір
                const hue = Math.random() * 40 + 190; // Від блакитного до синього
                particle.style.backgroundColor = `hsla(${hue}, 100%, 70%, 0.6)`;

                // Випадкова анімація
                const duration = Math.random() * 15 + 5;
                particle.style.animationDuration = `${duration}s`;

                // Додаємо частинку в контейнер
                container.appendChild(particle);
            }
        });

        state.particlesCreated = true;
    }

    /**
     * Налаштування обробників подій
     */
    function setupEventHandlers() {
        // Оновлення частинок при зміні розміру вікна
        window.addEventListener('resize', debounce(() => {
            state.particlesCreated = false;
            createParticles();
        }, 300));

        // Прослуховування події для анімації успішного виконання завдання
        document.addEventListener('task-completed', (event) => {
            if (event.detail && event.detail.taskId) {
                animateSuccessfulCompletion(event.detail.taskId);
            }
        });
    }

    /**
     * Показати анімацію отримання винагороди
     * @param {Object} reward - Об'єкт з даними про винагороду
     * @param {Object} options - Додаткові параметри анімації
     */
    function showReward(reward, options = {}) {
        // Параметри анімації
        const {
            duration = ANIMATION_DURATION,
            showParticles = true,
            showNotification = true
        } = options;

        // Формуємо текст винагороди
        const rewardAmount = reward.amount;
        const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';
        const rewardText = `+${rewardAmount} ${rewardType}`;

        // Створюємо контейнер для анімації винагороди
        const animationContainer = document.createElement('div');
        animationContainer.className = 'reward-animation-container';
        document.body.appendChild(animationContainer);

        // Створюємо елемент з винагородою
        const rewardElement = document.createElement('div');
        rewardElement.className = 'reward-animation';

        // Додаємо іконку в залежності від типу винагороди
        const iconElement = document.createElement('span');
        iconElement.className = 'reward-icon';
        iconElement.textContent = reward.type === 'tokens' ? '💰' : '🎖️';

        // Додаємо текст винагороди
        const textElement = document.createElement('span');
        textElement.textContent = rewardText;

        // Збираємо елементи
        rewardElement.appendChild(iconElement);
        rewardElement.appendChild(textElement);

        // Додаємо елемент винагороди до контейнера
        animationContainer.appendChild(rewardElement);

        // Додаємо частинки, якщо потрібно
        if (showParticles) {
            createConfetti(rewardElement);
        }

        // Показуємо анімацію
        setTimeout(() => {
            rewardElement.classList.add('show');

            // Видаляємо після завершення
            setTimeout(() => {
                rewardElement.classList.remove('show');
                setTimeout(() => {
                    animationContainer.remove();

                    // Показуємо сповіщення після анімації
                    if (showNotification) {
                        showRewardNotification(reward);
                    }
                }, 300);
            }, duration);
        }, 100);

        // Оновлюємо баланс користувача
        updateUserBalance(reward);

        // Відтворюємо звук успіху, якщо він доступний
        playSound('success');
    }

    /**
     * Показати сповіщення про отриману винагороду
     */
    function showRewardNotification(reward) {
        // Якщо є компонент сповіщень, використовуємо його
        if (window.UI.Notifications && window.UI.Notifications.showSuccess) {
            const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';
            window.UI.Notifications.showSuccess(`Ви отримали ${reward.amount} ${rewardType}!`);
        }
    }

    /**
     * Створення конфетті для анімації
     */
    function createConfetti(targetElement) {
        // Обмеження для слабких пристроїв
        const confettiCount = state.devicePerformance === 'low' ? 20 :
                              state.devicePerformance === 'medium' ? 30 : 50;

        const confettiColors = PARTICLE_COLORS;

        // Отримуємо позицію елемента
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Створюємо конфетті
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';

            // Випадковий розмір
            const size = Math.random() * 8 + 4;
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;

            // Випадковий колір
            const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
            confetti.style.backgroundColor = color;

            // Випадкова форма (коло або квадрат)
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';

            // Встановлюємо початкову позицію
            confetti.style.top = `${centerY}px`;
            confetti.style.left = `${centerX}px`;

            // Випадковий кут і відстань
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50;
            const speedX = Math.cos(angle) * distance;
            const speedY = Math.sin(angle) * distance;

            // Випадкова затримка
            const delay = Math.random() * 0.5;

            // Встановлюємо анімацію
            confetti.style.animationDelay = `${delay}s`;
            confetti.style.transform = `translate(-50%, -50%) translateX(${speedX}px) translateY(${speedY}px)`;

            // Додаємо до body
            document.body.appendChild(confetti);

            // Видаляємо після завершення анімації
            setTimeout(() => {
                confetti.remove();
            }, 4000 + delay * 1000);
        }
    }

    /**
     * Оновити баланс користувача
     */
    function updateUserBalance(reward) {
        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                userTokensElement.textContent = (currentBalance + reward.amount).toFixed(2);
                userTokensElement.classList.add('highlight');
                setTimeout(() => {
                    userTokensElement.classList.remove('highlight');
                }, 2000);
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                userCoinsElement.textContent = currentBalance + reward.amount;
                userCoinsElement.classList.add('highlight');
                setTimeout(() => {
                    userCoinsElement.classList.remove('highlight');
                }, 2000);
            }
        }
    }

    /**
     * Анімація успішного виконання завдання
     */
    function animateSuccessfulCompletion(taskId) {
        // Знаходимо елемент завдання
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        // Додаємо ефект пульсації
        taskElement.classList.add('success-pulse');

        // Створюємо конфетті навколо елемента
        createTaskConfetti(taskElement);

        // Видаляємо класи через 2 секунди
        setTimeout(() => {
            taskElement.classList.remove('success-pulse');
        }, 2000);
    }

    /**
     * Створення конфетті для завдання
     */
    function createTaskConfetti(taskElement) {
        // Обмеження для слабких пристроїв
        if (state.devicePerformance === 'low') return;

        const confettiCount = state.devicePerformance === 'medium' ? 20 : 30;
        const confettiColors = ['#4eb5f7', '#00c9a7', '#ffcc00', '#ff6b6b', '#8a2be2'];

        // Отримуємо позицію і розміри елемента
        const rect = taskElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Створюємо конфетті
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = `${Math.random() * 8 + 4}px`;
            confetti.style.height = `${Math.random() * 8 + 4}px`;
            confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.top = `${centerY}px`;
            confetti.style.left = `${centerX}px`;
            confetti.style.position = 'fixed';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '9999';
            confetti.style.transform = 'translate(-50%, -50%)';

            // Додаємо до body
            document.body.appendChild(confetti);

            // Анімуємо конфетті
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 150 + 50;
            const duration = Math.random() + 1;

            confetti.animate([
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
                easing: 'cubic-bezier(0, 0.5, 0.5, 1)',
                fill: 'forwards'
            });

            // Видаляємо після завершення анімації
            setTimeout(() => {
                confetti.remove();
            }, duration * 1000);
        }
    }

    /**
     * Анімація прогресу для завдання
     * @param {string} taskId - ID завдання
     * @param {number} progress - Поточний прогрес (0-100)
     */
    function showProgressAnimation(taskId, progress) {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return;

        const progressBar = taskElement.querySelector('.progress-fill');
        if (progressBar) {
            // Зберігаємо поточну ширину
            const currentWidth = parseFloat(progressBar.style.width) || 0;

            // Встановлюємо нову ширину з анімацією
            progressBar.style.transition = 'width 1s ease-out';
            progressBar.style.width = `${progress}%`;

            // Додаємо ефект пульсації, якщо прогрес збільшився
            if (progress > currentWidth) {
                progressBar.classList.add('pulse');
                setTimeout(() => {
                    progressBar.classList.remove('pulse');
                }, 1000);
            }
        }
    }

    /**
     * Відтворити звуковий ефект
     * @param {string} type - Тип звуку ('success', 'error', 'click')
     */
    function playSound(type) {
        // Перевіряємо чи включені звуки в налаштуваннях користувача
        const soundsEnabled = localStorage.getItem('sounds_enabled') !== 'false';
        if (!soundsEnabled) return;

        let soundUrl;

        // Визначаємо URL звуку залежно від типу
        switch (type) {
            case 'success':
                soundUrl = 'assets/sounds/success.mp3';
                break;
            case 'error':
                soundUrl = 'assets/sounds/error.mp3';
                break;
            case 'click':
                soundUrl = 'assets/sounds/click.mp3';
                break;
            default:
                return;
        }

        // Створюємо аудіо елемент
        const audio = new Audio(soundUrl);

        // Встановлюємо гучність
        audio.volume = 0.5;

        // Відтворюємо звук
        audio.play().catch(error => {
            console.warn('Не вдалося відтворити звук:', error);
        });
    }

    /**
     * Анімація заголовків
     */
    function animateHeaders() {
        // Анімуємо заголовки секцій
        document.querySelectorAll('.category-title').forEach((title, index) => {
            title.classList.add('fade-in-down');
            title.style.animationDelay = `${index * 0.2}s`;
        });
    }

    /**
     * Анімація завдань
     */
    function animateTasks() {
        // Анімуємо завдання
        document.querySelectorAll('.task-item').forEach((task, index) => {
            task.classList.add('fade-in-up', 'stagger-item');
            task.style.animationDelay = `${0.1 + index * 0.1}s`;
        });
    }

    /**
     * Допоміжна функція для відкладеного виконання (debounce)
     */
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    /**
     * Швидке створення елементу з класом та вмістом
     */
    function createElement(tag, className, content = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.innerHTML = content;
        return element;
    }

    /**
     * Ініціалізація анімацій для всієї сторінки
     */
    function initPageAnimations() {
        // Визначаємо режим продуктивності для Body
        if (state.devicePerformance === 'low') {
            document.body.classList.add('low-performance-mode');
        }

        // Анімуємо заголовки
        animateHeaders();

        // Анімуємо завдання
        animateTasks();

        // Додаємо обробники подій для анімованих елементів
        document.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('mouseenter', () => {
                playSound('click');
            });
        });

        // Створюємо частинки для фону
        if (document.querySelector('.particles-container')) {
            createParticles();
        }
    }

    // Публічний API модуля
    return {
        init,
        showReward,
        showProgressAnimation,
        playSound,
        animateSuccessfulCompletion,
        createConfetti,
        animateHeaders,
        animateTasks,
        initPageAnimations
    };
})();