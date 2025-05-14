/**
 * Утилітарні функції для роботи зі сховищем
 * Спрощує конфігурацію та використання стану для реферальної системи
 *
 * @module referral/utils/storeUtils
 */

/**
 * Спрощена реалізація Redux-подібного сховища
 *
 * @param {Function} reducer - Головний редуктор
 * @returns {Object} Конфігуроване сховище
 */
export const createStore = (reducer) => {
  // Поточний стан сховища
  let state = reducer(undefined, { type: '@@INIT' });

  // Масив підписників на зміни стану
  const listeners = [];

  // Повертаємо інтерфейс сховища
  return {
    // Отримання поточного стану
    getState: () => state,

    // Диспатч дій для зміни стану
    dispatch: (action) => {
      // Обчислюємо новий стан
      state = reducer(state, action);

      // Сповіщаємо всіх підписників
      listeners.forEach(listener => listener());

      return action;
    },

    // Підписка на зміни стану
    subscribe: (listener) => {
      // Додаємо підписника
      listeners.push(listener);

      // Повертаємо функцію для відписки
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    }
  };
};

/**
 * Об'єднує редуктори в один головний редуктор
 *
 * @param {Object} reducers - Об'єкт з редукторами
 * @returns {Function} Головний редуктор
 */
export const combineReducers = (reducers) => {
  // Отримуємо ключі редукторів
  const reducerKeys = Object.keys(reducers);

  // Повертаємо об'єднаний редуктор
  return (state = {}, action) => {
    // Новий стан, який буде повернено
    const nextState = {};

    // Обробляємо кожен редуктор
    for (let i = 0; i < reducerKeys.length; i++) {
      // Поточний ключ редуктора
      const key = reducerKeys[i];

      // Поточний редуктор
      const reducer = reducers[key];

      // Попередній стан для цього редуктора
      const previousStateForKey = state[key];

      // Обчислюємо новий стан для цього редуктора
      const nextStateForKey = reducer(previousStateForKey, action);

      // Зберігаємо новий стан
      nextState[key] = nextStateForKey;
    }

    return nextState;
  };
};

/**
 * Застосовує проміжне ПЗ до сховища для розширення функціональності
 *
 * @param {Function} middleware - Проміжне ПЗ для застосування
 * @returns {Function} Функція для обгортання createStore
 */
export const applyMiddleware = (middleware) => {
  return (createStore) => (reducer) => {
    // Створюємо базове сховище
    const store = createStore(reducer);

    // Створюємо розширену версію диспатчера
    const dispatch = middleware(store)(store.dispatch);

    // Повертаємо розширене сховище
    return {
      ...store,
      dispatch
    };
  };
};

/**
 * Проміжне ПЗ для підтримки асинхронних дій (thunk)
 *
 * @param {Object} store - Сховище Redux
 * @returns {Function} Розширений диспатчер
 */
export const thunkMiddleware = (store) => (next) => (action) => {
  // Якщо дія є функцією, викликаємо її і передаємо dispatch і getState
  if (typeof action === 'function') {
    return action(store.dispatch, store.getState);
  }

  // Інакше просто передаємо дію далі
  return next(action);
};

/**
 * Конфігурує сховище для реферальної системи
 *
 * @param {Object} reducers - Об'єкт з редукторами
 * @returns {Object} Сконфігуроване сховище
 */
export const configureReferralStore = (reducers) => {
  // Об'єднуємо редуктори
  const rootReducer = combineReducers(reducers);

  // Створюємо сховище з підтримкою асинхронних дій
  const storeWithMiddleware = applyMiddleware(thunkMiddleware)(createStore);

  // Повертаємо сконфігуроване сховище
  return storeWithMiddleware(rootReducer);
};

/**
 * Перевіряє чи є дія успішною (закінчується на _SUCCESS)
 *
 * @param {string} actionType - Тип дії
 * @returns {boolean} true якщо дія успішна, інакше false
 */
export const isSuccessAction = (actionType) => {
  return /_SUCCESS$/.test(actionType);
};

/**
 * Перевіряє чи є дія невдалою (закінчується на _FAILURE)
 *
 * @param {string} actionType - Тип дії
 * @returns {boolean} true якщо дія невдала, інакше false
 */
export const isFailureAction = (actionType) => {
  return /_FAILURE$/.test(actionType);
};

/**
 * Перевіряє чи є дія запитом (закінчується на _REQUEST)
 *
 * @param {string} actionType - Тип дії
 * @returns {boolean} true якщо дія є запитом, інакше false
 */
export const isRequestAction = (actionType) => {
  return /_REQUEST$/.test(actionType);
};

/**
 * Створює типи дій для асинхронних операцій
 *
 * @param {string} base - Базова назва дії
 * @returns {Object} Об'єкт з типами дій
 */
export const createAsyncActionTypes = (base) => ({
  REQUEST: `${base}_REQUEST`,
  SUCCESS: `${base}_SUCCESS`,
  FAILURE: `${base}_FAILURE`
});

/**
 * Створює творця дій для асинхронних операцій
 *
 * @param {Object} types - Об'єкт з типами дій
 * @param {Function} apiCall - Функція API для виклику
 * @returns {Function} Творець асинхронних дій
 */
export const createAsyncAction = (types, apiCall) => (...args) => async (dispatch) => {
  try {
    // Диспатч запиту
    dispatch({ type: types.REQUEST });

    // Виклик API
    const result = await apiCall(...args);

    // Диспатч успіху
    dispatch({
      type: types.SUCCESS,
      payload: result
    });

    return result;
  } catch (error) {
    // Диспатч помилки
    dispatch({
      type: types.FAILURE,
      payload: { error: error.message || 'Unknown error' }
    });

    throw error;
  }
};