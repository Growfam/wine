/**
 * Верифікатори для різних типів завдань
 *
 * Експортує верифікатори для всіх підтримуваних типів завдань
 */

import { BaseVerifier } from './base-verifier';
import { SocialVerifier } from './social-verifier';
import { LimitedVerifier } from './limited-verifier';
import { PartnerVerifier } from './partner-verifier';
import { GenericVerifier } from './generic-verifier';

// Створюємо і експортуємо екземпляри верифікаторів
export const verifiers = {
  // Верифікатори для конкретних типів завдань
  social: new SocialVerifier(),
  limited: new LimitedVerifier(),
  partner: new PartnerVerifier(),
  referral: new SocialVerifier(), // Реферальні завдання використовують соціальний верифікатор

  // Загальний верифікатор для невідомих типів
  generic: new GenericVerifier()
};

// Експорт класів верифікаторів
export {
  BaseVerifier,
  SocialVerifier,
  LimitedVerifier,
  PartnerVerifier,
  GenericVerifier
};