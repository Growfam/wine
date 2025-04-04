/**
 * emergency-staking.js
 * Скрипт для аварійного відновлення стейкінгу
 */

// Відразу викликаємо функцію після завантаження DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log("Emergency Staking Recovery Tool - запущено");

    // Додаємо кнопку відновлення
    addRecoveryButton();
});

// Функція для додавання кнопки відновлення стейкінгу
function addRecoveryButton() {
    // Створюємо кнопку відновлення
    const recoveryButton = document.createElement('button');
    recoveryButton.textContent = 'Відновити стейкінг';
    recoveryButton.className = 'recovery-button';
    recoveryButton.style.cssText = `
        position: fixed;
        bottom: 120px;
        right: 20px;
        background: linear-gradient(90deg, #FF5722, #E91E63);
        color: white;
        padding: 10px 15px;
        border-radius: 20px;
        border: none;
        font-weight: bold;
        z-index: 9999;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        cursor: pointer;
    `;

    // Додаємо обробник події
    recoveryButton.addEventListener('click', function() {
        showRecoveryDialog();
    });

    // Додаємо кнопку на сторінку
    document.body.appendChild(recoveryButton);
}

// Показуємо модальне вікно з опціями відновлення
function showRecoveryDialog() {
    // Створюємо модальне вікно
    const modal = document.createElement('div');
    modal.className = 'recovery-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    // Створюємо контент модального вікна
    const modalContent = document.createElement('div');
    modalContent.className = 'recovery-modal-content';
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #263238, #37474F);
        padding: 25px;
        border-radius: 15px;
        width: 80%;
        max-width: 500px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        color: white;
        text-align: center;
    `;

    // Заголовок
    const title = document.createElement('h2');
    title.textContent = 'Відновлення стейкінгу';
    title.style.marginBottom = '20px';

    // Опис
    const description = document.createElement('p');
    description.textContent = 'Виберіть тип відновлення стейкінгу:';
    description.style.marginBottom = '20px';

    // Стандартне відновлення
    const standardButton = document.createElement('button');
    standardButton.textContent = 'Стандартне відновлення';
    standardButton.style.cssText = `
        display: block;
        width: 100%;
        padding: 15px;
        margin: 10px 0;
        background: linear-gradient(90deg, #4CAF50, #2196F3);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: bold;
        cursor: pointer;
    `;

    // Глибоке відновлення
    const deepButton = document.createElement('button');
    deepButton.textContent = 'Глибоке відновлення';
    deepButton.style.cssText = `
        display: block;
        width: 100%;
        padding: 15px;
        margin: 10px 0;
        background: linear-gradient(90deg, #FF9800, #F44336);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: bold;
        cursor: pointer;
    `;

    // Кнопка скасування
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Скасувати';
    cancelButton.style.cssText = `
        display: block;
        width: 100%;
        padding: 15px;
        margin: 10px 0;
        background: rgba(255,255,255,0.1);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: bold;
        cursor: pointer;
    `;

    // Додаємо обробники подій
    standardButton.addEventListener('click', function() {
        runRecovery(false);
        modal.remove();
    });

    deepButton.addEventListener('click', function() {
        runDeepRecovery();
        modal.remove();
    });

    cancelButton.addEventListener('click', function() {
        modal.remove();
    });

    // Складаємо все разом
    modalContent.appendChild(title);
    modalContent.appendChild(description);
    modalContent.appendChild(standardButton);
    modalContent.appendChild(deepButton);
    modalContent.appendChild(cancelButton);
    modal.appendChild(modalContent);

    // Додаємо до сторінки
    document.body.appendChild(modal);
}

// Функція для стандартного відновлення стейкінгу
function runRecovery(force = false) {
    // Отримуємо ID користувача
    const userId = localStorage.getItem('telegram_user_id') ||
                  (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

    if (!userId) {
        alert('Не вдалося визначити ID користувача');
        return;
    }

    // Показуємо повідомлення про очікування
    showProgress('Відновлення стейкінгу...');

    // Відправляємо запит на відновлення
    fetch(`/api/user/${userId}/staking/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: force })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP помилка! Статус: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        hideProgress();

        if (result.status === 'success') {
            // Оновлюємо збережені дані в локальному сховищі
            localStorage.removeItem('stakingData');
            localStorage.removeItem('winix_staking');
            sessionStorage.removeItem('stakingData');
            sessionStorage.removeItem('winix_staking');

            // Оновлюємо баланс, якщо він був змінений
            if (result.data && result.data.newBalance !== undefined) {
                localStorage.setItem('userTokens', result.data.newBalance.toString());
                localStorage.setItem('winix_balance', result.data.newBalance.toString());
                sessionStorage.setItem('userTokens', result.data.newBalance.toString());
                sessionStorage.setItem('winix_balance', result.data.newBalance.toString());
            }

            // Показуємо повідомлення про успіх
            showSuccess(result.message, function() {
                // Перезавантажуємо сторінку після успішного відновлення
                window.location.reload();
            });
        } else {
            // Показуємо помилку
            showError(result.message || 'Помилка відновлення стейкінгу');
        }
    })
    .catch(error => {
        hideProgress();
        showError('Помилка виконання запиту: ' + error.message);
        console.error('Помилка відновлення стейкінгу:', error);
    });
}

