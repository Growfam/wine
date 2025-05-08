/**
 * Модуль моделей даних API завдань
 *
 * Експортує моделі даних для роботи з API:
 * - Типи завдань
 * - Статуси завдань
 * - Параметри завдань
 *
 * @version 3.1.0
 */

import taskTypesModel, {
    TASK_TYPES,
    TASK_STATUSES,
    TASK_TYPE_PROPERTIES,
    VERIFICATION_ACTIONS,
    VERIFICATION_ACTION_PARAMS
} from './task-types.js';

export {
    taskTypesModel,
    TASK_TYPES,
    TASK_STATUSES,
    TASK_TYPE_PROPERTIES,
    VERIFICATION_ACTIONS,
    VERIFICATION_ACTION_PARAMS
};

export default {
    types: taskTypesModel,
    taskTypes: TASK_TYPES,
    taskStatuses: TASK_STATUSES,
    typeProperties: TASK_TYPE_PROPERTIES,
    verificationActions: VERIFICATION_ACTIONS,
    verificationParams: VERIFICATION_ACTION_PARAMS
};