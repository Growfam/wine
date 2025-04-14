/**
 * Виправлення для модуля розіграшів
 */
(function() {
  console.log("🛠️ Запуск виправлення для модуля розіграшів");

  // Почекаємо повного завантаження DOM
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Створюємо контейнер, якщо його немає
      let rafflesContainer = document.getElementById('raffles-container');
      if (!rafflesContainer) {
        rafflesContainer = document.querySelector('.main-content') || document.body;
      }

      console.log("Отримання даних розіграшів напряму...");

      // Отримуємо дані напряму
      const response = await fetch('/api/raffles');
      const data = await response.json();

      if (data && data.status === 'success' && data.data) {
        console.log(`Завантажено ${data.data.length} розіграшів`);

        // Приховуємо модальне вікно, якщо воно є
        const modal = document.querySelector('.modal-container');
        if (modal) modal.style.display = 'none';

        // Відображаємо розіграші вручну
        displayRaffles(data.data, rafflesContainer);
      } else {
        console.error("Помилка отримання даних розіграшів:", data);
      }
    } catch (error) {
      console.error("Помилка виправлення модуля розіграшів:", error);
    } finally {
      // Вимикаємо всі спінери
      const spinners = document.querySelectorAll('.spinner, .loading-indicator, .loader');
      spinners.forEach(spinner => {
        spinner.style.display = 'none';
      });
    }
  });

  // Функція для відображення розіграшів
  function displayRaffles(raffles, container) {
    if (!container || !raffles || !raffles.length) return;

    // Очищаємо контейнер
    container.innerHTML = '<h2>Активні розіграші</h2>';

    // Створюємо елементи для кожного розіграшу
    raffles.forEach(raffle => {
      const raffleElement = document.createElement('div');
      raffleElement.className = 'raffle-card';
      raffleElement.setAttribute('data-raffle-id', raffle.id);

      // Формуємо HTML для розіграшу
      raffleElement.innerHTML = `
        <div class="raffle-header">
          <h3>${raffle.title || 'Розіграш'}</h3>
          <div class="raffle-cost">
            <img src="/assets/token-icon.png" alt="Жетон" width="16" height="16">
            <span>${raffle.entry_fee || 0} жетон${raffle.entry_fee !== 1 ? 'и' : ''}</span>
          </div>
        </div>
        <div class="raffle-prize">
          Приз: ${raffle.prize_amount || 0} ${raffle.prize_currency || 'WINIX'}
        </div>
        <div class="raffle-participants">
          Учасників: ${raffle.participants_count || 0}
        </div>
        <button class="join-button" data-raffle-id="${raffle.id}">Взяти участь</button>
      `;

      // Додаємо до контейнера
      container.appendChild(raffleElement);

      // Додаємо обробник для кнопки
      const joinButton = raffleElement.querySelector('.join-button');
      if (joinButton) {
        joinButton.addEventListener('click', function() {
          alert(`Беремо участь у розіграші: ${raffle.title}`);
          // Тут можна додати реальний код для участі в розіграші
        });
      }
    });

    console.log("Розіграші успішно відображено");
  }
})();