/**
 * DailyBonusDialog - компонент діалогового вікна щоденного бонусу
 *
 * Відповідає за:
 * - Відображення діалогового вікна з календарем і винагородою
 * - Обробку взаємодії з користувачем
 * - Інтеграцію з сервісом щоденних бонусів
 */

import { getLogger, LOG_CATEGORIES } from 'js/tasks/utils/index.js';
import { DAILY_BONUS_TYPES, DAILY_BONUS_CONFIG } from 'js/tasks/config/types/daily-bonus-types.js';
import DailyBonusCalendar from 'js/tasks/ui/components/daily-bonus/calendar.js';
import DailyBonusRewardPreview from 'js/tasks/ui/components/daily-bonus/reward-preview.js';
import { default as DailyBonusService } from 'js/tasks/services/daily-bonus/daily-bonus-service.js';

// Створюємо логер для модуля
const logger = getLogger('UI.DailyBonusDialog');

// Сервіс для роботи з щоденними бонусами
const dailyBonusService = new DailyBonusService();

/**
 * Клас компонента діалогового вікна щоденного бонусу
 */
class DailyBonusDialog {
  /**
   * Конструктор
   * @param {Object} options - Налаштування
   */
  constructor(options = {}) {
    // Налаштування
    this.options = {
      appendTo: document.body, // Елемент, до якого додавати діалог
      autoShow: false, // Чи показувати автоматично
      theme: 'default', // Тема оформлення
      onClaim: null, // Обробник отримання бонусу
      onClose: null, // Обробник закриття діалогу
      closeOnClaim: false, // Чи закривати після отримання
      showAnimation: true, // Чи показувати анімацію отримання
      ...options,
    };

    // Внутрішній стан
    this.state = {
      elementId: `daily-bonus-dialog-${Date.now()}`, // ID елемента
      initialized: false, // Чи ініціалізовано
      visible: false, // Чи видиме вікно
      loading: false, // Чи триває завантаження
      claiming: false, // Чи триває отримання бонусу
      bonusData: null, // Дані бонусу
      calendarComponent: null, // Компонент календаря
      rewardComponent: null, // Компонент відображення винагороди
      elements: {
        // Елементи діалогу
        dialog: null,
        overlay: null,
        content: null,
        calendar: null,
        reward: null,
        button: null,
        closeBtn: null,
      },
    };

    // Ініціалізуємо
    this.initialize();

    // Показуємо автоматично, якщо потрібно
    if (this.options.autoShow) {
      this.show();
    }
  }

  /**
   * Ініціалізація компонента
   * @returns {boolean} Результат ініціалізації
   */
  initialize() {
    try {
      // Створюємо DOM-структуру
      this._createDOMStructure();

      // Прив'язуємо обробники подій
      this._bindEvents();

      // Ініціалізуємо сервіс бонусів, якщо він не ініціалізований
      if (!dailyBonusService.initialized) {
        dailyBonusService.initialize();
      }

      // Позначаємо ініціалізацію
      this.state.initialized = true;

      logger.info('Діалогове вікно щоденного бонусу ініціалізовано', 'initialize', {
        category: LOG_CATEGORIES.INIT,
      });

      return true;
    } catch (error) {
      logger.error(error, 'Помилка ініціалізації діалогового вікна', {
        category: LOG_CATEGORIES.INIT,
      });

      return false;
    }
  }

  /**
   * Створення DOM-структури діалогу
   * @private
   */
  _createDOMStructure() {
    try {
      // Перевіряємо, чи вже існує діалог
      if (document.getElementById(this.state.elementId)) {
        return;
      }

      // Створюємо елементи

      // 1. Створюємо оверлей
      const overlay = document.createElement('div');
      overlay.className = 'daily-bonus-dialog-overlay';

      // 2. Створюємо діалог
      const dialog = document.createElement('div');
      dialog.id = this.state.elementId;
      dialog.className = `daily-bonus-dialog ${this.options.theme}`;

      // 3. Створюємо кнопку закриття
      const closeBtn = document.createElement('button');
      closeBtn.className = 'daily-bonus-dialog-close';
      closeBtn.innerHTML = '&times;';

      // 4. Створюємо контейнер для контенту
      const content = document.createElement('div');
      content.className = 'daily-bonus-dialog-content';

      // 5. Створюємо контейнер для календаря
      const calendarContainer = document.createElement('div');
      calendarContainer.className = 'daily-bonus-dialog-calendar';

      // 6. Створюємо контейнер для винагороди
      const rewardContainer = document.createElement('div');
      rewardContainer.className = 'daily-bonus-dialog-reward';

      // 7. Створюємо кнопку отримання бонусу
      const claimButton = document.createElement('button');
      claimButton.className = 'daily-bonus-dialog-claim-button';
      claimButton.textContent = 'ОТРИМАТИ БОНУС';

      // Збираємо структуру
      content.appendChild(calendarContainer);
      content.appendChild(rewardContainer);
      content.appendChild(claimButton);

      dialog.appendChild(closeBtn);
      dialog.appendChild(content);

      overlay.appendChild(dialog);

      // Додаємо до DOM
      this.options.appendTo.appendChild(overlay);

      // Зберігаємо посилання на елементи
      this.state.elements = {
        dialog,
        overlay,
        content,
        calendar: calendarContainer,
        reward: rewardContainer,
        button: claimButton,
        closeBtn,
      };

      // Ініціалізуємо компоненти
      this.state.calendarComponent = new DailyBonusCalendar({
        container: calendarContainer,
        theme: this.options.theme,
      });

      this.state.rewardComponent = new DailyBonusRewardPreview({
        container: rewardContainer,
        theme: this.options.theme,
      });

      logger.debug('DOM-структура діалогового вікна створена', '_createDOMStructure', {
        category: LOG_CATEGORIES.RENDERING,
      });
    } catch (error) {
      logger.error(error, 'Помилка створення DOM-структури', {
        category: LOG_CATEGORIES.RENDERING,
      });
    }
  }

