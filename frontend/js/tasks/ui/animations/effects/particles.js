/**
 * Particles - модуль для роботи з анімаціями часток
 * Відповідає за:
 * - Створення анімованих часток для ефектів
 * - Конфетті та святкові ефекти
 * - Візуальні ефекти для виділення взаємодії
 *
 * @version 1.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils';
import { config } from '../core.js';

// Створюємо логер для модуля
const logger = getLogger('UI.Animations.Effects.Particles');

/**
 * Створення часток для анімації успіху
 * @param {HTMLElement} element - Елемент для анімації
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function createSuccessParticles(element, options = {}) {
  if (!element) return false;

  try {
    // Отримуємо розміри та позицію елемента
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Налаштування за замовчуванням
    const settings = {
      count: window.innerWidth < 768 ? 8 : 15,
      colors: config.particleColors || ['#4EB5F7', '#00C9A7', '#AD6EE5', '#FFD700', '#52C0BD'],
      minSize: 4,
      maxSize: 10,
      duration: [500, 1500],
      ...options,
    };

    logger.debug(
      `Створення ${settings.count} часток для анімації успіху`,
      'createSuccessParticles',
      {
        category: LOG_CATEGORIES.ANIMATION,
        details: {
          centerX,
          centerY,
        },
      }
    );

    // Створюємо частки
    for (let i = 0; i < settings.count; i++) {
      createSingleParticle(centerX, centerY, settings);
    }

    return true;
  } catch (error) {
    logger.error(error, 'Помилка при створенні часток успіху', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Створення однієї частки з анімацією
 * @param {number} centerX - X-координата центру
 * @param {number} centerY - Y-координата центру
 * @param {Object} settings - Налаштування анімації
 * @returns {HTMLElement} Створений елемент частки
 */
