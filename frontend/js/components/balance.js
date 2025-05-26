/**
 * balance.js - Реактивний компонент балансу для WINIX
 * Демонструє instant UI updates з оптимістичними оновленнями
 */

class BalanceComponent {
    constructor(containerId = 'balance-container') {
        this.container = document.getElementById(containerId);
        this.isVisible = false;
        this.animationFrame = null;
        this.updateQueue = [];

        // Binding methods
        this.handleStateChange = this.handleStateChange.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        this.init();
    }

    init() {
        this.createHTML();
        this.attachEventListeners();
        this.setupIntersectionObserver();

        // Connect to state manager
        if (window.WinixState) {
            window.WinixState.on('stateChange', this.handleStateChange);

            // Initial render
            this.render({
                balance: window.WinixState.balance,
                coins: window.WinixState.coins,
                loading: window.WinixState.loading
            });
        }

        console.log('✅ BalanceComponent: Ініціалізовано');
    }

    createHTML() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="balance-card">
                <!-- Header -->
                <div class="balance-header">
                    <div class="balance-title">Ваш баланс</div>
                    <button class="refresh-btn" id="refresh-balance">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18C8.69 18 6 15.31 6 12H4C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4Z" fill="currentColor"/>
                        </svg>
                    </button>
                </div>

                <!-- Main Balance -->
                <div class="balance-main">
                    <div class="balance-amount">
                        <span class="balance-value" id="balance-value">0</span>
                        <span class="balance-currency">WINIX</span>
                    </div>
                    <div class="balance-change" id="balance-change"></div>
                </div>

                <!-- Coins -->
                <div class="coins-section">
                    <div class="coins-label">Жетони</div>
                    <div class="coins-amount">
                        <span class="coins-value" id="coins-value">0</span>
                        <div class="coins-icon">🪙</div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="balance-actions">
                    <button class="action-btn primary" id="add-coins-btn">
                        <span>Додати жетони</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <button class="action-btn secondary" id="staking-btn">
                        <span>Стейкінг</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M13 10V3L4 14H11V21L20 10H13Z" fill="currentColor"/>
                        </svg>
                    </button>
                </div>

                <!-- Connection Status -->
                <div class="connection-status" id="connection-status">
                    <div class="status-dot"></div>
                    <span class="status-text">Online</span>
                </div>
            </div>

            <!-- Loading Overlay -->
            <div class="balance-loading" id="balance-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">Оновлення...</div>
            </div>
        `;

        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('balance-component-styles')) return;

        const style = document.createElement('style');
        style.id = 'balance-component-styles';
        style.textContent = `
            .balance-card {
                background: linear-gradient(135deg, rgba(30, 39, 70, 0.95) 0%, rgba(46, 181, 247, 0.1) 100%);
                backdrop-filter: blur(20px);
                border-radius: 24px;
                padding: 24px;
                border: 1px solid rgba(78, 181, 247, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                position: relative;
                overflow: hidden;
                transition: all 0.3s ease;
            }

            .balance-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                transition: left 0.5s ease;
            }

            .balance-card:hover::before {
                left: 100%;
            }