  /**
   * Прив'язка обробників подій
   * @private
   */
  _bindEvents() {
    try {
      // Обробник закриття діалогу
      this.state.elements.closeBtn.addEventListener('click', () => {
        this.hide();
      });

      // Обробник кліку на оверлей
      this.state.elements.overlay.addEventListener('click', (event) => {
        if (event.target === this.state.elements.overlay) {
          this.hide();
        }
      });

      // Обробник кліку на кнопку отримання бонусу
      this.state.elements.button.addEventListener('click', () => {
        this._claimBonus();
      });

      // Обробник натискання ESC
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.state.visible) {
          this.hide();
        }
      });

      logger.debug("Обробники подій прив'язано", '_bindEvents', {
        category: LOG_CATEGORIES.EVENTS,
      });
    } catch (error) {
      logger.error(error, "Помилка прив'язки обробників подій", {
        category: LOG_CATEGORIES.EVENTS,
      });
    }
  }

  /**
   * Показ діалогового вікна
   * @param {Object} options - Додаткові опції показу
   */
  async show(options = {}) {
    if (this.state.visible) return;

    try {
      // Оновлюємо опції
      if (options.theme) {
        this.options.theme = options.theme;
        this.state.elements.dialog.className = `daily-bonus-dialog ${this.options.theme}`;
      }

      // Позначаємо, що вікно завантажується
      this.state.loading = true;
      this.state.elements.dialog.classList.add('loading');

      // Показуємо діалог
      this.state.elements.overlay.classList.add('visible');
      this.state.elements.dialog.classList.add('visible');
      this.state.visible = true;

      // Завантажуємо дані про бонус
      const bonusData = await dailyBonusService.getCurrentBonus(true);
      this.state.bonusData = bonusData;

      // Оновлюємо компоненти
      this._updateComponents();

      // Зупиняємо завантаження
      this.state.loading = false;
      this.state.elements.dialog.classList.remove('loading');

      // Оновлюємо статус кнопки
      this._updateButtonState();

      logger.info('Діалогове вікно щоденного бонусу показано', 'show', {
        category: LOG_CATEGORIES.UI,
      });
    } catch (error) {
      logger.error(error, 'Помилка показу діалогового вікна', {
        category: LOG_CATEGORIES.UI,
      });

      // Зупиняємо завантаження
      this.state.loading = false;
      this.state.elements.dialog.classList.remove('loading');

      // Ховаємо діалог у випадку помилки
      this.hide();
    }
  }

  /**
   * Оновлення компонентів діалогу
   * @private
   */
  _updateComponents() {
    try {
      const bonusData = this.state.bonusData;

      if (!bonusData) {
        logger.warn('Немає даних для оновлення компонентів', '_updateComponents');
        return;
      }

      // Оновлюємо компонент календаря
      if (this.state.calendarComponent) {
        this.state.calendarComponent.update({
          currentDay: bonusData.currentDay,
          specialDays: DAILY_BONUS_CONFIG.COIN_DAYS,
          cycleSize: DAILY_BONUS_CONFIG.CYCLE_DAYS,
          theme: this.options.theme,
        });
      }

      // Отримуємо дані для винагороди
      const reward = bonusData.calculateReward();

      // Оновлюємо компонент винагороди
      if (this.state.rewardComponent) {
        this.state.rewardComponent.update({
          day: bonusData.currentDay,
          tokens: reward.tokens,
          coins: reward.coins,
          isSpecialDay: reward.isSpecialDay,
          theme: this.options.theme,
        });
      }

      logger.debug('Компоненти діалогового вікна оновлено', '_updateComponents', {
        category: LOG_CATEGORIES.RENDERING,
      });
    } catch (error) {
      logger.error(error, 'Помилка оновлення компонентів', {
        category: LOG_CATEGORIES.RENDERING,
      });
    }
  }

  /**
   * Оновлення стану кнопки
   * @private
   */
  _updateButtonState() {
    try {
      const bonusData = this.state.bonusData;
      const button = this.state.elements.button;

      if (!bonusData || !button) return;

      // Перевіряємо доступність бонусу
      const availability = bonusData.checkAvailability();

      if (availability.available) {
        // Бонус доступний
        button.removeAttribute('disabled');
        button.textContent = 'ОТРИМАТИ БОНУС';
        button.classList.remove('disabled');
      } else {
        // Бонус недоступний
        button.setAttribute('disabled', 'disabled');
        button.classList.add('disabled');

        if (availability.status === DAILY_BONUS_TYPES.STATUS.CLAIMED) {
          // Вже отримано
          button.textContent = 'ВЖЕ ОТРИМАНО';

          if (availability.nextTime) {
            // Конвертуємо час у формат "через [час]"
            const nextTime = new Date(availability.nextTime);
            const now = new Date();
            const diff = Math.max(0, nextTime - now);

            if (diff > 0) {
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

              // Формуємо текст, залежно від часу
              if (hours > 0) {
                button.textContent = `ВЖЕ ОТРИМАНО (НАСТУПНИЙ ЧЕРЕЗ ${hours} ГОД ${minutes} ХВ)`;
              } else {
                button.textContent = `ВЖЕ ОТРИМАНО (НАСТУПНИЙ ЧЕРЕЗ ${minutes} ХВ)`;
              }
            }
          }
        } else {
          // Інший стан недоступності
          button.textContent = 'НЕДОСТУПНО';
        }
      }

      logger.debug('Стан кнопки оновлено', '_updateButtonState', {
        category: LOG_CATEGORIES.RENDERING,
        details: { available: availability.available, status: availability.status },
      });
    } catch (error) {
      logger.error(error, 'Помилка оновлення стану кнопки', {
        category: LOG_CATEGORIES.RENDERING,
      });
    }
  }

  /**
   * Отримання бонусу
   * @private
   */
  async _claimBonus() {
    if (this.state.claiming || this.state.loading) return;

    try {
      // Позначаємо, що триває отримання бонусу
      this.state.claiming = true;
      this.state.elements.button.setAttribute('disabled', 'disabled');
      this.state.elements.button.classList.add('claiming');
      this.state.elements.button.textContent = 'ОТРИМАННЯ...';

      // Викликаємо метод отримання бонусу
      const result = await dailyBonusService.claimDailyBonus();

      if (!result.success) {
        throw new Error(result.error || 'Помилка отримання бонусу');
      }

      // Успішно отримано бонус
      logger.info('Бонус успішно отримано', '_claimBonus', {
        category: LOG_CATEGORIES.REWARDS,
        details: {
          tokens: result.reward.tokens,
          coins: result.reward.coins,
          isCycleCompleted: result.isCycleCompleted,
        },
      });

      // Оновлюємо дані бонусу
      this.state.bonusData = await dailyBonusService.getCurrentBonus(true);

      // Анімуємо отримання бонусу в компоненті
      if (this.state.rewardComponent && this.options.showAnimation) {
        this.state.rewardComponent.animateReward(() => {
          // Анімуємо перехід до наступного дня
          if (this.state.calendarComponent) {
            this.state.calendarComponent.animateNextDay(() => {
              // Оновлюємо компоненти
              this._updateComponents();

              // Оновлюємо стан кнопки
              this._updateButtonState();

              // Викликаємо callback, якщо він є
              if (typeof this.options.onClaim === 'function') {
                this.options.onClaim(result);
              }

              // Якщо потрібно показати додаткову анімацію винагороди
              if (this.options.showAnimation) {
                this._showRewardAnimation(result);
              }

              // Закриваємо діалог, якщо потрібно
              if (this.options.closeOnClaim) {
                this.hide();
              }
            });
          } else {
            // Якщо немає компонента календаря
            this._updateComponents();
            this._updateButtonState();

            if (typeof this.options.onClaim === 'function') {
              this.options.onClaim(result);
            }

            if (this.options.showAnimation) {
              this._showRewardAnimation(result);
            }

            if (this.options.closeOnClaim) {
              this.hide();
            }
          }
        });
      } else {
        // Якщо немає компонента відображення винагороди або не потрібна анімація
        this._updateComponents();
        this._updateButtonState();

        if (typeof this.options.onClaim === 'function') {
          this.options.onClaim(result);
        }

        if (this.options.showAnimation) {
          this._showRewardAnimation(result);
        }

        if (this.options.closeOnClaim) {
          this.hide();
        }
      }
    } catch (error) {
      logger.error(error, 'Помилка отримання бонусу', {
        category: LOG_CATEGORIES.REWARDS,
      });

      // Показуємо помилку
      this.state.elements.button.classList.add('error');
      this.state.elements.button.textContent = 'ПОМИЛКА ОТРИМАННЯ';

      // Через деякий час відновлюємо стан кнопки
      setTimeout(() => {
        this.state.elements.button.classList.remove('error');
        this._updateButtonState();
      }, 2000);
    } finally {
      // Знімаємо прапорець отримання
      this.state.claiming = false;
      this.state.elements.button.classList.remove('claiming');
    }
  }

  /**
   * Показ анімації винагороди
   * @param {Object} result - Результат отримання бонусу
   * @private
   */
  _showRewardAnimation(result) {
    // Імпортуємо функцію showReward, якщо вона доступна
    try {
      // Імпортуємо модуль за допомогою динамічного імпорту
      import('../../../ui/animations/reward/display.js')
        .then((module) => {
          const showReward = module.showReward;

          // Показуємо анімацію винагороди
          showReward(
            {
              type: 'tokens',
              amount: result.reward.tokens,
            },
            {
              duration: 3000,
              autoClose: true,
              onClose: () => {
                // Якщо є жетони, показуємо їх також
                if (result.reward.coins > 0) {
                  setTimeout(() => {
                    showReward(
                      {
                        type: 'coins',
                        amount: result.reward.coins,
                      },
                      {
                        duration: 3000,
                        autoClose: true,
                        specialDay: true,
                        onClose: () => {
                          // Якщо завершено цикл і є бонус за завершення
                          if (result.isCycleCompleted && result.completionBonus) {
                            setTimeout(() => {
                              showReward(
                                {
                                  type: 'tokens',
                                  amount: result.completionBonus.tokens,
                                },
                                {
                                  duration: 3000,
                                  autoClose: true,
                                  specialDay: true,
                                }
                              );
                            }, 500);
                          }
                        },
                      }
                    );
                  }, 500);
                } else if (result.isCycleCompleted && result.completionBonus) {
                  // Якщо завершено цикл і є бонус за завершення, але немає жетонів
                  setTimeout(() => {
                    showReward(
                      {
                        type: 'tokens',
                        amount: result.completionBonus.tokens,
                      },
                      {
                        duration: 3000,
                        autoClose: true,
                        specialDay: true,
                      }
                    );
                  }, 500);
                }
              },
            }
          );

          logger.info('Показано анімацію винагороди', '_showRewardAnimation', {
            category: LOG_CATEGORIES.ANIMATION,
          });
        })
        .catch((error) => {
          logger.error(error, 'Помилка імпорту модуля анімації', {
            category: LOG_CATEGORIES.ANIMATION,
          });
        });
    } catch (error) {
      logger.error(error, 'Помилка показу анімації винагороди', {
        category: LOG_CATEGORIES.ANIMATION,
      });
    }
  }

  /**
   * Приховування діалогового вікна
   */
  hide() {
    if (!this.state.visible) return;

    try {
      // Приховуємо елементи
      this.state.elements.overlay.classList.remove('visible');
      this.state.elements.dialog.classList.remove('visible');

      // Оновлюємо стан
      this.state.visible = false;

      // Викликаємо callback, якщо він є
      if (typeof this.options.onClose === 'function') {
        this.options.onClose();
      }

      logger.info('Діалогове вікно щоденного бонусу приховано', 'hide', {
        category: LOG_CATEGORIES.UI,
      });
    } catch (error) {
      logger.error(error, 'Помилка приховування діалогового вікна', {
        category: LOG_CATEGORIES.UI,
      });

      // Все одно оновлюємо стан
      this.state.visible = false;
    }
  }

  /**
   * Очищення ресурсів
   */
  destroy() {
    try {
      // Приховуємо діалог, якщо він видимий
      if (this.state.visible) {
        this.hide();
      }

      // Видаляємо елементи з DOM
      if (this.state.elements.overlay && this.state.elements.overlay.parentNode) {
        this.state.elements.overlay.parentNode.removeChild(this.state.elements.overlay);
      }

      // Очищаємо компоненти
      if (this.state.calendarComponent) {
        this.state.calendarComponent.destroy();
      }

      if (this.state.rewardComponent) {
        this.state.rewardComponent.destroy();
      }

      // Очищаємо внутрішній стан
      this.state.initialized = false;
      this.state.elements = {};

      logger.info('Ресурси діалогового вікна очищено', 'destroy');
    } catch (error) {
      logger.error(error, 'Помилка очищення ресурсів діалогового вікна', {
        category: LOG_CATEGORIES.LOGIC,
      });
    }
  }
}

export default DailyBonusDialog;