function createSingleParticle(centerX, centerY, settings) {
  try {
    // Створюємо елемент частки
    const particle = document.createElement('div');

    // Визначаємо розмір частки
    const size = Math.random() * (settings.maxSize - settings.minSize) + settings.minSize;

    // Отримуємо випадковий колір
    const color = settings.colors[Math.floor(Math.random() * settings.colors.length)];

    // Встановлюємо стилі
    particle.style.position = 'fixed';
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.borderRadius =
      Math.random() > 0.5 ? '50%' : `${Math.floor(Math.random() * 4) + 2}px`;
    particle.style.top = `${centerY}px`;
    particle.style.left = `${centerX}px`;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    particle.style.transform = 'translate(-50%, -50%)';

    // Додаємо до документу
    document.body.appendChild(particle);

    // Параметри анімації
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 100 + 50;

    // Визначаємо тривалість анімації
    const duration = Array.isArray(settings.duration)
      ? Math.random() * (settings.duration[1] - settings.duration[0]) + settings.duration[0]
      : settings.duration;

    // Створюємо анімацію
    const animation = particle.animate(
      [
        {
          transform: 'translate(-50%, -50%) scale(0.3)',
          opacity: 1,
        },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(1) rotate(${Math.random() * 360}deg)`,
          opacity: 0,
        },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
        fill: 'forwards',
      }
    );

    // Видаляємо частку після завершення анімації
    animation.onfinish = () => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    };

    return particle;
  } catch (error) {
    logger.error(error, 'Помилка при створенні частки', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return null;
  }
}

/**
 * Створення ефекту конфетті
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function createConfetti(options = {}) {
  try {
    // Налаштування за замовчуванням
    const settings = {
      count: 100,
      colors: ['#4EB5F7', '#00C9A7', '#AD6EE5', '#FFD700', '#FF5252', '#52C0BD'],
      spread: {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.3,
      },
      origin: {
        x: window.innerWidth / 2,
        y: window.innerHeight / 4,
      },
      shapes: ['circle', 'square', 'triangle', 'line'],
      sizes: [8, 12, 15],
      duration: 2500,
      ...options,
    };

    // Створюємо контейнер для конфетті (для кращої продуктивності)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    document.body.appendChild(container);

    // Створюємо конфетті
    for (let i = 0; i < settings.count; i++) {
      createConfettiParticle(container, settings);
    }

    // Видаляємо контейнер після завершення анімації
    setTimeout(() => {
      if (container.parentNode) {
        // Плавне зникнення
        container.style.transition = 'opacity 1s ease';
        container.style.opacity = '0';

        setTimeout(() => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }, 1000);
      }
    }, settings.duration);

    return true;
  } catch (error) {
    logger.error(error, 'Помилка при створенні конфетті', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Створення частки конфетті
 * @param {HTMLElement} container - Контейнер для частки
 * @param {Object} settings - Налаштування анімації
 * @returns {HTMLElement} Створений елемент частки
 */
function createConfettiParticle(container, settings) {
  try {
    // Створюємо елемент частки
    const particle = document.createElement('div');

    // Визначаємо форму частки
    const shape = settings.shapes[Math.floor(Math.random() * settings.shapes.length)];

    // Визначаємо розмір частки
    const size = settings.sizes[Math.floor(Math.random() * settings.sizes.length)];

    // Отримуємо випадковий колір
    const color = settings.colors[Math.floor(Math.random() * settings.colors.length)];

    // Встановлюємо стилі
    particle.style.position = 'absolute';
    particle.style.width = `${size}px`;
    particle.style.height = shape === 'line' ? `${Math.random() * 5 + 2}px` : `${size}px`;
    particle.style.backgroundColor = color;

    // Застосовуємо різні форми
    switch (shape) {
      case 'circle':
        particle.style.borderRadius = '50%';
        break;
      case 'square':
        particle.style.borderRadius = '0';
        break;
      case 'triangle':
        particle.style.width = '0';
        particle.style.height = '0';
        particle.style.backgroundColor = 'transparent';
        particle.style.borderLeft = `${size / 2}px solid transparent`;
        particle.style.borderRight = `${size / 2}px solid transparent`;
        particle.style.borderBottom = `${size}px solid ${color}`;
        break;
      case 'line':
        particle.style.borderRadius = `${Math.floor(Math.random() * 2) + 1}px`;
        break;
    }

    // Початкова позиція
    const startX = settings.origin.x;
    const startY = settings.origin.y;
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;

    // Додаємо до контейнера
    container.appendChild(particle);

    // Параметри анімації
    const angleXY = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 3 + 2;
    const rotateSpeed = Math.random() * 360 - 180;

    // Цільова позиція
    const targetX = startX + Math.cos(angleXY) * settings.spread.x * (Math.random() * 0.7 + 0.3);
    const targetY =
      startY +
      Math.sin(angleXY) * settings.spread.y * (Math.random() * 0.7 + 0.3) +
      settings.spread.y * 2;

    // Фізика падіння
    const gravity = 0.15;
    let x = startX;
    let y = startY;
    let vx = Math.cos(angleXY) * velocity;
    let vy = Math.sin(angleXY) * velocity;
    let rotation = 0;

    // Функція анімації
    const animateParticle = () => {
      // Оновлюємо позицію
      x += vx;
      y += vy;
      vy += gravity;
      rotation += rotateSpeed / 30;

      // Оновлюємо стилі
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.transform = `rotate(${rotation}deg)`;

      // Перевіряємо, чи частка все ще в межах екрану
      if (y < window.innerHeight + 100) {
        requestAnimationFrame(animateParticle);
      } else if (particle.parentNode) {
        // Видаляємо частку, коли вона виходить за межі екрану
        particle.parentNode.removeChild(particle);
      }
    };

    // Запускаємо анімацію з невеликою затримкою для створення ефекту
    setTimeout(() => {
      requestAnimationFrame(animateParticle);
    }, Math.random() * 500);

    return particle;
  } catch (error) {
    logger.error(error, 'Помилка при створенні частки конфетті', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return null;
  }
}

/**
 * Створення ефекту зірок (спеціальна анімація для винагород)
 * @param {HTMLElement} targetElement - Цільовий елемент або координати
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function createStarsEffect(targetElement, options = {}) {
  try {
    // Визначаємо центр для анімації
    let centerX, centerY;

    if (targetElement instanceof HTMLElement) {
      const rect = targetElement.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    } else if (
      typeof targetElement === 'object' &&
      targetElement.x !== undefined &&
      targetElement.y !== undefined
    ) {
      centerX = targetElement.x;
      centerY = targetElement.y;
    } else {
      centerX = window.innerWidth / 2;
      centerY = window.innerHeight / 2;
    }

    // Налаштування за замовчуванням
    const settings = {
      count: 12,
      colors: ['#FFD700', '#FFEB3B', '#FFC107', '#FF9800'],
      minSize: 10,
      maxSize: 24,
      duration: [1000, 2500],
      shapes: ['star'],
      ...options,
    };

    // Створюємо зірки
    for (let i = 0; i < settings.count; i++) {
      createStarParticle(centerX, centerY, settings);
    }

    return true;
  } catch (error) {
    logger.error(error, 'Помилка при створенні ефекту зірок', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Створення частки зірки
 * @param {number} centerX - X-координата центру
 * @param {number} centerY - Y-координата центру
 * @param {Object} settings - Налаштування анімації
 * @returns {HTMLElement} Створений елемент частки
 */
function createStarParticle(centerX, centerY, settings) {
  try {
    // Створюємо елемент для зірки
    const star = document.createElement('div');

    // Визначаємо розмір зірки
    const size = Math.random() * (settings.maxSize - settings.minSize) + settings.minSize;

    // Визначаємо колір зірки
    const color = settings.colors[Math.floor(Math.random() * settings.colors.length)];

    // Створюємо SVG для зірки
    const starSVG = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>`;

    // Встановлюємо стилі
    star.style.position = 'fixed';
    star.style.top = `${centerY}px`;
    star.style.left = `${centerX}px`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.transform = 'translate(-50%, -50%)';
    star.style.zIndex = '9999';
    star.style.pointerEvents = 'none';
    star.innerHTML = starSVG;

    // Додаємо до документу
    document.body.appendChild(star);

    // Параметри анімації
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 120 + 60;
    const duration = Array.isArray(settings.duration)
      ? Math.random() * (settings.duration[1] - settings.duration[0]) + settings.duration[0]
      : settings.duration;

    // Анімація руху та обертання
    star.animate(
      [
        {
          transform: 'translate(-50%, -50%) scale(0) rotate(0deg)',
          opacity: 0,
        },
        {
          transform: 'translate(-50%, -50%) scale(1.2) rotate(180deg)',
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0.8) rotate(${Math.random() * 360 + 180}deg)`,
          opacity: 0,
        },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
        fill: 'forwards',
      }
    ).onfinish = () => {
      if (star.parentNode) {
        star.parentNode.removeChild(star);
      }
    };

    return star;
  } catch (error) {
    logger.error(error, 'Помилка при створенні зірки', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return null;
  }
}

/**
 * Створення ефекту дощу з емодзі
 * @param {string|Array} emoji - Емодзі для анімації
 * @param {Object} options - Налаштування анімації
 * @returns {boolean} Успішність операції
 */
export function createEmojiRain(emoji = '🎉', options = {}) {
  try {
    // Перетворюємо одиничний емодзі на масив
    const emojiArray = Array.isArray(emoji) ? emoji : [emoji];

    // Налаштування за замовчуванням
    const settings = {
      count: 30,
      duration: 4000,
      sizes: [20, 24, 30, 36],
      ...options,
    };

    // Створюємо контейнер
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    document.body.appendChild(container);

    // Створюємо емодзі
    for (let i = 0; i < settings.count; i++) {
      setTimeout(() => {
        createEmojiParticle(container, emojiArray, settings);
      }, Math.random() * 2000);
    }

    // Видаляємо контейнер після завершення анімації
    setTimeout(() => {
      if (container.parentNode) {
        container.style.transition = 'opacity 1s ease';
        container.style.opacity = '0';

        setTimeout(() => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }, 1000);
      }
    }, settings.duration);

    return true;
  } catch (error) {
    logger.error(error, 'Помилка при створенні дощу з емодзі', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return false;
  }
}

/**
 * Створення частки емодзі
 * @param {HTMLElement} container - Контейнер для частки
 * @param {Array} emojiArray - Масив емодзі
 * @param {Object} settings - Налаштування анімації
 * @returns {HTMLElement} Створений елемент частки
 */
function createEmojiParticle(container, emojiArray, settings) {
  try {
    // Створюємо елемент для емодзі
    const emojiElement = document.createElement('div');

    // Вибираємо випадковий емодзі
    const randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

    // Визначаємо розмір
    const size = settings.sizes[Math.floor(Math.random() * settings.sizes.length)];

    // Визначаємо початкову позицію
    const startX = Math.random() * window.innerWidth;
    const startY = -50;

    // Встановлюємо стилі
    emojiElement.style.position = 'absolute';
    emojiElement.style.left = `${startX}px`;
    emojiElement.style.top = `${startY}px`;
    emojiElement.style.fontSize = `${size}px`;
    emojiElement.style.zIndex = '9999';
    emojiElement.style.pointerEvents = 'none';
    emojiElement.textContent = randomEmoji;

    // Додаємо до контейнера
    container.appendChild(emojiElement);

    // Параметри анімації
    const duration = Math.random() * 3000 + 2000;
    const horizontalSwing = Math.random() * 100 - 50;
    const rotateDirection = Math.random() > 0.5 ? 1 : -1;
    const rotateAmount = Math.random() * 360 * rotateDirection;

    // Рух униз
    emojiElement.animate(
      [
        {
          transform: 'translateY(0) rotate(0deg)',
          opacity: 1,
        },
        {
          transform: `translateY(${window.innerHeight + 100}px) translateX(${horizontalSwing}px) rotate(${rotateAmount}deg)`,
          opacity: 0.7,
        },
      ],
      {
        duration,
        easing: 'ease-in',
        fill: 'forwards',
      }
    ).onfinish = () => {
      if (emojiElement.parentNode) {
        emojiElement.parentNode.removeChild(emojiElement);
      }
    };

    return emojiElement;
  } catch (error) {
    logger.error(error, 'Помилка при створенні частки емодзі', {
      category: LOG_CATEGORIES.ANIMATION,
    });
    return null;
  }
}

// Публічний API
const particles = {
  createSuccessParticles,
  createConfetti,
  createStarsEffect,
  createEmojiRain,
};

export default particles;
