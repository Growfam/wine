/**
 * Статуси верифікації
 *
 * Визначає можливі статуси верифікації завдань
 */

// Статуси верифікації
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILURE: 'failure',
  ERROR: 'error',
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
};

export default VERIFICATION_STATUS;
