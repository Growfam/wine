/**
 * Допоміжний файл з виправленнями для core.js
 * Додайте цей код в кінець файлу core.js
 */

// Виправлення для функції startCountdown
// Безпечне оновлення елементів таймера з перевіркою їх наявності
WinixRaffles.startCountdown = function(raffleId, endTime) {
    // Очищаємо попередній таймер, якщо є
    if (this.state.refreshTimers[`countdown_${raffleId}`]) {
        clearInterval(this.state.refreshTimers[`countdown_${raffleId}`]);
    }

    const updateTimer = () => {
        const now = new Date().getTime();
        const timeLeft = endTime.getTime() - now;

        // Перевіряємо наявність елементів перед доступом до них
        const days = document.getElementById(`days-${raffleId}`);
        const hours = document.getElementById(`hours-${raffleId}`);
        const minutes = document.getElementById(`minutes-${raffleId}`);
        const seconds = document.getElementById(`seconds-${raffleId}`);

        // Якщо час вийшов або елементи не знайдені, зупиняємо таймер
        if (timeLeft <= 0 || !days || !hours || !minutes || !seconds) {
            clearInterval(this.state.refreshTimers[`countdown_${raffleId}`]);

            // Оновлюємо елементи таймера, якщо вони існують
            if (days) days.textContent = '00';
            if (hours) hours.textContent = '00';
            if (minutes) minutes.textContent = '00';
            if (seconds) seconds.textContent = '00';

            // Якщо час вийшов, оновлюємо список розіграшів через 2 секунди
            if (timeLeft <= 0) {
                setTimeout(() => this.loadActiveRaffles(), 2000);
            }
            return;
        }

        // Розрахунок днів, годин, хвилин, секунд
        const daysValue = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hoursValue = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesValue = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const secondsValue = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Оновлення елементів таймера
        days.textContent = daysValue.toString().padStart(2, '0');
        hours.textContent = hoursValue.toString().padStart(2, '0');
        minutes.textContent = minutesValue.toString().padStart(2, '0');
        seconds.textContent = secondsValue.toString().padStart(2, '0');
    };

    // Запускаємо перше оновлення таймера
    updateTimer();

    // Запускаємо інтервал оновлення таймера (щосекунди)
    this.state.refreshTimers[`countdown_${raffleId}`] = setInterval(updateTimer, 1000);
};

// Виправлення для функції updateParticipationButtons
// Додаємо перевірку наявності кнопок перед їх модифікацією
if (WinixRaffles.participation) {
    const originalUpdateButtons = WinixRaffles.participation.updateParticipationButtons;

    WinixRaffles.participation.updateParticipationButtons = function() {
        try {
            // Викликаємо оригінальну функцію або використовуємо безпечну версію
            if (typeof originalUpdateButtons === 'function') {
                originalUpdateButtons.call(this);
            } else {
                // Оновлюємо кнопку головного розіграшу
                document.querySelectorAll('.join-button').forEach(button => {
                    if (!button) return;

                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                    if (this.participatingRaffles && this.participatingRaffles.has(raffleId)) {
                        const ticketCount = this.userRaffleTickets ? (this.userRaffleTickets[raffleId] || 1) : 1;
                        button.textContent = `Додати ще білет (у вас: ${ticketCount})`;

                        // Змінюємо клас, але не додаємо disabled
                        button.classList.add('participating');
                        button.disabled = false;
                    }

                    if (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) {
                        button.textContent = 'Розіграш завершено';
                        button.classList.add('disabled');
                        button.disabled = true;
                    }
                });

                // Оновлюємо кнопки міні-розіграшів
                document.querySelectorAll('.mini-raffle-button').forEach(button => {
                    if (!button) return;

                    const raffleId = button.getAttribute('data-raffle-id');
                    if (!raffleId) return;

                    // Для розіграшів, у яких користувач бере участь, змінюємо текст кнопки
                    if (this.participatingRaffles && this.participatingRaffles.has(raffleId)) {
                        const ticketCount = this.userRaffleTickets ? (this.userRaffleTickets[raffleId] || 1) : 1;
                        button.textContent = `Додати ще білет (${ticketCount})`;

                        // Змінюємо клас, але не додаємо disabled
                        button.classList.add('participating');
                        button.disabled = false;
                    }

                    if (this.invalidRaffleIds && this.invalidRaffleIds.has(raffleId)) {
                        button.textContent = 'Розіграш завершено';
                        button.classList.add('disabled');
                        button.disabled = true;
                    }
                });
            }
        } catch (error) {
            console.error("Помилка при оновленні кнопок участі:", error);
        }
    };
}