// Функція для глибокого відновлення стейкінгу
function runDeepRecovery() {
    // Отримуємо ID користувача
    const userId = localStorage.getItem('telegram_user_id') ||
                  (document.getElementById('user-id') ? document.getElementById('user-id').textContent : null);

    if (!userId) {
        alert('Не вдалося визначити ID користувача');
        return;
    }

    // Запитуємо користувача про коригування балансу
    const adjustmentStr = prompt('Введіть суму для коригування балансу (додатна - додати, від\'ємна - відняти, 0 - без змін):', '0');
    const adjustment = parseFloat(adjustmentStr);

    if (isNaN(adjustment)) {
        alert('Введено некоректне значення. Спробуйте ще раз.');
        return;
    }

    // Запитуємо підтвердження
    if (!confirm(`Увага! Глибоке відновлення видалить ВСЮ історію стейкінгу і ${
        adjustment > 0 ? `додасть ${adjustment}` : 
        adjustment < 0 ? `відніме ${-adjustment}` : 
        'не змінить'
    } WINIX до вашого балансу. Продовжити?`)) {
        return;
    }

    // Показуємо повідомлення про очікування
    showProgress('Виконується глибоке відновлення...');

    // Відправляємо запит на глибоке відновлення
    fetch(`/api/user/${userId}/staking/deep-repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance_adjustment: adjustment })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP помилка! Статус: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        hideProgress();

        if (result.status === 'success') {
            // Оновлюємо збережені дані в локальному сховищі
            localStorage.removeItem('stakingData');
            localStorage.removeItem('winix_staking');
            sessionStorage.removeItem('stakingData');
            sessionStorage.removeItem('winix_staking');

            // Оновлюємо баланс
            if (result.data && result.data.new_balance !== undefined) {
                localStorage.setItem('userTokens', result.data.new_balance.toString());
                localStorage.setItem('winix_balance', result.data.new_balance.toString());
                sessionStorage.setItem('userTokens', result.data.new_balance.toString());
                sessionStorage.setItem('winix_balance', result.data.new_balance.toString());
            }

            // Показуємо повідомлення про успіх
            showSuccess(result.message, function() {
                // Перезавантажуємо сторінку після успішного відновлення
                window.location.reload();
            });
        } else {
            // Показуємо помилку
            showError(result.message || 'Помилка глибокого відновлення стейкінгу');
        }
    })
    .catch(error => {
        hideProgress();
        showError('Помилка виконання запиту: ' + error.message);
        console.error('Помилка глибокого відновлення стейкінгу:', error);
    });
}

// Допоміжні функції для відображення повідомлень

// Показати прогрес
function showProgress(message) {
    // Видаляємо попередні повідомлення
    hideProgress();

    // Створюємо елемент
    const progressElement = document.createElement('div');
    progressElement.id = 'recovery-progress';
    progressElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        color: white;
        font-size: 18px;
    `;

    // Додаємо спіннер
    const spinner = document.createElement('div');
    spinner.className = 'recovery-spinner';
    spinner.style.cssText = `
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
    `;

    // Додаємо стилі для анімації
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Додаємо повідомлення
    const messageElement = document.createElement('div');
    messageElement.textContent = message;

    // Складаємо все разом
    progressElement.appendChild(spinner);
    progressElement.appendChild(messageElement);
    document.body.appendChild(progressElement);
}

// Сховати прогрес
function hideProgress() {
    const progressElement = document.getElementById('recovery-progress');
    if (progressElement) {
        progressElement.remove();
    }
}

// Показати успіх
function showSuccess(message, callback) {
    // Створюємо елемент
    const successElement = document.createElement('div');
    successElement.id = 'recovery-success';
    successElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        color: white;
    `;

    // Створюємо контент
    const content = document.createElement('div');
    content.style.cssText = `
        background: linear-gradient(135deg, #1B5E20, #388E3C);
        padding: 25px;
        border-radius: 15px;
        max-width: 500px;
        width: 80%;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;

    // Іконка успіху
    const icon = document.createElement('div');
    icon.innerHTML = '✓';
    icon.style.cssText = `
        font-size: 50px;
        margin-bottom: 15px;
    `;

    // Повідомлення
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        font-size: 18px;
        margin-bottom: 20px;
    `;

    // Кнопка ОК
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
        padding: 12px 30px;
        background: white;
        color: #388E3C;
        border: none;
        border-radius: 20px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
    `;

    okButton.addEventListener('click', function() {
        successElement.remove();
        if (callback) callback();
    });

    // Складаємо все разом
    content.appendChild(icon);
    content.appendChild(messageElement);
    content.appendChild(okButton);
    successElement.appendChild(content);
    document.body.appendChild(successElement);
}

// Показати помилку
function showError(message) {
    // Створюємо елемент
    const errorElement = document.createElement('div');
    errorElement.id = 'recovery-error';
    errorElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        color: white;
    `;

    // Створюємо контент
    const content = document.createElement('div');
    content.style.cssText = `
        background: linear-gradient(135deg, #B71C1C, #D32F2F);
        padding: 25px;
        border-radius: 15px;
        max-width: 500px;
        width: 80%;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;

    // Іконка помилки
    const icon = document.createElement('div');
    icon.innerHTML = '✗';
    icon.style.cssText = `
        font-size: 50px;
        margin-bottom: 15px;
    `;

    // Повідомлення
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        font-size: 18px;
        margin-bottom: 20px;
    `;

    // Кнопка ОК
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
        padding: 12px 30px;
        background: white;
        color: #D32F2F;
        border: none;
        border-radius: 20px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
    `;

    okButton.addEventListener('click', function() {
        errorElement.remove();
    });

    // Складаємо все разом
    content.appendChild(icon);
    content.appendChild(messageElement);
    content.appendChild(okButton);
    errorElement.appendChild(content);
    document.body.appendChild(errorElement);
}