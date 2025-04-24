/**
 * Animations - модуль для анімацій та візуальних ефектів
 * Відповідає за:
 * - Анімацію отримання винагород
 * - Частинки та ефекти для інтерфейсу
 * - Анімовані переходи між станами
 */

// Створюємо namespace для UI компонентів, якщо його ще немає
window.UI = window.UI || {};

window.UI.Animations = (function() {
    // Константи для анімацій
    const ANIMATION_DURATION = 2000; // мс
    const PARTICLE_COUNT = 30;
    const PARTICLE_COLORS = ['#4eb5f7', '#00C9A7', '#AD6EE5', '#FFD700'];

    /**
     * Показати анімацію отримання винагороди з конфетті
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
        rewardElement.textContent = rewardText;

        // Додаємо іконку в залежності від типу винагороди
        const iconElement = document.createElement('span');
        iconElement.className = 'reward-icon';
        iconElement.textContent = reward.type === 'tokens' ? '💰' : '🎖️';
        rewardElement.prepend(iconElement);

        // Додаємо елемент винагороди до контейнера
        animationContainer.appendChild(rewardElement);

        // Додаємо частинки, якщо потрібно
        if (showParticles) {
            createParticles(animationContainer);
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
     * Створити частинки для анімації
     */
    function createParticles(container) {
        // Створюємо контейнер для частинок
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'particles-container';
        container.appendChild(particlesContainer);

        // Створюємо частинки
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            // Встановлюємо випадковий колір
            const randomColor = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
            particle.style.backgroundColor = randomColor;

            // Встановлюємо випадкове положення
            const xPos = Math.random() * 100;
            particle.style.left = `${xPos}%`;

            // Встановлюємо випадкову швидкість та напрямок
            const duration = Math.random() * 2 + 2; // від 2 до 4 секунд
            const delay = Math.random() * 0.5; // від 0 до 0.5 секунд

            particle.style.animation = `particle-animation ${duration}s ease-out ${delay}s`;

            // Додаємо частинку до контейнера
            particlesContainer.appendChild(particle);
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
     * Показати анімацію прогресу для завдання
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
     * Додати стилі для анімацій
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('animation-styles')) return;

        // Створюємо елемент стилів
        const styleElement = document.createElement('style');
        styleElement.id = 'animation-styles';

        // Додаємо CSS для анімацій
        styleElement.textContent = `
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
                font-size: 24px;
                font-weight: bold;
                padding: 15px 25px;
                border-radius: 15px;
                box-shadow: 0 0 20px rgba(0, 201, 167, 0.5);
                transform: scale(0);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .reward-animation.show {
                transform: scale(1);
                opacity: 1;
            }
            
            .reward-icon {
                font-size: 28px;
            }
            
            /* Анімація частинок */
            .particles-container {
                position: absolute;
                width: 100%;
                height: 100%;
                top: 0;
                left: 0;
                pointer-events: none;
                overflow: hidden;
            }
            
            .particle {
                position: absolute;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                bottom: 50%;
                opacity: 0;
            }
            
            @keyframes particle-animation {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(-100vh) rotate(720deg);
                    opacity: 0;
                }
            }
            
            /* Анімація прогрес-бару */
            .progress-fill.pulse {
                animation: progress-pulse 1s ease-out;
            }
            
            @keyframes progress-pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5);
                }
                70% {
                    box-shadow: 0 0 0 10px rgba(0, 201, 167, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0);
                }
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
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    // Ініціалізація модуля
    function init() {
        // Додаємо стилі для анімацій
        injectStyles();

        console.log('UI.Animations: Модуль анімацій ініціалізовано');
    }

    // Ініціалізуємо модуль під час завантаження
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        showReward,
        showProgressAnimation,
        playSound,
        init
    };
})();