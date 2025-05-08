/**
 * WINIX - Модуль налаштувань користувача
 * Виправлена версія з розумним використанням кешу та запобіганням помилкам частоти запитів
 */

// Оголошуємо глобальний об'єкт для налаштувань
window.WinixSettings = (function () {
  // Приватні змінні
  let _isInitialized = false;
  let _userData = null;
  let _lastUserDataRequestTime = 0;
  const MIN_REQUEST_INTERVAL = 5000; // Мінімальний інтервал між запитами (5 секунд)

  // Прапорець, що вказує на процес завантаження даних
  let _loadingUserData = false;

  /**
   * Показує повідомлення користувачу
   * @param {string} message - Текст повідомлення
   * @param {boolean} isError - Чи це повідомлення про помилку
   */
  function showToast(message, isError = false) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;

    // Очищаємо попередні класи
    toast.className = 'toast-message';
    if (isError) {
      toast.classList.add('error');
    } else {
      toast.classList.add('success');
    }

    toast.textContent = message;
    toast.classList.add('show');

    // Ховаємо повідомлення через 3 секунди
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  /**
   * Створює функцію для генерації SID фрази на основі ID користувача
   * Це проста імітація для демонстраційних цілей
   * @param {string} userId - ID користувача
   * @returns {Array} - Масив слів SID фрази
   */
  function generateSeedPhrase(userId) {
    // Список слів для демонстрації
    const wordList = [
      'apple',
      'banana',
      'carrot',
      'diamond',
      'elephant',
      'flower',
      'guitar',
      'hammer',
      'island',
      'jungle',
      'kitchen',
      'lion',
      'mountain',
      'notebook',
      'orange',
      'pencil',
      'queen',
      'river',
      'sunset',
      'tiger',
      'umbrella',
      'violin',
      'window',
      'xylophone',
    ];

    // Генеруємо псевдо-випадкові слова на основі userId
    let seed = parseInt(userId) || 12345678;
    let result = [];

    for (let i = 0; i < 12; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const index = Math.floor((seed / 233280.0) * wordList.length);
      result.push(wordList[index]);
    }

    return result;
  }

  /**
   * Завантажує дані користувача з сервера або localStorage
   * з розумним управлінням частотою запитів і кешуванням
   */
  function loadUserData() {
    console.log('📋 Завантаження даних користувача...');

    // Перевіряємо, чи вже процес завантаження
    if (_loadingUserData) {
      console.log('⏳ Завантаження даних вже виконується, чекаємо...');
      return;
    }

    // Показуємо індикатор завантаження
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'flex';

    // Встановлюємо прапорець завантаження
    _loadingUserData = true;

    try {
      // Перевіряємо час останнього запиту
      const now = Date.now();
      const timeSinceLastRequest = now - _lastUserDataRequestTime;

      // Якщо запит було зроблено недавно, використовуємо кешовані дані
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && _userData) {
        console.log('🔄 Використання кешованих даних (запит занадто частий)');
        updateUIWithUserData(_userData);
        if (spinner) spinner.style.display = 'none';
        _loadingUserData = false;

        // Запускаємо відкладене оновлення даних через залишок інтервалу
        setTimeout(
          () => {
            fetchUserData(false);
          },
          MIN_REQUEST_INTERVAL - timeSinceLastRequest + 100
        );

        return;
      }

      // Запам'ятовуємо час запиту
      _lastUserDataRequestTime = now;

      // Якщо window.WinixAPI доступний, використовуємо його для отримання даних
      fetchUserData(true);
    } catch (error) {
      console.error('❌ Помилка завантаження даних користувача:', error);
      showToast('Помилка завантаження даних', true);
      if (spinner) spinner.style.display = 'none';
      _loadingUserData = false;
    }
  }

  /**
   * Виконує запит даних користувача через API або використовує localStorage
   * @param {boolean} showSpinner - чи показувати індикатор завантаження
   */
  function fetchUserData(showSpinner = true) {
    // Показуємо індикатор завантаження, якщо потрібно
    const spinner = document.getElementById('loading-spinner');
    if (showSpinner && spinner) spinner.style.display = 'flex';

    // Використовуємо WinixAPI для отримання реальних даних
    if (window.WinixAPI && typeof window.WinixAPI.getUserData === 'function') {
      // Important! - використовуємо false для forceRefresh, щоб дозволити API
      // вирішувати чи використовувати кеш на основі власної логіки
      window.WinixAPI.getUserData(false)
        .then((result) => {
          if (result && result.data) {
            // Зберігаємо отримані дані
            _userData = result.data;

            // Оновлюємо інтерфейс
            updateUIWithUserData(_userData);

            console.log('✅ Дані користувача успішно завантажено');
          } else {
            console.warn('⚠️ Отримано пусті дані, використовуємо дані з localStorage');
            loadUserDataFromStorage();
          }
        })
        .catch((error) => {
          // Перевіряємо, чи помилка пов'язана з обмеженням частоти запитів
          if (error.message && error.message.includes('Занадто частий запит')) {
            console.warn('⚠️ Запит обмежено через частоту, використовуємо кешовані дані');

            // Якщо є кешовані дані, використовуємо їх
            if (_userData) {
              updateUIWithUserData(_userData);
            } else {
              // Інакше завантажуємо з localStorage
              loadUserDataFromStorage();
            }
          } else {
            console.error('❌ Помилка завантаження даних користувача:', error);
            // При інших помилках використовуємо дані з localStorage
            loadUserDataFromStorage();
          }
        })
        .finally(() => {
          if (spinner) spinner.style.display = 'none';
          _loadingUserData = false;
        });
    } else {
      // Якщо API недоступний, використовуємо дані з localStorage
      loadUserDataFromStorage();
      if (spinner) spinner.style.display = 'none';
      _loadingUserData = false;
    }
  }

  /**
   * Завантажує дані користувача з localStorage
   */
  function loadUserDataFromStorage() {
    try {
      const userId =
        localStorage.getItem('telegram_user_id') || localStorage.getItem('userId') || '';
      const username = localStorage.getItem('username') || 'WINIX User';
      const tokens = parseFloat(
        localStorage.getItem('userTokens') || localStorage.getItem('winix_balance') || '0'
      );
      const coins = parseFloat(
        localStorage.getItem('userCoins') || localStorage.getItem('winix_coins') || '0'
      );
      const notificationsEnabled = localStorage.getItem('notifications_enabled') === 'true';

      // Створюємо об'єкт даних
      const userData = {
        telegram_id: userId,
        username: username,
        balance: tokens,
        coins: coins,
        notifications_enabled: notificationsEnabled,
      };

      // Зберігаємо дані
      _userData = userData;

      // Оновлюємо інтерфейс
      updateUIWithUserData(userData);

      console.log('📋 Дані користувача успішно завантажено з localStorage');
    } catch (error) {
      console.error('❌ Помилка завантаження даних з localStorage:', error);
    }
  }

  /**
   * Оновлює інтерфейс користувача на основі даних
   * @param {object} userData - Дані користувача
   */
  function updateUIWithUserData(userData) {
    // Оновлюємо елементи інтерфейсу
    document.getElementById('user-id').textContent = userData.telegram_id || '';
    document.getElementById('user-id-profile').textContent = userData.telegram_id || '';
    document.getElementById('profile-name').textContent = userData.username || 'WINIX User';
    document.getElementById('user-tokens').textContent = userData.balance
      ? userData.balance.toFixed(2)
      : '0.00';
    document.getElementById('user-coins').textContent = userData.coins
      ? userData.coins.toFixed(0)
      : '0';

    // Встановлюємо стан перемикача сповіщень
    const notificationsToggle = document.getElementById('notifications-toggle');
    if (notificationsToggle && userData.notifications_enabled !== undefined) {
      notificationsToggle.checked = userData.notifications_enabled;
    }

    // Завантажуємо аватар
    loadUserAvatar(userData.username);
  }

  /**
   * Завантажує аватар користувача
   * @param {string} username - Ім'я користувача (опціонально)
   */
  function loadUserAvatar(username) {
    const headerAvatar = document.getElementById('profile-avatar');
    const profileAvatar = document.getElementById('profile-avatar-large');

    const userName = username || localStorage.getItem('username') || 'WINIX User';
    const avatarSrc = localStorage.getItem('userAvatarSrc');
    const avatarId = localStorage.getItem('selectedAvatarId');

    function setAvatar(element) {
      if (!element) return;
      element.innerHTML = '';

      if (avatarSrc) {
        const img = new Image();
        img.src = avatarSrc;
        img.alt = userName;
        img.onerror = () => {
          console.log('Помилка завантаження аватара, використовуємо текст');
          element.textContent = userName[0].toUpperCase();
        };
        element.appendChild(img);
      } else if (avatarId) {
        const src = localStorage.getItem(`${avatarId}Src`) || `assets/avatar${avatarId}.png`;
        const img = new Image();
        img.src = src;
        img.alt = userName;
        img.onerror = () => {
          console.log('Помилка завантаження аватара, використовуємо запасний варіант');
          element.textContent = userName[0].toUpperCase();
        };
        element.appendChild(img);
      } else {
        element.textContent = userName[0].toUpperCase();
      }
    }

    setAvatar(headerAvatar);
    setAvatar(profileAvatar);
  }

  /**
   * Функція для хешування пароля (проста імітація)
   * @param {string} password - Пароль для хешування
   * @returns {string} - Хеш пароля
   */
  function hashPassword(password) {
    let hash = 0;
    if (password.length === 0) return hash.toString();
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString() + 'winix';
  }

  /**
   * Валідація пароля
   * @param {string} password - Пароль для перевірки
   * @returns {Object} - Результат перевірки {valid: boolean, message: string}
   */
  function validatePassword(password) {
    if (!password || password.length < 8)
      return { valid: false, message: 'Пароль має містити не менше 8 символів' };

    if ((password.match(/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/g) || []).length < 5)
      return { valid: false, message: 'Пароль має містити не менше 5 літер' };

    return { valid: true };
  }

  /**
   * Зберігає налаштування користувача
   * @param {Object} settings - Об'єкт з налаштуваннями для збереження
   */
  function saveUserSettings(settings) {
    console.log('Збереження налаштувань користувача:', settings);

    // Показуємо індикатор завантаження
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'flex';

    try {
      // Для мінімізації навантаження API, спочатку зберігаємо локально
      localSettingsSave(settings);

      // Потім намагаємося зберегти через API
      if (window.WinixAPI && typeof window.WinixAPI.updateSettings === 'function') {
        window.WinixAPI.updateSettings(settings)
          .then((result) => {
            console.log('✅ Налаштування успішно збережено через API:', result);
            showToast('Налаштування успішно збережено');
          })
          .catch((error) => {
            console.warn('⚠️ Не вдалося зберегти налаштування через API:', error);
            // Налаштування вже збережені локально
            showToast('Налаштування збережено локально');
          })
          .finally(() => {
            if (spinner) spinner.style.display = 'none';
          });
      } else {
        // API недоступний, але локальне збереження вже виконано
        showToast('Налаштування успішно збережено локально');
        if (spinner) spinner.style.display = 'none';
      }
    } catch (error) {
      console.error('❌ Помилка збереження налаштувань:', error);
      showToast('Помилка збереження налаштувань', true);
      if (spinner) spinner.style.display = 'none';
    }
  }

  /**
   * Локальне збереження налаштувань
   * @param {Object} settings - Налаштування для збереження
   */
  function localSettingsSave(settings) {
    if (settings.username) {
      localStorage.setItem('username', settings.username);
      document.getElementById('profile-name').textContent = settings.username;

      // Оновлюємо локальні дані
      if (_userData) _userData.username = settings.username;
    }

    if (settings.language) {
      localStorage.setItem('userLanguage', settings.language);

      // Оновлюємо активну мову в інтерфейсі
      document.querySelectorAll('.language-option').forEach((opt) => {
        opt.classList.toggle('active', opt.getAttribute('data-lang') === settings.language);
      });

      // Оновлюємо тексти на сторінці
      updatePageTexts();
    }

    if (settings.notifications_enabled !== undefined) {
      localStorage.setItem('notifications_enabled', settings.notifications_enabled.toString());
      document.getElementById('notifications-toggle').checked = settings.notifications_enabled;

      // Оновлюємо локальні дані
      if (_userData) _userData.notifications_enabled = settings.notifications_enabled;
    }

    if (settings.avatar_id) {
      localStorage.setItem('selectedAvatarId', settings.avatar_id);
      localStorage.removeItem('userAvatarSrc');
      loadUserAvatar();
    }
  }

  /**
   * Оновлює пароль користувача
   * @param {string} password - Новий пароль
   * @param {string|null} currentPassword - Поточний пароль (якщо є)
   */
  function updateUserPassword(password, currentPassword = null) {
    console.log('Оновлення паролю користувача');

    // Перевіряємо валідність пароля
    const validation = validatePassword(password);
    if (!validation.valid) {
      showToast(validation.message, true);
      return;
    }

    // Показуємо індикатор завантаження
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'flex';

    try {
      // У реальному додатку тут був би запит до API
      // Симулюємо оновлення пароля

      if (currentPassword) {
        const currentPasswordHash = hashPassword(currentPassword);
        const savedPasswordHash = localStorage.getItem('passwordHash');
        const savedSeedHash = localStorage.getItem('seedPhrasePasswordHash');

        // Перевіряємо, чи правильний поточний пароль
        if (
          savedPasswordHash &&
          currentPasswordHash !== savedPasswordHash &&
          savedSeedHash &&
          currentPasswordHash !== savedSeedHash
        ) {
          showToast('Невірний поточний пароль', true);
          if (spinner) spinner.style.display = 'none';
          return;
        }
      }

      // Створюємо хеш нового пароля
      const passwordHash = hashPassword(password);

      // Зберігаємо хеш пароля в localStorage
      localStorage.setItem('passwordHash', passwordHash);
      localStorage.setItem('seedPhrasePasswordHash', passwordHash);

      // Показуємо повідомлення про успішне оновлення
      showToast('Пароль успішно оновлено');

      console.log('✅ Пароль успішно оновлено');
    } catch (error) {
      console.error('❌ Помилка оновлення пароля:', error);
      showToast('Помилка оновлення пароля', true);
    } finally {
      // Ховаємо індикатор завантаження
      if (spinner) spinner.style.display = 'none';
    }
  }

  /**
   * Показує модальне вікно редагування профілю
   */
  function showEditProfileModal() {
    const currentUsername =
      (_userData && _userData.username) || localStorage.getItem('username') || 'WINIX User';
    const savedPasswordHash = localStorage.getItem('passwordHash');
    const savedSeedHash = localStorage.getItem('seedPhrasePasswordHash');
    const hasPassword = savedPasswordHash || savedSeedHash;

    const passwordFieldLabel = hasPassword ? 'Поточний пароль' : 'Встановити пароль';
    const passwordFieldPlaceholder = hasPassword
      ? 'Введіть поточний пароль для зміни'
      : 'Пароль для захисту акаунту';

    // Видаляємо попередні модальні вікна
    document.querySelectorAll('.document-modal').forEach((modal) => modal.remove());

    // Створюємо нове модальне вікно
    const modal = document.createElement('div');
    modal.className = 'document-modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">Редагування профілю</div>
                <span class="close-modal">×</span>
            </div>
            <div class="modal-scrollable-content">
                <div class="settings-item">
                    <label>Ім'я користувача</label>
                    <input type="text" id="edit-username" value="${currentUsername}">
                </div>
                <div class="settings-item">
                    <label>${passwordFieldLabel}</label>
                    <input type="password" id="edit-current-password" placeholder="${passwordFieldPlaceholder}">
                </div>
                <div class="settings-item">
                    <label>Новий пароль</label>
                    <input type="password" id="edit-password" placeholder="Залиште порожнім, щоб не змінювати">
                </div>
                <div class="settings-item">
                    <label>Підтвердження паролю</label>
                    <input type="password" id="edit-password-confirm" placeholder="Повторіть новий пароль">
                </div>
                <div class="settings-item">
                    <label>Завантажити аватар</label>
                    <div class="custom-file-upload">
                        <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
                        <button class="modal-button upload-button" id="custom-file-button">Обрати файл</button>
                        <span id="file-name-display">Файл не вибрано</span>
                    </div>
                </div>
                <div class="settings-item">
                    <label>Обрати аватар</label>
                    <div class="avatar-options">
                        <img src="assets/avatar1.png" class="avatar-option" data-id="1" onerror="this.src='https://via.placeholder.com/50?text=1'">
                        <img src="assets/avatar2.png" class="avatar-option" data-id="2" onerror="this.src='https://via.placeholder.com/50?text=2'">
                        <img src="assets/avatar3.png" class="avatar-option" data-id="3" onerror="this.src='https://via.placeholder.com/50?text=3'">
                        <img src="assets/avatar4.png" class="avatar-option" data-id="4" onerror="this.src='https://via.placeholder.com/50?text=4'">
                        <img src="assets/avatar5.png" class="avatar-option" data-id="5" onerror="this.src='https://via.placeholder.com/50?text=5'">
                        <img src="assets/avatar6.png" class="avatar-option" data-id="6" onerror="this.src='https://via.placeholder.com/50?text=6'">
                        <img src="assets/avatar7.png" class="avatar-option" data-id="7" onerror="this.src='https://via.placeholder.com/50?text=7'">
                        <img src="assets/avatar8.png" class="avatar-option" data-id="8" onerror="this.src='https://via.placeholder.com/50?text=8'">
                        <img src="assets/avatar9.png" class="avatar-option" data-id="9" onerror="this.src='https://via.placeholder.com/50?text=9'">
                        <img src="assets/avatar10.png" class="avatar-option" data-id="10" onerror="this.src='https://via.placeholder.com/50?text=10'">
                        <img src="assets/avatar11.png" class="avatar-option" data-id="11" onerror="this.src='https://via.placeholder.com/50?text=11'">
                        <img src="assets/avatar12.png" class="avatar-option" data-id="12" onerror="this.src='https://via.placeholder.com/50?text=12'">
                        <img src="assets/avatar13.png" class="avatar-option" data-id="13" onerror="this.src='https://via.placeholder.com/50?text=13'">
                    </div>
                </div>
                <div id="error-msg"></div>
            </div>
            <div class="modal-footer">
                <button class="modal-button" id="save-profile">Зберегти</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Позначаємо активний аватар
    const avatarOptions = modal.querySelectorAll('.avatar-option');
    const selectedAvatarId = localStorage.getItem('selectedAvatarId');
    avatarOptions.forEach((opt) => {
      if (opt.dataset.id === selectedAvatarId) opt.classList.add('selected');
      opt.onclick = () => {
        avatarOptions.forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
      };
    });

    // Налаштовуємо кастомну кнопку завантаження файлу
    const fileInput = modal.querySelector('#avatar-upload');
    const customButton = modal.querySelector('#custom-file-button');
    const fileNameDisplay = modal.querySelector('#file-name-display');

    customButton.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
      } else {
        fileNameDisplay.textContent = 'Файл не вибрано';
      }
    });

    // Додаємо обробник для кнопки збереження
    const saveBtn = modal.querySelector('#save-profile');
    saveBtn.onclick = () => {
      const username = modal.querySelector('#edit-username').value.trim();
      const password = modal.querySelector('#edit-password').value;
      const confirm = modal.querySelector('#edit-password-confirm').value;
      const currentPassword = modal.querySelector('#edit-current-password').value;
      const uploadedAvatar = modal.querySelector('#avatar-upload').files[0];
      const selectedAvatar = modal.querySelector('.avatar-option.selected');
      const error = modal.querySelector('#error-msg');

      error.textContent = '';

      // Перевірка імені користувача
      if (!username) {
        error.textContent = "Введіть ім'я користувача";
        modal.querySelector('#edit-username').classList.add('error');
        return;
      }

      // Перевірка паролів
      if (password) {
        if (hasPassword) {
          if (!currentPassword) {
            error.textContent = 'Введіть поточний пароль для зміни';
            modal.querySelector('#edit-current-password').classList.add('error');
            return;
          }

          const currentPasswordHash = hashPassword(currentPassword);
          if (
            savedPasswordHash &&
            currentPasswordHash !== savedPasswordHash &&
            savedSeedHash &&
            currentPasswordHash !== savedSeedHash
          ) {
            error.textContent = 'Неправильний поточний пароль';
            modal.querySelector('#edit-current-password').classList.add('error');
            return;
          }
        }

        if (password !== confirm) {
          error.textContent = 'Паролі не співпадають';
          modal.querySelector('#edit-password-confirm').classList.add('error');
          return;
        }

        const validation = validatePassword(password);
        if (!validation.valid) {
          error.textContent = validation.message;
          modal.querySelector('#edit-password').classList.add('error');
          return;
        }
      } else if (currentPassword && !hasPassword) {
        const validation = validatePassword(currentPassword);
        if (!validation.valid) {
          error.textContent = validation.message;
          modal.querySelector('#edit-current-password').classList.add('error');
          return;
        }
      }

      // Збереження даних
      const settings = {
        username: username,
      };

      // Зберігаємо налаштування користувача
      saveUserSettings(settings);

      // Оновлюємо пароль, якщо потрібно
      if (password) {
        updateUserPassword(password, hasPassword ? currentPassword : null);
      } else if (currentPassword && !hasPassword) {
        updateUserPassword(currentPassword);
      }

      // Обробка аватара
      if (uploadedAvatar) {
        const reader = new FileReader();
        reader.onload = () => {
          const avatarSrc = reader.result;
          localStorage.setItem('userAvatarSrc', avatarSrc);
          localStorage.removeItem('selectedAvatarId');
          loadUserAvatar();
        };
        reader.readAsDataURL(uploadedAvatar);
      } else if (selectedAvatar) {
        const avatarId = selectedAvatar.dataset.id;
        localStorage.setItem('selectedAvatarId', avatarId);
        localStorage.setItem(`${avatarId}Src`, selectedAvatar.src);
        localStorage.removeItem('userAvatarSrc');

        // Оновлюємо налаштування з аватаром
        saveUserSettings({
          avatar_id: avatarId,
        });

        loadUserAvatar();
      }

      // Закриваємо модальне вікно
      modal.remove();
    };

    // Додаємо обробники для полів вводу
    modal.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', function () {
        this.classList.remove('error');
      });
    });

    // Додаємо обробники для закриття модального вікна
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /**
   * Показує модальне вікно з SID фразою
   */
  function showSeedPhrase() {
    console.log('Показуємо SID фразу');

    const userId = localStorage.getItem('telegram_user_id') || '12345678';
    const phrase = generateSeedPhrase(userId);

    // Видаляємо попередні модальні вікна
    document.querySelectorAll('.document-modal').forEach((modal) => modal.remove());

    // Створюємо нове модальне вікно
    const modal = document.createElement('div');
    modal.className = 'document-modal show';
    modal.innerHTML = `
            <div class="seed-modal-content">
                <div class="modal-header">
                    <div class="modal-title">SID фраза</div>
                    <span class="close-modal">×</span>
                </div>
                <div class="modal-body">
                    <div class="restore-card">
                        <div class="restore-title">Ваша SID фраза</div>
                        <div class="restore-subtitle">Збережіть цю фразу в надійному місці</div>
                        <button class="copy-button">Копіювати</button>
                        <div class="words-grid">
                            ${phrase
                              .map(
                                (word, i) => `
                                <div class="word-cell">
                                    <div class="word-number">${i + 1}.</div>
                                    <div class="word-value">${word}</div>
                                </div>
                            `
                              )
                              .join('')}
                        </div>
                        <button class="seed-continue-button">Готово</button>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(modal);

    // Додаємо обробники подій
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('.copy-button').onclick = () => {
      navigator.clipboard
        .writeText(phrase.join(' '))
        .then(() => showToast('Скопійовано'))
        .catch(() => showToast('Помилка копіювання', true));
    };
    modal.querySelector('.seed-continue-button').onclick = () => {
      localStorage.setItem('seedPhraseViewed', 'true');
      modal.remove();
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /**
   * Показує модальне вікно введення пароля
   * @param {Function} callback - Функція, яка буде викликана після успішного введення пароля
   */
  function showEnterPasswordModal(callback) {
    // Видаляємо попередні модальні вікна
    document.querySelectorAll('.document-modal').forEach((modal) => modal.remove());

    // Створюємо нове модальне вікно
    const modal = document.createElement('div');
    modal.className = 'document-modal show';
    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Введіть пароль</div>
                    <span class="close-modal">×</span>
                </div>
                <div class="modal-body">
                    <input type="password" id="enter-password" placeholder="Ваш пароль">
                    <div id="error-msg"></div>
                </div>
                <div class="modal-footer">
                    <button class="modal-button" id="check-password">Перевірити</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);

    // Додаємо обробники подій
    const checkBtn = modal.querySelector('#check-password');
    checkBtn.onclick = () => {
      const pwd = modal.querySelector('#enter-password').value;
      const error = modal.querySelector('#error-msg');

      // Перевіряємо пароль
      const savedPassHash = localStorage.getItem('passwordHash');
      const savedSeedHash = localStorage.getItem('seedPhrasePasswordHash');
      const inputHash = hashPassword(pwd);

      if (inputHash === savedPassHash || inputHash === savedSeedHash) {
        modal.remove();
        if (typeof callback === 'function') {
          callback(pwd);
        }
      } else {
        error.textContent = 'Невірний пароль';
      }
    };

    // Додаємо обробники для закриття модального вікна
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    // Додаємо обробник для Enter
    modal.querySelector('#enter-password').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        checkBtn.click();
      }
    });
  }

  /**
   * Показує модальне вікно встановлення пароля
   * @param {Function} callback - Функція, яка буде викликана після успішного встановлення пароля
   */
  function showSetPasswordModal(callback) {
    // Видаляємо попередні модальні вікна
    document.querySelectorAll('.document-modal').forEach((modal) => modal.remove());

    // Створюємо нове модальне вікно
    const modal = document.createElement('div');
    modal.className = 'document-modal show';
    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Встановлення паролю</div>
                    <span class="close-modal">×</span>
                </div>
                <div class="modal-body">
                    <p>Пароль має містити не менше 8 символів, включаючи 5 літер</p>
                    <input type="password" id="new-password" placeholder="Пароль">
                    <input type="password" id="confirm-password" placeholder="Підтвердження">
                    <div id="error-msg"></div>
                </div>
                <div class="modal-footer">
                    <button class="modal-button" id="save-password">Зберегти</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);

    // Додаємо обробники подій
    const saveBtn = modal.querySelector('#save-password');
    saveBtn.onclick = () => {
      const pwd = modal.querySelector('#new-password').value;
      const confirm = modal.querySelector('#confirm-password').value;
      const error = modal.querySelector('#error-msg');

      // Перевіряємо, чи паролі співпадають
      if (pwd !== confirm) {
        error.textContent = 'Паролі не співпадають';
        return;
      }

      // Перевіряємо валідність пароля
      const validation = validatePassword(pwd);
      if (!validation.valid) {
        error.textContent = validation.message;
        return;
      }

      // Зберігаємо пароль
      updateUserPassword(pwd);

      // Закриваємо модальне вікно
      modal.remove();

      // Викликаємо колбек, якщо він є
      if (typeof callback === 'function') {
        callback(pwd);
      }
    };

    // Додаємо обробники для закриття модального вікна
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /**
   * Обробляє показ SID фрази з перевіркою пароля
   */
  function handleShowSeedPhrase() {
    console.log('Обробка показу SID фрази');

    try {
      const savedPassHash = localStorage.getItem('passwordHash');
      const savedSeedHash = localStorage.getItem('seedPhrasePasswordHash');
      const hasPassword = savedPassHash || savedSeedHash;

      if (!hasPassword) {
        console.log('Пароль відсутній, показуємо модалку встановлення паролю');
        showSetPasswordModal(function (password) {
          console.log('Пароль встановлено, показуємо SID фразу');
          showSeedPhrase();
        });
      } else {
        console.log('Пароль наявний, показуємо модалку введення паролю');
        showEnterPasswordModal(function (password) {
          console.log('Пароль підтверджено, показуємо SID фразу');
          showSeedPhrase();
        });
      }
    } catch (error) {
      console.error('Помилка при обробці показу SID фрази:', error);
      showToast('Виникла помилка при спробі показати SID фразу', true);
    }
  }

  /**
   * Показує модальне вікно з ліцензійною угодою
   */
  function showLicenseModal() {
    // Видаляємо попередні модальні вікна
    document.querySelectorAll('.document-modal').forEach((modal) => modal.remove());

    // Створюємо нове модальне вікно
    const modal = document.createElement('div');
    modal.className = 'document-modal show';
    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Ліцензійна угода WINIX</div>
                    <span class="close-modal">×</span>
                </div>
                <div class="modal-scrollable-content">
                    <p>Версія 1.0, Березень 2025</p>
                    <br>
                    <p>Ця ліцензійна угода ("Угода") укладена між WINIX ("Ліцензіар") та Вами ("Ліцензіат").</p>
                    <br>
                    <p>1. НАДАННЯ ЛІЦЕНЗІЇ</p>
                    <p>Ліцензіар надає Ліцензіату невиключну ліцензію на використання програмного забезпечення WINIX ("Програмне забезпечення") відповідно до умов цієї Угоди.</p>
                    <br>
                    <p>2. ОБМЕЖЕННЯ</p>
                    <p>Ліцензіат не має права:</p>
                    <p>- Копіювати або розповсюджувати Програмне забезпечення</p>
                    <p>- Модифікувати, декомпілювати або дизасемблювати Програмне забезпечення</p>
                    <p>- Використовувати Програмне забезпечення для незаконних цілей</p>
                    <br>
                    <p>3. ПРАВА ВЛАСНОСТІ</p>
                    <p>Програмне забезпечення є власністю Ліцензіара та захищено законами про інтелектуальну власність.</p>
                    <br>
                    <p>4. ГАРАНТІЇ ТА ВІДМОВА ВІД ВІДПОВІДАЛЬНОСТІ</p>
                    <p>Програмне забезпечення надається "як є" без будь-яких гарантій.</p>
                    <br>
                    <p>5. ВІДШКОДУВАННЯ ЗБИТКІВ</p>
                    <p>Ліцензіат погоджується відшкодувати Ліцензіару будь-які збитки, що виникли внаслідок порушення цієї Угоди.</p>
                    <br>
                    <p>6. ПРИПИНЕННЯ</p>
                    <p>Ця Угода діє до її припинення. Ліцензіар має право припинити дію цієї Угоди в разі порушення її умов Ліцензіатом.</p>
                    <br>
                    <p>7. ЗАГАЛЬНІ ПОЛОЖЕННЯ</p>
                    <p>Ця Угода регулюється законодавством України. Всі спори, що виникають в зв'язку з цією Угодою, підлягають вирішенню в судах України.</p>
                </div>
                <button class="modal-back-button">Назад</button>
            </div>
        `;
    document.body.appendChild(modal);

    // Додаємо обробники подій
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('.modal-back-button').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /**
   * Показує модальне вікно з угодою користувача
   */
  function showAgreementModal() {
    // Видаляємо попередні модальні вікна
    document.querySelectorAll('.document-modal').forEach((modal) => modal.remove());

    // Створюємо нове модальне вікно
    const modal = document.createElement('div');
    modal.className = 'document-modal show';
    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Угода користувача WINIX</div>
                    <span class="close-modal">×</span>
                </div>
                <div class="modal-scrollable-content">
                    <p>Версія 1.0, Березень 2025</p>
                    <br>
                    <p>Ласкаво просимо до WINIX!</p>
                    <br>
                    <p>Ця Угода користувача ("Угода") регулює використання Вами мобільного додатку WINIX та всіх пов'язаних послуг.</p>
                    <br>
                    <p>1. ПРИЙНЯТТЯ УМОВ</p>
                    <p>Використовуючи WINIX, Ви погоджуєтесь з умовами цієї Угоди. Якщо Ви не погоджуєтесь з умовами, Ви не маєте права використовувати WINIX.</p>
                    <br>
                    <p>2. РЕЄСТРАЦІЯ ТА БЕЗПЕКА</p>
                    <p>Для використання WINIX Вам необхідно створити обліковий запис. Ви зобов'язані надати достовірну інформацію та забезпечити безпеку свого облікового запису.</p>
                    <br>
                    <p>3. КОНФІДЕНЦІЙНІСТЬ</p>
                    <p>Ваша конфіденційність є важливою для нас. Збір та використання Ваших персональних даних регулюється нашою Політикою конфіденційності.</p>
                    <br>
                    <p>4. ВИКОРИСТАННЯ ТОКЕНІВ WINIX</p>
                    <p>Токени WINIX є внутрішньою валютою додатку та не мають реальної вартості. Ви не маєте права продавати або обмінювати токени WINIX за межами додатку.</p>
                    <br>
                    <p>5. ПРАВИЛА ПОВЕДІНКИ</p>
                    <p>Ви зобов'язуєтесь не використовувати WINIX для незаконних або шахрайських цілей.</p>
                    <br>
                    <p>6. ЗМІНИ В УГОДІ</p>
                    <p>Ми залишаємо за собою право змінювати цю Угоду в будь-який час. Зміни вступають в силу після їх публікації в додатку.</p>
                    <br>
                    <p>7. ПРИПИНЕННЯ</p>
                    <p>Ми залишаємо за собою право припинити або обмежити Ваш доступ до WINIX в разі порушення цієї Угоди.</p>
                </div>
                <button class="modal-back-button">Назад</button>
            </div>
        `;
    document.body.appendChild(modal);

    // Додаємо обробники подій
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('.modal-back-button').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  /**
   * Оновлює тексти на сторінці відповідно до обраної мови
   */
  function updatePageTexts() {
    document.querySelectorAll('[data-lang-key]').forEach((element) => {
      const key = element.getAttribute('data-lang-key');
      if (key) {
        // Тут мав би бути виклик функції getTranslation, але в цій імплементації
        // ми просто залишаємо поточний текст
        // element.textContent = getTranslation(key, element.textContent);
      }
    });
  }

  /**
   * Функція для навігації між сторінками
   * @param {string} page - URL сторінки, на яку потрібно перейти
   */
  function navigateTo(page) {
    try {
      window._isNavigating = true;

      // Показуємо індикатор завантаження
      const spinner = document.getElementById('loading-spinner');
      if (spinner) spinner.style.display = 'flex';

      // Зберігаємо поточний баланс для порівняння після навігації
      const currentTokens = parseFloat(document.getElementById('user-tokens').textContent || '0');
      const currentCoins = parseFloat(document.getElementById('user-coins').textContent || '0');

      sessionStorage.setItem('lastBalance', currentTokens.toString());
      sessionStorage.setItem('lastCoins', currentCoins.toString());
      sessionStorage.setItem('navigationTime', Date.now().toString());

      // Запитуємо поточну сторінку
      const currentPage = window.location.pathname.split('/').pop();
      if (currentPage === page) {
        console.log('Вже на цій сторінці');
        if (spinner) spinner.style.display = 'none';
        window._isNavigating = false;
        return;
      }

      // Переходимо на нову сторінку
      setTimeout(() => {
        window.location.href = page;
      }, 100);
    } catch (error) {
      console.error('Помилка навігації:', error);
      window._isNavigating = false;

      if (spinner) spinner.style.display = 'none';
      showToast('Помилка навігації', true);
    }
  }

  /**
   * Налаштовує обробники подій на сторінці
   */
  function setupEventHandlers() {
    console.log('Налаштування обробників подій');

    // Кнопка редагування профілю
    const editProfileBtn = document.getElementById('edit-profile');
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', function () {
        showEditProfileModal();
      });
    }

    // Обробка вибору мови
    const languageOptions = document.querySelectorAll('.language-option');
    languageOptions.forEach((option) => {
      option.addEventListener('click', function () {
        // Знімаємо активний стан з усіх мов
        languageOptions.forEach((opt) => opt.classList.remove('active'));

        // Встановлюємо активний стан для обраної мови
        this.classList.add('active');

        // Отримуємо код обраної мови
        const selectedLang = this.getAttribute('data-lang');

        // Зберігаємо налаштування мови
        saveUserSettings({ language: selectedLang });
      });
    });

    // Перемикач сповіщень
    const notificationsToggle = document.getElementById('notifications-toggle');
    if (notificationsToggle) {
      notificationsToggle.addEventListener('change', function () {
        saveUserSettings({ notifications_enabled: this.checked });
      });
    }

    // Кнопка показу SID фрази
    const showSeedBtn = document.getElementById('show-seed-phrase');
    if (showSeedBtn) {
      showSeedBtn.addEventListener('click', function () {
        handleShowSeedPhrase();
      });
    }

    // Навігаційні елементи
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', function () {
        const section = this.getAttribute('data-section');

        // Якщо вже на цій сторінці, нічого не робимо
        if (section === 'general') {
          console.log('Вже на сторінці налаштувань');
          return;
        }

        // Переходимо на відповідну сторінку
        switch (section) {
          case 'home':
            navigateTo('original-index.html');
            break;
          case 'earn':
            navigateTo('earn.html');
            break;
          case 'referrals':
            navigateTo('referrals.html');
            break;
          case 'wallet':
            navigateTo('wallet.html');
            break;
          default:
            navigateTo(`${section}.html`);
        }
      });
    });

    // Кнопки внизу сторінки
    const helpButton = document.getElementById('help-button');
    const licenseButton = document.getElementById('license-button');
    const agreementButton = document.getElementById('agreement-button');

    if (licenseButton) {
      licenseButton.addEventListener('click', function () {
        showLicenseModal();
      });
    }

    if (agreementButton) {
      agreementButton.addEventListener('click', function () {
        showAgreementModal();
      });
    }

    // Обробник кліку на аватар у хедері
    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) {
      profileAvatar.addEventListener('click', function () {
        showEditProfileModal();
      });
    }

    console.log('Обробники подій успішно налаштовано');
  }

  /**
   * Запускає періодичне оновлення даних
   */
  function startPeriodicUpdates() {
    console.log('Запуск періодичного оновлення даних');

    // Оновлюємо дані кожні 60 секунд (збільшено інтервал для зменшення навантаження)
    setInterval(() => {
      // Перевіряємо час останнього запиту
      const now = Date.now();
      const timeSinceLastRequest = now - _lastUserDataRequestTime;

      // Запитуємо лише якщо минуло достатньо часу і немає активного запиту
      if (timeSinceLastRequest >= MIN_REQUEST_INTERVAL && !_loadingUserData) {
        console.log('🔄 Періодичне оновлення даних користувача');
        fetchUserData(false); // false - не показувати індикатор завантаження
      }
    }, 60000); // 60 секунд
  }

  /**
   * Ініціалізує модуль налаштувань
   */
  function init() {
    if (_isInitialized) return;

    console.log('Ініціалізація модуля налаштувань...');

    // Завантажуємо дані користувача
    loadUserData();

    // Налаштовуємо обробники подій
    setupEventHandlers();

    // Запускаємо періодичне оновлення
    startPeriodicUpdates();

    // Слухаємо подію оновлення даних користувача
    document.addEventListener('user-data-updated', function (event) {
      console.log('🔄 Отримано подію оновлення даних користувача');
      if (event.detail && !_loadingUserData) {
        _userData = event.detail;
        updateUIWithUserData(_userData);
      }
    });

    _isInitialized = true;
    console.log('✅ Модуль налаштувань успішно ініціалізовано');
  }

  // Ініціалізуємо модуль при завантаженні сторінки
  document.addEventListener('DOMContentLoaded', init);

  // Обробка відновлення сторінки з кешу
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      console.log('Сторінка відновлена з кешу, оновлюємо дані');
      loadUserData();
    }
  });

  // Повертаємо публічний API
  return {
    init: init,
    loadUserData: loadUserData,
    showEditProfileModal: showEditProfileModal,
    showSeedPhrase: showSeedPhrase,
    navigateTo: navigateTo,
    updateUserPassword: updateUserPassword,
    saveUserSettings: saveUserSettings,
  };
})();
