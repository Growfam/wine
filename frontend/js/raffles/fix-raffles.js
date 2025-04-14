/**
 * Виправлення для модуля розіграшів
 */
(function() {
  console.log("🛠️ Запуск виправлення для модуля розіграшів");

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

        // Очищуємо контейнери
        document.querySelectorAll('.main-raffle, .mini-raffles-container').forEach(container => {
          container.innerHTML = '';
        });

        // Відображаємо основний розіграш, якщо він є
        if (result.data.length > 0) {
          const mainRaffle = result.data[0];
          const mainContainer = document.querySelector('.main-raffle');

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
          if (result.data.length > 1) {
            const miniContainer = document.querySelector('.mini-raffles-container');
            if (miniContainer) {
              miniContainer.innerHTML = '';

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
          }

          // Додаємо обробники подій для кнопок
          document.querySelectorAll('.join-button, .mini-raffle-button').forEach(button => {
            button.addEventListener('click', function(e) {
              const raffleId = this.getAttribute('data-raffle-id');
              console.log(`Клік на кнопці участі, raffle_id: ${raffleId}`);
              alert(`Ви натиснули на кнопку участі в розіграші з ID: ${raffleId}`);
            });
          });
        }
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

  // Чекаємо завантаження сторінки
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Спочатку чекаємо 1 секунду
    setTimeout(() => {
      // Перевіряємо, чи дані відображені
      const loadingPlaceholders = document.querySelectorAll('.loading-placeholder');
      if (loadingPlaceholders.length > 0) {
        console.log("🛠️ Виявлено спінери, запускаємо ручне відображення");
        displayRafflesManually();
      }
    }, 1000);

    // Через 5 секунд в будь-якому випадку приховуємо всі спінери
    setTimeout(removeAllLoaders, 5000);
  }
})();