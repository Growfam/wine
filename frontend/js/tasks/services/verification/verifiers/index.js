/**
 * Верифікатори для різних типів завдань
 *
 * Експортує верифікатори для всіх підтримуваних типів завдань
 */

import { BaseVerifier } from 'js/tasks/services/verification/verifiers/base-verifier.js';
import { SocialVerifier } from 'js/tasks/services/verification/verifiers/social-verifier.js';
import { LimitedVerifier } from 'js/tasks/services/verification/verifiers/limited-verifier.js';
import { PartnerVerifier } from 'js/tasks/services/verification/verifiers/partner-verifier.js';
import { GenericVerifier } from 'js/tasks/services/verification/verifiers/generic-verifier.js';

// Створюємо і експортуємо екземпляри верифікаторів
export const verifiers = {
  // Верифікатори для конкретних типів завдань
  social: new SocialVerifier(),
  limited: new LimitedVerifier(),
  partner: new PartnerVerifier(),
  referral: new SocialVerifier(), // Реферальні завдання використовують соціальний верифікатор

  // Загальний верифікатор для невідомих типів
  generic: new GenericVerifier(),
};

// Експорт класів верифікаторів
export { BaseVerifier, SocialVerifier, LimitedVerifier, PartnerVerifier, GenericVerifier };