            .balance-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .balance-title {
                font-size: 18px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.9);
            }

            .refresh-btn {
                background: rgba(78, 181, 247, 0.2);
                border: none;
                border-radius: 12px;
                width: 40px;
                height: 40px;
                color: #4eb5f7;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .refresh-btn:hover {
                background: rgba(78, 181, 247, 0.3);
                transform: rotate(180deg);
            }

            .refresh-btn:active {
                transform: rotate(180deg) scale(0.95);
            }

            .balance-main {
                text-align: center;
                margin-bottom: 24px;
            }

            .balance-amount {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .balance-value {
                font-size: 48px;
                font-weight: 700;
                background: linear-gradient(135deg, #4eb5f7, #00c9a7);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                transition: all 0.5s ease;
                position: relative;
            }

            .balance-value.increase {
                animation: bounce-up 0.6s ease;
                filter: drop-shadow(0 0 20px rgba(0, 201, 167, 0.5));
            }

            .balance-value.decrease {
                animation: shake 0.6s ease;
                filter: drop-shadow(0 0 20px rgba(244, 67, 54, 0.5));
            }

            @keyframes bounce-up {
                0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
                40%, 43% { transform: translateY(-8px); }
                70% { transform: translateY(-4px); }
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                20%, 40%, 60%, 80% { transform: translateX(2px); }
            }

            .balance-currency {
                font-size: 20px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.7);
            }

            .balance-change {
                font-size: 14px;
                font-weight: 500;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
            }

            .balance-change.show {
                opacity: 1;
                transform: translateY(0);
            }

            .balance-change.positive {
                color: #00c9a7;
            }

            .balance-change.negative {
                color: #f44336;
            }

            .coins-section {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 24px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .coins-label {
                font-size: 16px;
                color: rgba(255, 255, 255, 0.8);
            }

            .coins-amount {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .coins-value {
                font-size: 24px;
                font-weight: 700;
                color: #ffd700;
                text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
            }

            .coins-icon {
                font-size: 20px;
                animation: coin-spin 3s ease-in-out infinite;
            }

            @keyframes coin-spin {
                0%, 100% { transform: rotateY(0deg); }
                50% { transform: rotateY(180deg); }
            }

            .balance-actions {
                display: flex;
                gap: 12px;
                margin-bottom: 16px;
            }

            .action-btn {
                flex: 1;
                padding: 14px 20px;
                border: none;
                border-radius: 16px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                position: relative;
                overflow: hidden;
            }

            .action-btn::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: width 0.3s ease, height 0.3s ease;
            }

            .action-btn:active::after {
                width: 300px;
                height: 300px;
            }

            .action-btn.primary {
                background: linear-gradient(135deg, #4eb5f7, #00c9a7);
                color: white;
            }

            .action-btn.primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(78, 181, 247, 0.4);
            }

            .action-btn.secondary {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .action-btn.secondary:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
            }

            .connection-status {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                justify-content: center;
            }

            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #00c9a7;
                animation: pulse 2s ease-in-out infinite;
            }

            .connection-status.disconnected .status-dot {
                background: #f44336;
                animation: blink 1s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }

            .balance-loading {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(30, 39, 70, 0.9);
                border-radius: 24px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }

            .balance-loading.show {
                opacity: 1;
                visibility: visible;
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(78, 181, 247, 0.3);
                border-top: 3px solid #4eb5f7;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .loading-text {
                color: rgba(255, 255, 255, 0.8);
                font-size: 14px;
            }
        `;

        document.head.appendChild(style);
    }

    attachEventListeners() {
        const refreshBtn = document.getElementById('refresh-balance');
        const addCoinsBtn = document.getElementById('add-coins-btn');
        const stakingBtn = document.getElementById('staking-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshBalance());
        }

        if (addCoinsBtn) {
            addCoinsBtn.addEventListener('click', () => this.showAddCoinsDialog());
        }

        if (stakingBtn) {
            stakingBtn.addEventListener('click', () => this.openStaking());
        }

        // Haptic feedback for Telegram
        this.container?.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
            }
        });
    }

    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    this.isVisible = entry.isIntersecting;

                    if (this.isVisible && this.updateQueue.length > 0) {
                        this.processUpdateQueue();
                    }
                });
            });

            if (this.container) {
                observer.observe(this.container);
            }
        } else {
            this.isVisible = true;
        }
    }

    handleStateChange({ property, value, oldValue }) {
        if (['balance', 'coins', 'loading', 'connected'].includes(property)) {
            const update = { property, value, oldValue };

            if (this.isVisible) {
                this.processUpdate(update);
            } else {
                this.updateQueue.push(update);
            }
        }
    }

    handleVisibilityChange() {
        if (this.isVisible && this.updateQueue.length > 0) {
            this.processUpdateQueue();
        }
    }

    processUpdateQueue() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = requestAnimationFrame(() => {
            this.updateQueue.forEach(update => this.processUpdate(update));
            this.updateQueue.length = 0;
        });
    }

    processUpdate({ property, value, oldValue }) {
        switch (property) {
            case 'balance':
                this.updateBalance(value, oldValue);
                break;
            case 'coins':
                this.updateCoins(value, oldValue);
                break;
            case 'loading':
                this.updateLoading(value);
                break;
            case 'connected':
                this.updateConnectionStatus(value);
                break;
        }
    }

    updateBalance(newBalance, oldBalance) {
        const balanceEl = document.getElementById('balance-value');
        const changeEl = document.getElementById('balance-change');

        if (!balanceEl) return;

        // Animate counter
        this.animateValue(balanceEl, oldBalance || 0, newBalance);

        // Show change indicator
        if (oldBalance !== undefined && changeEl && oldBalance !== newBalance) {
            const diff = newBalance - oldBalance;
            const isPositive = diff > 0;

            changeEl.textContent = `${isPositive ? '+' : ''}${diff.toFixed(2)}`;
            changeEl.className = `balance-change show ${isPositive ? 'positive' : 'negative'}`;

            // Add animation class to balance
            balanceEl.classList.add(isPositive ? 'increase' : 'decrease');

            // Remove classes after animation
            setTimeout(() => {
                balanceEl.classList.remove('increase', 'decrease');
                changeEl.classList.remove('show');
            }, 3000);
        }
    }

    updateCoins(newCoins, oldCoins) {
        const coinsEl = document.getElementById('coins-value');
        if (!coinsEl) return;

        this.animateValue(coinsEl, oldCoins || 0, newCoins);
    }

    updateLoading(loading) {
        const loadingEl = document.getElementById('balance-loading');
        if (!loadingEl) return;

        if (loading) {
            loadingEl.classList.add('show');
        } else {
            loadingEl.classList.remove('show');
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        const textEl = statusEl?.querySelector('.status-text');

        if (!statusEl || !textEl) return;

        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        textEl.textContent = connected ? 'Online' : 'Offline';
    }

    animateValue(element, from, to, duration = 800) {
        const startTime = performance.now();
        const difference = to - from;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = from + (difference * easedProgress);

            element.textContent = Math.round(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    async refreshBalance() {
        if (!window.WinixAPI || !window.WinixState) return;

        try {
            window.WinixState.loading = true;

            const result = await window.WinixAPI.getBalance();

            if (result.status === 'success') {
                window.showNotification?.('Баланс оновлено', false);
            }
        } catch (error) {
            console.error('Error refreshing balance:', error);
            window.showNotification?.('Помилка оновлення балансу', true);
        } finally {
            window.WinixState.loading = false;
        }
    }

    showAddCoinsDialog() {
        const amounts = [10, 25, 50, 100];
        const message = `Оберіть кількість жетонів для додавання:\n${amounts.map(a => `• ${a} жетонів`).join('\n')}`;

        // Simple implementation - in real app would be a proper dialog
        const amount = prompt(message, '10');

        if (amount && !isNaN(amount)) {
            this.addCoins(parseInt(amount));
        }
    }

    async addCoins(amount) {
        if (!window.WinixAPI || !window.WinixState) return;

        try {
            // Optimistic update
            const currentCoins = window.WinixState.coins;
            window.WinixState.coins = currentCoins + amount;

            // API call
            await window.WinixAPI.updateBalance(amount, 'add');

            window.showNotification?.(`Додано ${amount} жетонів`, false);
        } catch (error) {
            // Revert optimistic update
            window.WinixState.coins = window.WinixState.coins - amount;
            window.showNotification?.('Помилка додавання жетонів', true);
        }
    }

    openStaking() {
        // Navigate to staking page or open staking modal
        if (window.location.pathname.includes('staking')) return;

        window.location.href = 'staking.html';
    }

    render(state) {
        if (!this.isVisible) return;

        this.processUpdate({ property: 'balance', value: state.balance, oldValue: 0 });
        this.processUpdate({ property: 'coins', value: state.coins, oldValue: 0 });
        this.processUpdate({ property: 'loading', value: state.loading });
        this.processUpdate({ property: 'connected', value: state.connected });
    }

    destroy() {
        if (window.WinixState) {
            window.WinixState.off('stateChange', this.handleStateChange);
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        console.log('🗑️ BalanceComponent: Знищено');
    }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('balance-container');
    if (container) {
        window.BalanceComponent = new BalanceComponent();
    }
});

// Export for manual initialization
window.BalanceComponent = BalanceComponent;

console.log('✅ BalanceComponent: Готовий до ініціалізації');