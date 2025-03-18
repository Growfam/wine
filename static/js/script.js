document.addEventListener("DOMContentLoaded", function() {
    let button = document.getElementById("clickButton");
    let messageDiv = document.getElementById("message");

    if (button) {
        button.addEventListener("click", function() {
            messageDiv.innerHTML = "<p>Hello! You clicked the button!</p>";
        });
    } else {
        console.error("Button not found!");
    }
});document.addEventListener("DOMContentLoaded", function() {
    let button = document.getElementById("clickButton");
    let messageDiv = document.getElementById("message");

    if (button) {
        button.addEventListener("click", function() {
            messageDiv.innerHTML = "<p>Hello! You clicked the button!</p>";
        });
    } else {
        console.error("Button not found!");
    }
});

// Додайте вашу функцію confirmAction, якщо ще не додана
function confirmAction() {
    const status = document.getElementById('status');
    status.innerText = "Жетон нараховано! Переходьте до наступної сторінки.";
    document.getElementById('confirmButton').style.display = 'none';
    document.getElementById('nextButton').style.display = 'block';
}
Telegram.WebApp.ready();
Telegram.WebApp.expand();
Telegram.WebApp.MainButton.hide();

// Покращена система навігації
function setupSafeNavigation() {
    console.log("Налаштування безпечної навігації");

    // Зберігаємо баланс перед переходами
    function saveBalanceBeforeNavigation() {
        try {
            // Отримати поточний баланс
            let currentBalance = parseFloat(localStorage.getItem('userTokens') || '0');

            // Якщо доступний BalanceManager, використовуємо його баланс
            if (window.balanceManager) {
                currentBalance = window.balanceManager.getCurrentBalance();
            }

            // Зберегти в sessionStorage (для цієї сесії)
            sessionStorage.setItem('lastBalance', currentBalance.toString());
            sessionStorage.setItem('navigationTime', Date.now().toString());

            console.log(`Збережено баланс перед навігацією: ${currentBalance}`);
            return true;
        } catch (error) {
            console.error("Помилка збереження балансу перед навігацією:", error);
            return false;
        }
    }

    // Налаштовуємо обробники для всіх пунктів навігації
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (event) => {
            // Спочатку зберігаємо баланс
            saveBalanceBeforeNavigation();

            // Отримуємо секцію для переходу
            const section = item.getAttribute('data-section');
            console.log(`Перехід до секції: ${section}`);

            // Забираємо активний клас з усіх пунктів
            document.querySelectorAll('.nav-item').forEach(navItem => {
                navItem.classList.remove('active');
            });

            // Додаємо активний клас поточному пункту
            item.classList.add('active');

            // Виконуємо перехід
            switch(section) {
                case 'home':
                    window.location.href = 'index.html';
                    break;
                case 'earn':
                    window.location.href = 'earn.html';
                    break;
                case 'wallet':
                    window.location.href = 'wallet.html';
                    break;
                case 'referrals':
                    window.location.href = 'referrals.html';
                    break;
                case 'general':
                    // Можливо, ця секція недоступна
                    alert('Секція General буде доступна пізніше.');
                    break;
                default:
                    console.warn(`Невідома секція: ${section}`);
            }

            // Запобігаємо стандартній поведінці посилання, якщо потрібно
            event.preventDefault();
        });
    });

    // Налаштовуємо обробник для всіх кнопок навігації
    document.querySelectorAll('a[href], button[data-href]').forEach(element => {
        // Перевіряємо, чи це навігаційний елемент, але не .nav-item (вони вже оброблені)
        if (!element.classList.contains('nav-item') &&
            (element.hasAttribute('href') || element.hasAttribute('data-href'))) {

            element.addEventListener('click', (event) => {
                // Отримуємо URL для переходу
                const url = element.getAttribute('href') || element.getAttribute('data-href');

                // Якщо це внутрішнє посилання сайту
                if (url && !url.startsWith('http') && !url.startsWith('#')) {
                    // Зберігаємо баланс перед переходом
                    saveBalanceBeforeNavigation();
                }
            });
        }
    });
}

// Викликаємо функцію після завантаження DOM
document.addEventListener('DOMContentLoaded', function() {
    setupSafeNavigation();

    // Перевіряємо, чи потрібно відновити баланс після навігації
    function checkBalanceAfterNavigation() {
        try {
            const lastBalance = parseFloat(sessionStorage.getItem('lastBalance') || '0');
            const navigationTime = parseInt(sessionStorage.getItem('navigationTime') || '0');
            const currentTime = Date.now();

            // Перевіряємо, чи навігація відбулася нещодавно (менше 10 секунд тому)
            if (lastBalance > 0 && navigationTime > 0 && (currentTime - navigationTime) < 10000) {
                console.log(`Перевірка балансу після навігації. Збережений: ${lastBalance}`);

                // Отримуємо поточний баланс
                let currentBalance = parseFloat(localStorage.getItem('userTokens') || '0');

                // Якщо поточний баланс значно менший, відновлюємо його
                if (currentBalance < lastBalance && (lastBalance - currentBalance) > 1) {
                    console.log(`Відновлення балансу після навігації: ${currentBalance} -> ${lastBalance}`);

                    // Відновлюємо баланс
                    localStorage.setItem('userTokens', lastBalance.toString());

                    // Оновлюємо всі системи
                    if (window.balanceManager) {
                        window.balanceManager.setCurrentBalance(lastBalance);
                    } else {
                        // Резервний спосіб оновлення систем
                        if (window.walletSystem && typeof window.walletSystem.setBalance === 'function') {
                            window.walletSystem.setBalance(lastBalance);
                        }

                        if (window.rewardSystem && typeof window.rewardSystem.updateBalanceDisplay === 'function') {
                            window.rewardSystem.updateBalanceDisplay();
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Помилка перевірки балансу після навігації:", error);
        }
    }

    // Перевіряємо баланс після завантаження сторінки
    setTimeout(checkBalanceAfterNavigation, 500);
});