// Виправлення для основних функцій запиту API
// Додаємо повторні спроби та покращену обробку помилок
if (WinixAPI) {
    // Оригінальна функція
    const originalApiRequest = WinixAPI.apiRequest;

    // Обгортка з повторними спробами
    WinixAPI.apiRequest = async function(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
        let lastError;

        // Виконуємо запит кілька разів у випадку помилки
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Затримка перед повторною спробою (крім першої)
                if (attempt > 0) {
                    const delay = Math.pow(2, attempt) * 500; // Експоненційна затримка
                    console.log(`🔄 API: Повторна спроба #${attempt} через ${delay}мс...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Виконуємо оригінальний запит
                return await originalApiRequest.call(this, endpoint, method, data, options);
            } catch (error) {
                lastError = error;

                // Якщо помилка 429 (Too Many Requests), обов'язково робимо затримку
                if (error.status === 429) {
                    const retryAfter = error.headers?.get('Retry-After') || 10;
                    const delay = parseInt(retryAfter) * 1000;
                    console.warn(`🔄 API: Отримано 429 (Too Many Requests), чекаємо ${delay/1000}с...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Якщо це остання спроба, передаємо помилку далі
                if (attempt === retries - 1) {
                    if (options.suppressErrors) {
                        return {
                            status: 'error',
                            message: error.message || 'Помилка запиту після декількох спроб',
                            source: 'api_error_retry'
                        };
                    }
                    throw error;
                }
            }
        }

        // Цей код не повинен виконуватися, але для підстраховки
        throw lastError;
    };
}

// Виправлення для функцій оновлення DOM
// Додаємо безпечні обгортки для виклику функцій оновлення
WinixRaffles.safeUpdateDOM = function(elementId, updateFn) {
    try {
        const element = document.getElementById(elementId);
        if (element) {
            updateFn(element);
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`Помилка оновлення елемента ${elementId}:`, error);
        return false;
    }
};

// Безпечне оновлення значення елемента
WinixRaffles.safeUpdateValue = function(elementId, value) {
    return this.safeUpdateDOM(elementId, element => {
        element.textContent = value;
    });
};

// Виправлення для функції оновлення балансу
WinixRaffles.updateUserBalance = function(userData) {
    if (!userData) return;

    // Оновлюємо відображення жетонів
    if (userData.coins !== undefined) {
        this.safeUpdateDOM('user-coins', element => {
            element.textContent = userData.coins;
        });
    }

    // Оновлюємо відображення балансу
    if (userData.balance !== undefined) {
        this.safeUpdateDOM('user-tokens', element => {
            element.textContent = userData.balance;
        });
    }
};

// Виправлення для відстеження помилок
window.addEventListener('error', function(event) {
    console.error('Глобальна помилка JavaScript:', event.error);

    // Спробуємо відновити стан після помилки
    if (WinixRaffles) {
        if (WinixRaffles.state && WinixRaffles.state.isLoading) {
            WinixRaffles.state.isLoading = false;
        }

        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    }
});

// Забезпечення наявності функцій відображення повідомлень і індикатора завантаження
if (typeof window.showToast !== 'function') {
    window.showToast = function(message, type = 'info') {
        const toast = document.getElementById('toast-message');
        if (!toast) {
            console.log(`[${type}] ${message}`);
            return;
        }

        toast.textContent = message;
        toast.className = 'toast-message';

        if (type === 'success') {
            toast.classList.add('success');
        } else if (type === 'error') {
            toast.classList.add('error');
        }

        toast.classList.add('show');

        // Автоматично приховуємо повідомлення через 5 секунд
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);

        // Додаємо обробник кліку для закриття
        toast.addEventListener('click', () => {
            toast.classList.remove('show');
        });
    };
}

if (typeof window.showLoading !== 'function') {
    window.showLoading = function() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.style.display = 'flex';
        }
    };
}

if (typeof window.hideLoading !== 'function') {
    window.hideLoading = function() {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
    };
}