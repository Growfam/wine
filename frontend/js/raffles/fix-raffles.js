/**
 * Виправлення для модуля розіграшів
 */
(function() {
  console.log("🛠️ Запуск виправлення для модуля розіграшів");

  // Глобальна змінна activeTab для виправлення помилки з tabName
  window.activeTab = 'active'; // default tab

  // Перевизначаємо функцію перемикання вкладок
  window.switchRaffleTab = function(tab) {
    console.log("Перемикання на вкладку:", tab);

    // Зберігаємо активну вкладку в глобальну змінну
    window.activeTab = tab;

    // Оновлюємо класи вкладок
    document.querySelectorAll('.tab-button').forEach(btn => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Оновлюємо контент вкладок
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    const activeContent = document.getElementById(tab + '-raffles');
    if (activeContent) {
      activeContent.classList.add('active');
    }

    // Приховуємо спінери
    document.querySelectorAll('.loading-placeholder').forEach(spinner => {
      spinner.style.display = 'none';
    });

    // Намагаємося завантажити дані розіграшів
    displayRafflesManually();
  };

  // Функція для видалення всіх спінерів
  function removeAllLoaders() {
    document.querySelectorAll('.loading-placeholder, #loading-spinner, .initial-loader').forEach(loader => {
      if (loader) loader.style.display = 'none';
    });
    console.log("🛠️ Всі спінери приховано");
  }

  // Функція для ручного відображення даних розіграшів
  async function displayRafflesManually() {
    try {
      console.log("🛠️ Спроба мануального відображення розіграшів...");

      // Отримуємо дані напряму
      const response = await fetch('/api/raffles');
      const result = await response.json();

      if (result && result.status === 'success' && result.data) {
        console.log(`🛠️ Отримано ${result.data.length} розіграшів`);

        // Знаходимо контейнери для розіграшів
        const mainContainer = document.querySelector('.main-raffle');
        const miniContainer = document.querySelector('.mini-raffles-container');

        // Очищуємо контейнери
        if (mainContainer) mainContainer.innerHTML = '';
        if (miniContainer) miniContainer.innerHTML = '';

        // Відображаємо основний розіграш, якщо він є
        if (result.data.length > 0) {
          const mainRaffle = result.data[0];

          if (mainContainer) {
            mainContainer.innerHTML = `
              <img class="main-raffle-image" src="${mainRaffle.image_url || 'assets/prize-poster.gif'}" alt="${mainRaffle.title}">
              <div class="main-raffle-content">
                <div class="main-raffle-header">
                  <h3 class="main-raffle-title">${mainRaffle.title || 'Головний розіграш'}</h3>
                  <div class="main-raffle-cost">
                    <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
                    <span>${mainRaffle.entry_fee || 0} жетон${mainRaffle.entry_fee !== 1 ? 'и' : ''}</span>
                  </div>
                </div>
                <span class="main-raffle-prize">${mainRaffle.prize_amount || 0} ${mainRaffle.prize_currency || 'WINIX'}</span>
                <div class="timer-container">
                  <div class="timer-block">
                    <span class="timer-value" id="days">02</span>
                    <span class="timer-label">днів</span>
                  </div>
                  <div class="timer-block">
                    <span class="timer-value" id="hours">14</span>
                    <span class="timer-label">год</span>
                  </div>
                  <div class="timer-block">
                    <span class="timer-value" id="minutes">35</span>
                    <span class="timer-label">хв</span>
                  </div>
                </div>
                <div class="main-raffle-participants">
                  <div class="participants-info">Учасників: <span class="participants-count">${mainRaffle.participants_count || 0}</span></div>
                </div>
                <div class="progress-bar">
                  <div class="progress" style="width: 65%"></div>
                </div>
                <button class="join-button" data-raffle-id="${mainRaffle.id}">Взяти участь</button>
              </div>
            `;
          }

          // Відображаємо міні-розіграші (інші розіграші)
          if (result.data.length > 1 && miniContainer) {
            for (let i = 1; i < result.data.length; i++) {
              const raffle = result.data[i];
              const miniRaffle = document.createElement('div');
              miniRaffle.className = 'mini-raffle';
              miniRaffle.setAttribute('data-raffle-id', raffle.id);

              miniRaffle.innerHTML = `
                <div class="mini-raffle-info">
                  <div class="mini-raffle-title">${raffle.title || 'Щоденний розіграш'}</div>
                  <div class="mini-raffle-cost">
                    <img class="token-icon" src="/assets/token-icon.png" alt="Жетон">
                    <span>${raffle.entry_fee || 0} жетон${raffle.entry_fee !== 1 ? 'и' : ''}</span>
                  </div>
                  <div class="mini-raffle-prize">${raffle.prize_amount || 0} ${raffle.prize_currency || 'WINIX'}</div>
                  <div class="mini-raffle-time">Залишилось: скоро закінчення</div>
                </div>
                <button class="mini-raffle-button" data-raffle-id="${raffle.id}">Участь</button>
              `;

              miniContainer.appendChild(miniRaffle);
            }
          }

          // Додаємо обробники подій для кнопок
          document.querySelectorAll('.join-button, .mini-raffle-button').forEach(button => {
            button.addEventListener('click', function() {
              const raffleId = this.getAttribute('data-raffle-id');
              console.log(`Клік на кнопці участі, raffle_id: ${raffleId}`);

              if (typeof window.WinixAPI === 'object' && typeof window.WinixAPI.participateInRaffle === 'function') {
                window.WinixAPI.participateInRaffle(raffleId, 1)
                  .then(result => {
                    if (result.status === 'success') {
                      window.showToast('Ви успішно взяли участь у розіграші!', 'success');
                    } else {
                      window.showToast(result.message || 'Помилка участі в розіграші', 'error');
                    }
                  })
                  .catch(err => {
                    window.showToast('Помилка участі в розіграші', 'error');
                    console.error('Помилка:', err);
                  });
              } else {
                window.showToast('Функція участі в розіграші недоступна', 'warning');
              }
            });
          });
        } else {
          // Якщо немає розіграшів, показуємо повідомлення
          if (mainContainer) {
            mainContainer.innerHTML = `
              <div style="text-align: center; padding: 30px; background: rgba(0,0,0,0.3); border-radius: 15px;">
                <div style="font-size: 40px; margin-bottom: 20px;">🎁</div>
                <h3 style="margin-bottom: 10px;">Наразі немає активних розіграшів</h3>
                <p style="color: rgba(255,255,255,0.7);">Заходьте пізніше, щоб взяти участь у нових розіграшах!</p>
              </div>
            `;
          }

          if (miniContainer) {
            miniContainer.innerHTML = `
              <div style="text-align: center; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px;">
                <p style="color: rgba(255,255,255,0.7);">Щоденні розіграші відсутні</p>
              </div>
            `;
          }
        }

        // Приховуємо всі спінери після успішного відображення
        removeAllLoaders();
      } else {
        console.error("🛠️ Помилка отримання даних розіграшів:", result);
      }
    } catch (error) {
      console.error("🛠️ Помилка відображення розіграшів:", error);
    } finally {
      // В будь-якому випадку приховуємо спінери
      removeAllLoaders();
    }
  }

  // Запускаємо код після завантаження DOM
  function init() {
    // Спочатку чекаємо невелику затримку
    setTimeout(function() {
      // Перевіряємо, чи дані відображені
      const loadingPlaceholders = document.querySelectorAll('.loading-placeholder');
      if (loadingPlaceholders.length > 0) {
        console.log("🛠️ Виявлено спінери, запускаємо ручне відображення");
        displayRafflesManually();
      }

      // Додаємо кнопку для ручного оновлення
      const refreshBtn = document.createElement('button');
      refreshBtn.id = 'manual-refresh';
      refreshBtn.innerHTML = '⟳';
      refreshBtn.style.cssText = `
        position: fixed; 
        bottom: 100px; 
        right: 20px; 
        background: #007cc9; 
        color: white; 
        border: none; 
        border-radius: 50%; 
        width: 50px; 
        height: 50px; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        font-size: 20px; 
        cursor: pointer; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 9999;
      `;

      document.body.appendChild(refreshBtn);
      refreshBtn.addEventListener('click', function() {
        window.showToast("Оновлення розіграшів...", "info");
        displayRafflesManually();
      });
    }, 1000);

    // Через 5 секунд в будь-якому випадку приховуємо всі спінери
    setTimeout(removeAllLoaders, 5000);
  }

  // Запускаємо ініціалізацію
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();