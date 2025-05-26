/**
 * state.js - Реактивний менеджер стану для WINIX
 * ПЕРЕВІРЕНА версія з правильними API викликами
 */

class WinixStateManager {
    constructor() {
        this.state = new Proxy({
            user: null,
            balance: 0,
            coins: 0,
            loading: false,
            connected: true,
            notifications: []
        }, {
            set: (target, property, value) => {
                const oldValue = target[property];
                target[property] = value;

                // Instant UI update
                this.updateUI(property, value, oldValue);

                // Emit change event
                this.emit('stateChange', { property, value, oldValue });

                return true;
            }
        });

        this.listeners = new Map();
        this.cache = new Map();
        this.updateQueue = [];
        this.isUpdating = false;
        this._syncTimeout = null;
    }

    // Реактивні оновлення UI
    updateUI(property, newValue, oldValue) {
        switch (property) {
            case 'balance':
                this.updateBalanceUI(newValue, oldValue);
                break;
            case 'coins':
                this.updateCoinsUI(newValue, oldValue);
                break;
            case 'loading':
                newValue ? this.showLoading() : this.hideLoading();
                break;
            case 'connected':
                this.updateConnectionStatus(newValue);
                break;
        }
    }

    // Instant balance update з анімацією
    updateBalanceUI(newBalance, oldBalance) {
        const balanceEl = document.getElementById('user-tokens');
        if (!balanceEl) return;

        // Animate change
        if (oldBalance !== undefined && newBalance !== oldBalance) {
            balanceEl.classList.add(newBalance > oldBalance ? 'increase' : 'decrease');
            setTimeout(() => {
                balanceEl.classList.remove('increase', 'decrease');
            }, 1000);
        }

        balanceEl.textContent = this.formatNumber(newBalance);

        // Зберігаємо в localStorage для персистентності
        localStorage.setItem('userTokens', newBalance.toString());
    }

    // Instant coins update з анімацією
    updateCoinsUI(newCoins, oldCoins) {
        const coinsEl = document.getElementById('user-coins');
        if (!coinsEl) return;

        // Counter animation
        if (oldCoins !== undefined && Math.abs(newCoins - oldCoins) <= 1000) {
            this.animateCounter(coinsEl, oldCoins, newCoins, 300);
        } else {
            coinsEl.textContent = newCoins;
        }

        // Зберігаємо в localStorage для персистентності
        localStorage.setItem('userCoins', newCoins.toString());
    }

    // Smooth counter animation
    animateCounter(element, from, to, duration) {
        const startTime = performance.now();
        const diff = to - from;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + diff * easeOut);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    // Batch updates для кращої продуктивності
    batchUpdate(updates) {
        this.updateQueue.push(...updates);

        if (!this.isUpdating) {
            this.isUpdating = true;
            requestAnimationFrame(() => {
                this.processBatchUpdates();
            });
        }
    }

    processBatchUpdates() {
        const updates = [...this.updateQueue];
        this.updateQueue.length = 0;
        this.isUpdating = false;

        updates.forEach(({ property, value }) => {
            this.state[property] = value;
        });
    }

    // Optimistic updates
    optimisticUpdate(property, value, revertOn = null) {
        const oldValue = this.state[property];
        this.state[property] = value;

        // Auto-revert on error if specified
        if (revertOn) {
            const cleanup = () => {
                this.state[property] = oldValue;
                this.off(revertOn, cleanup);
            };
            this.on(revertOn, cleanup);
        }
    }

    // Cache management
    setCache(key, value, ttl = 300000) { // 5 minutes default
        this.cache.set(key, {
            value,
            expires: Date.now() + ttl
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expires) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    // Utility methods
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    showLoading() {
        if (window.showLoading) {
            window.showLoading();
        }
    }

    hideLoading() {
        if (window.hideLoading) {
            window.hideLoading();
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = connected ? 'connected' : 'disconnected';
            statusEl.textContent = connected ? 'Online' : 'Offline';
        }

        // Показуємо повідомлення про статус з'єднання
        if (window.showNotification) {
            if (connected) {
                window.showNotification('З\'єднання відновлено', false);
            } else {
                window.showNotification('Втрачено з\'єднання з інтернетом', true);
            }
        }
    }

    // Public API
    get user() { return this.state.user; }
    set user(value) { this.state.user = value; }

    get balance() { return this.state.balance; }
    set balance(value) { this.state.balance = value; }

    get coins() { return this.state.coins; }
    set coins(value) { this.state.coins = value; }

    get loading() { return this.state.loading; }
    set loading(value) { this.state.loading = value; }

    get connected() { return this.state.connected; }
    set connected(value) { this.state.connected = value; }
}

// Глобальний інстанс
window.WinixState = new WinixStateManager();

// Інтеграція з API модулем
document.addEventListener('DOMContentLoaded', () => {
    // Auto-sync з API коли модуль буде доступний
    const initAPIIntegration = () => {
        if (window.WinixAPI && typeof window.WinixAPI.refreshBalance === 'function') {
            console.log('✅ WinixState: API інтеграція ініціалізована');

            // Дебаунсована синхронізація з сервером
            window.WinixState.on('stateChange', ({ property, value }) => {
                if (['balance', 'coins'].includes(property)) {
                    // Debounce sync to server
                    clearTimeout(window.WinixState._syncTimeout);
                    window.WinixState._syncTimeout = setTimeout(() => {
                        window.WinixAPI.refreshBalance().catch(error => {
                            console.warn('State sync failed:', error);
                            // Не показуємо помилку користувачу, це фоновий процес
                        });
                    }, 1000);
                }
            });
        } else {
            // Спробуємо ще раз через секунду
            setTimeout(initAPIIntegration, 1000);
        }
    };

    initAPIIntegration();
});

// Telegram WebApp integration (ПЕРЕВІРЕНО - це коректно)
if (window.Telegram?.WebApp) {
    // Ці методи існують і працюють правильно
    window.Telegram.WebApp.onEvent('themeChanged', () => {
        window.WinixState.emit('themeChanged');
    });

    window.Telegram.WebApp.onEvent('viewportChanged', () => {
        window.WinixState.emit('viewportChanged');
    });
}

// Завантажуємо кешовані дані при ініціалізації
document.addEventListener('DOMContentLoaded', () => {
    // Завантажуємо дані з localStorage
    const cachedBalance = localStorage.getItem('userTokens');
    const cachedCoins = localStorage.getItem('userCoins');

    if (cachedBalance) {
        window.WinixState.balance = parseFloat(cachedBalance) || 0;
    }

    if (cachedCoins) {
        window.WinixState.coins = parseInt(cachedCoins) || 0;
    }

    console.log('✅ WinixState: Кешовані дані завантажено');
});

// Обробка online/offline статусу
window.addEventListener('online', () => {
    window.WinixState.connected = true;
});

window.addEventListener('offline', () => {
    window.WinixState.connected = false;
});

console.log('✅ WinixState: Реактивний менеджер стану ініціалізовано');