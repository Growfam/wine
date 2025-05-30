/**
 * Система управління екранами завантаження
 * Для WINIX системи завдань
 */

(function() {
    'use strict';

    console.log('🚀 [LoadingSystem] Ініціалізація системи завантаження');

    // Конфігурація
    const CONFIG = {
        pageLoadDelay: 3000,      // 3 секунди для початкового завантаження
        tabSwitchDelay: 1500,     // 1.5 секунди для переключення вкладок
        fadeOutDuration: 500,     // Тривалість анімації зникнення
        minLoadingTime: 800       // Мінімальний час показу лоадера
    };

    // Стан системи
    const state = {
        isPageLoading: true,
        isTabLoading: false,
        currentTab: null,
        loadingStartTime: null
    };

    /**
     * Показати повний екран завантаження
     */
    function showFullLoadingScreen() {
        const loadingScreen = document.getElementById('fullLoadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            loadingScreen.classList.remove('fade-out');
            state.isPageLoading = true;
            console.log('📋 [LoadingSystem] Показано повний екран завантаження');
        }
    }

    /**
     * Приховати повний екран завантаження
     */
    function hideFullLoadingScreen() {
        const loadingScreen = document.getElementById('fullLoadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');

            setTimeout(() => {
                loadingScreen.style.display = 'none';
                state.isPageLoading = false;
                console.log('✅ [LoadingSystem] Приховано повний екран завантаження');

                // Генеруємо подію про готовність сторінки
                document.dispatchEvent(new CustomEvent('page-loaded'));
            }, CONFIG.fadeOutDuration);
        }
    }

    /**
     * Показати міні-лоадер для вкладок
     */
    function showTabLoader() {
        const tabLoader = document.getElementById('tabLoadingOverlay');
        const tabContent = document.querySelector('.tab-content');

        if (tabLoader && !state.isPageLoading) {
            // Додаємо клас loading до контейнера
            if (tabContent) {
                tabContent.classList.add('loading');
            }

            // Показуємо лоадер
            tabLoader.style.display = 'flex';
            setTimeout(() => {
                tabLoader.classList.add('show');
            }, 10);

            state.isTabLoading = true;
            state.loadingStartTime = Date.now();

            console.log('🔄 [LoadingSystem] Показано лоадер вкладки');
        }
    }

    /**
     * Приховати міні-лоадер для вкладок
     */
    function hideTabLoader() {
        const tabLoader = document.getElementById('tabLoadingOverlay');
        const tabContent = document.querySelector('.tab-content');

        if (tabLoader && state.isTabLoading) {
            // Розраховуємо залишковий час
            const elapsedTime = Date.now() - state.loadingStartTime;
            const remainingTime = Math.max(0, CONFIG.minLoadingTime - elapsedTime);

            setTimeout(() => {
                tabLoader.classList.remove('show');
                tabLoader.classList.add('fade-out');

                // Прибираємо клас loading
                if (tabContent) {
                    tabContent.classList.remove('loading');
                }

                setTimeout(() => {
                    tabLoader.style.display = 'none';
                    tabLoader.classList.remove('fade-out');
                    state.isTabLoading = false;

                    console.log('✅ [LoadingSystem] Приховано лоадер вкладки');

                    // Генеруємо подію про готовність вкладки
                    document.dispatchEvent(new CustomEvent('tab-loaded', {
                        detail: { tab: state.currentTab }
                    }));
                }, CONFIG.fadeOutDuration);
            }, remainingTime);
        }
    }

    /**
     * Обробник переключення вкладок з затримкою
     */
    function handleTabSwitch(tabName) {
        if (state.isPageLoading || state.isTabLoading) {
            console.log('⏸️ [LoadingSystem] Переключення вкладок заблоковано під час завантаження');
            return;
        }

        console.log('📑 [LoadingSystem] Переключення на вкладку:', tabName);

        state.currentTab = tabName;

        // Показуємо лоадер
        showTabLoader();

        // Імітуємо завантаження даних
        setTimeout(() => {
            // Тут можна додати реальне завантаження даних
            // Наприклад, виклик API для отримання завдань

            // Приховуємо лоадер після затримки
            hideTabLoader();

            // Додаємо анімацію появи контенту
            const targetPane = document.getElementById(tabName + '-tab');
            if (targetPane) {
                targetPane.classList.add('fade-in-quick');

                // Видаляємо клас анімації після завершення
                setTimeout(() => {
                    targetPane.classList.remove('fade-in-quick');
                }, 300);
            }
        }, CONFIG.tabSwitchDelay);
    }

    /**
     * Ініціалізація обробників подій
     */
    function initEventHandlers() {
        // Перехоплюємо клік на вкладках
        const tabButtons = document.querySelectorAll('.tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();

                const tabName = this.getAttribute('data-tab');
                const isActive = this.classList.contains('active');

                // Не перезавантажуємо активну вкладку
                if (!isActive && !state.isTabLoading) {
                    // Спочатку оновлюємо UI вкладок
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');

                    // Приховуємо всі панелі
                    const panes = document.querySelectorAll('.main-tab-pane');
                    panes.forEach(pane => {
                        pane.classList.remove('active');
                        pane.style.display = 'none';
                    });

                    // Запускаємо завантаження з затримкою
                    handleTabSwitch(tabName);

                    // Показуємо цільову панель після лоадера
                    document.addEventListener('tab-loaded', function onTabLoaded(event) {
                        if (event.detail.tab === tabName) {
                            const targetPane = document.getElementById(tabName + '-tab');
                            if (targetPane) {
                                targetPane.classList.add('active');
                                targetPane.style.display = 'block';

                                // Оновлюємо Store
                                if (window.TasksStore) {
                                    window.TasksStore.actions.setCurrentTab(tabName);
                                }

                                // Генеруємо подію для TasksManager
                                document.dispatchEvent(new CustomEvent('tab-switched', {
                                    detail: { tab: tabName }
                                }));
                            }

                            // Видаляємо обробник
                            document.removeEventListener('tab-loaded', onTabLoaded);
                        }
                    });
                }
            });
        });

        // Блокуємо навігацію під час завантаження
        const navItems = document.querySelectorAll('.nav-bar .nav-item');
        navItems.forEach(item => {
            const originalHandler = item.onclick;

            item.addEventListener('click', function(e) {
                if (state.isPageLoading || state.isTabLoading) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('⏸️ [LoadingSystem] Навігація заблокована під час завантаження');

                    // Показуємо toast повідомлення
                    showToast('Зачекайте завершення завантаження', 'warning');
                    return false;
                }
            }, true);
        });
    }

    /**
     * Показати toast повідомлення
     */
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast-message');
        if (toast) {
            toast.textContent = message;
            toast.className = 'toast-message show ' + type;

            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    /**
     * Ініціалізація системи завантаження
     */
    function init() {
        console.log('🎯 [LoadingSystem] Запуск системи завантаження');

        // Показуємо повний екран завантаження одразу
        showFullLoadingScreen();

        // Ініціалізуємо обробники подій
        initEventHandlers();

        // Приховуємо екран завантаження через 3 секунди
        setTimeout(() => {
            hideFullLoadingScreen();

            // Активуємо першу вкладку після завантаження
            setTimeout(() => {
                const firstTab = document.querySelector('.tab-button.active');
                if (firstTab) {
                    const tabName = firstTab.getAttribute('data-tab');
                    const targetPane = document.getElementById(tabName + '-tab');
                    if (targetPane) {
                        targetPane.classList.add('fade-in-quick');
                    }
                }
            }, 100);
        }, CONFIG.pageLoadDelay);
    }

    // Експортуємо функції для зовнішнього використання
    window.LoadingSystem = {
        init: init,
        showFullScreen: showFullLoadingScreen,
        hideFullScreen: hideFullLoadingScreen,
        showTabLoader: showTabLoader,
        hideTabLoader: hideTabLoader,
        isLoading: () => state.isPageLoading || state.isTabLoading
    };

    // Автоматична ініціалізація при завантаженні DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

// Інтеграція з існуючою системою
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 [LoadingSystem] Інтеграція з системою завдань');

    // Переконуємось, що система завантаження ініціалізована
    if (!window.LoadingSystem) {
        console.error('❌ [LoadingSystem] Система завантаження не знайдена');
        return;
    }

    // Чекаємо на завершення початкового завантаження
    document.addEventListener('page-loaded', function() {
        console.log('✅ [LoadingSystem] Сторінка повністю завантажена');

        // Тут можна додати додаткову логіку після завантаження
        // Наприклад, завантаження даних для першої вкладки
    });
});