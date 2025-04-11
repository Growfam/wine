/**
 * participants.js - Модуль для роботи з учасниками розіграшів
 * Надає функції для управління та аналізу учасників розіграшів
 */

import WinixAPI, { adminAPI } from './api.js';
import { showToast } from '../utils/ui-helpers.js';
import { formatDate } from '../utils/formatters.js';

/**
 * Клас для роботи з учасниками розіграшів
 * @class RaffleParticipants
 */
class RaffleParticipants {
    /**
     * Конструктор
     */
    constructor() {
        this._isLoading = false;
        this._participantsCache = {};
        this._currentRaffleId = null;
    }

    /**
     * Отримання учасників розіграшу
     * @param {string} raffleId - ID розіграшу
     * @param {boolean} forceRefresh - Примусове оновлення даних
     * @returns {Promise<Object>} - Дані учасників
     */
    async getRaffleParticipants(raffleId, forceRefresh = false) {
        if (!raffleId) {
            console.error('ID розіграшу не вказано');
            return null;
        }

        // Перевіряємо кеш, якщо оновлення не примусове
        if (!forceRefresh && this._participantsCache[raffleId]) {
            return this._participantsCache[raffleId];
        }

        if (this._isLoading) {
            console.log("⏳ RaffleParticipants: Завантаження вже виконується");
            return null;
        }

        this._isLoading = true;
        this._showLoader();

        try {
            // Перевіряємо, чи є доступ до адмін API
            if (adminAPI.getAdminId()) {
                // Якщо є доступ адміністратора, використовуємо адмін API
                const response = await adminAPI.apiRequest(`/raffles/${raffleId}/participants`, 'GET');

                this._isLoading = false;
                this._hideLoader();

                if (response.status === 'success') {
                    // Кешуємо результат
                    this._participantsCache[raffleId] = response.data;
                    this._currentRaffleId = raffleId;
                    return response.data;
                } else {
                    throw new Error(response.message || 'Помилка отримання учасників розіграшу');
                }
            } else {
                // Якщо немає доступу адміністратора, використовуємо звичайний API
                const userId = WinixAPI.getUserId();
                if (!userId) {
                    throw new Error('ID користувача не знайдено');
                }

                const response = await WinixAPI.apiRequest(`/raffles/${raffleId}/participants`, 'GET');

                this._isLoading = false;
                this._hideLoader();

                if (response.status === 'success') {
                    // Кешуємо результат
                    this._participantsCache[raffleId] = response.data;
                    this._currentRaffleId = raffleId;
                    return response.data;
                } else {
                    throw new Error(response.message || 'Помилка отримання учасників розіграшу');
                }
            }
        } catch (error) {
            console.error(`❌ Помилка отримання учасників розіграшу ${raffleId}:`, error);
            this._isLoading = false;
            this._hideLoader();
            showToast('Помилка завантаження учасників: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Додавання нового учасника (для адміністраторів)
     * @param {string} raffleId - ID розіграшу
     * @param {string} userId - ID користувача
     * @param {number} entryCount - Кількість жетонів
     * @returns {Promise<Object>} - Результат додавання
     */
    async addParticipant(raffleId, userId, entryCount = 1) {
        if (!raffleId || !userId) {
            showToast('ID розіграшу або користувача не вказано', 'error');
            return null;
        }

        // Перевіряємо, чи є доступ до адмін API
        if (!adminAPI.getAdminId()) {
            showToast('Недостатньо прав для виконання цієї дії', 'error');
            return null;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}/participants`, 'POST', {
                user_id: userId,
                entry_count: entryCount
            });

            this._hideLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._participantsCache[raffleId];

                showToast('Учасника успішно додано', 'success');
                return response.data;
            } else {
                throw new Error(response.message || 'Помилка додавання учасника');
            }
        } catch (error) {
            console.error(`❌ Помилка додавання учасника до розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка додавання учасника: ' + error.message, 'error');
            return null;
        }
    }

    /**
     * Видалення учасника (для адміністраторів)
     * @param {string} raffleId - ID розіграшу
     * @param {string} participantId - ID учасника
     * @returns {Promise<boolean>} - Результат видалення
     */
    async removeParticipant(raffleId, participantId) {
        if (!raffleId || !participantId) {
            showToast('ID розіграшу або учасника не вказано', 'error');
            return false;
        }

        // Перевіряємо, чи є доступ до адмін API
        if (!adminAPI.getAdminId()) {
            showToast('Недостатньо прав для виконання цієї дії', 'error');
            return false;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}/participants/${participantId}`, 'DELETE');

            this._hideLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._participantsCache[raffleId];

                showToast('Учасника успішно видалено', 'success');
                return true;
            } else {
                throw new Error(response.message || 'Помилка видалення учасника');
            }
        } catch (error) {
            console.error(`❌ Помилка видалення учасника з розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка видалення учасника: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Повернення жетонів учаснику (для адміністраторів)
     * @param {string} raffleId - ID розіграшу
     * @param {string} participantId - ID учасника
     * @returns {Promise<boolean>} - Результат повернення
     */
    async refundParticipant(raffleId, participantId) {
        if (!raffleId || !participantId) {
            showToast('ID розіграшу або учасника не вказано', 'error');
            return false;
        }

        // Перевіряємо, чи є доступ до адмін API
        if (!adminAPI.getAdminId()) {
            showToast('Недостатньо прав для виконання цієї дії', 'error');
            return false;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}/participants/${participantId}/refund`, 'POST');

            this._hideLoader();

            if (response.status === 'success') {
                // Очищаємо кеш для цього розіграшу
                delete this._participantsCache[raffleId];

                showToast('Жетони успішно повернуто учаснику', 'success');
                return true;
            } else {
                throw new Error(response.message || 'Помилка повернення жетонів');
            }
        } catch (error) {
            console.error(`❌ Помилка повернення жетонів учаснику ${participantId}:`, error);
            this._hideLoader();
            showToast('Помилка повернення жетонів: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Отримання переможців розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Array>} - Список переможців
     */
    async getRaffleWinners(raffleId) {
        if (!raffleId) {
            console.error('ID розіграшу не вказано');
            return null;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await WinixAPI.apiRequest(`/raffles/${raffleId}/winners`, 'GET');

            this._hideLoader();

            if (response.status === 'success') {
                return response.data || [];
            } else {
                throw new Error(response.message || 'Помилка отримання переможців розіграшу');
            }
        } catch (error) {
            console.error(`❌ Помилка отримання переможців розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка завантаження переможців: ' + error.message, 'error');
            return [];
        }
    }

    /**
     * Оновлення переможців розіграшу (для адміністраторів)
     * @param {string} raffleId - ID розіграшу
     * @param {Array} winners - Список переможців
     * @returns {Promise<boolean>} - Результат оновлення
     */
    async updateRaffleWinners(raffleId, winners) {
        if (!raffleId || !Array.isArray(winners)) {
            showToast('ID розіграшу не вказано або некоректний формат переможців', 'error');
            return false;
        }

        // Перевіряємо, чи є доступ до адмін API
        if (!adminAPI.getAdminId()) {
            showToast('Недостатньо прав для виконання цієї дії', 'error');
            return false;
        }

        this._showLoader();

        try {
            // Виконуємо запит
            const response = await adminAPI.apiRequest(`/raffles/${raffleId}/winners`, 'PUT', { winners });

            this._hideLoader();

            if (response.status === 'success') {
                showToast('Переможців успішно оновлено', 'success');
                return true;
            } else {
                throw new Error(response.message || 'Помилка оновлення переможців');
            }
        } catch (error) {
            console.error(`❌ Помилка оновлення переможців розіграшу ${raffleId}:`, error);
            this._hideLoader();
            showToast('Помилка оновлення переможців: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Експорт учасників розіграшу в CSV
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<boolean>} - Результат експорту
     */
    async exportParticipantsToCSV(raffleId) {
        // Отримуємо дані учасників
        const result = await this.getRaffleParticipants(raffleId);
        if (!result || !result.participants || !Array.isArray(result.participants)) {
            showToast('Немає даних для експорту', 'error');
            return false;
        }

        try {
            const { raffle, participants } = result;

            // Генеруємо CSV
            let csv = 'Номер,Користувач,Telegram ID,Жетони,Дата участі,Статус\n';

            participants.forEach((participant, index) => {
                const statusText =
                    participant.is_winner ? 'Переможець' :
                    participant.status === 'refunded' ? 'Повернуто' :
                    'Учасник';

                const entryTimeStr = formatDate(participant.entry_time);

                csv += `${index + 1},"${participant.username}",${participant.telegram_id},${participant.entry_count},"${entryTimeStr}","${statusText}"\n`;
            });

            // Створюємо посилання для завантаження
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `raffle-participants-${raffleId}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Дані учасників успішно експортовано', 'success');
            return true;
        } catch (error) {
            console.error(`❌ Помилка експорту учасників розіграшу ${raffleId}:`, error);
            showToast('Помилка експорту даних: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Аналіз учасників розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Аналітичні дані
     */
    async analyzeParticipants(raffleId) {
        // Отримуємо дані учасників
        const result = await this.getRaffleParticipants(raffleId);
        if (!result || !result.participants || !Array.isArray(result.participants)) {
            return null;
        }

        try {
            const { raffle, participants } = result;

            // Базова аналітика
            const totalParticipants = participants.length;
            const totalTokens = participants.reduce((sum, p) => sum + (p.entry_count || 0), 0);
            const avgTokensPerParticipant = totalParticipants > 0 ? totalTokens / totalParticipants : 0;

            // Статистика за статусами
            const statusStats = {
                active: participants.filter(p => !p.is_winner && p.status !== 'refunded').length,
                winners: participants.filter(p => p.is_winner).length,
                refunded: participants.filter(p => p.status === 'refunded').length
            };

            // Аналіз часу участі
            const entryTimeStats = this._analyzeEntryTimes(participants);

            // Топ учасників за кількістю жетонів
            const topParticipants = [...participants]
                .sort((a, b) => (b.entry_count || 0) - (a.entry_count || 0))
                .slice(0, 5);

            return {
                raffle_id: raffleId,
                raffle_title: raffle.title,
                total_participants: totalParticipants,
                total_tokens: totalTokens,
                avg_tokens_per_participant: avgTokensPerParticipant.toFixed(2),
                status_stats: statusStats,
                entry_time_stats: entryTimeStats,
                top_participants: topParticipants
            };
        } catch (error) {
            console.error(`❌ Помилка аналізу учасників розіграшу ${raffleId}:`, error);
            return null;
        }
    }

    /**
     * Аналіз часу участі
     * @param {Array} participants - Список учасників
     * @returns {Object} - Аналітичні дані по часу
     * @private
     */
    _analyzeEntryTimes(participants) {
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            return {};
        }

        // Отримуємо дати участі
        const entryDates = participants
            .filter(p => p.entry_time)
            .map(p => new Date(p.entry_time));

        if (entryDates.length === 0) {
            return {};
        }

        // Перший і останній учасник
        const firstEntry = new Date(Math.min(...entryDates));
        const lastEntry = new Date(Math.max(...entryDates));

        // Розподіл за днями тижня
        const dayOfWeekStats = [0, 0, 0, 0, 0, 0, 0]; // Пн, Вт, Ср, Чт, Пт, Сб, Нд

        // Розподіл за годинами доби
        const hourStats = Array(24).fill(0);

        // Заповнюємо статистику
        entryDates.forEach(date => {
            const dayOfWeek = date.getDay(); // 0 - неділя, 1 - понеділок, ...
            const hour = date.getHours();

            // Корегуємо день тижня (0 - понеділок, 6 - неділя)
            const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            dayOfWeekStats[adjustedDay]++;
            hourStats[hour]++;
        });

        // Знаходимо найпопулярніший день тижня
        const maxDayIndex = dayOfWeekStats.indexOf(Math.max(...dayOfWeekStats));
        const daysOfWeek = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];
        const mostPopularDay = daysOfWeek[maxDayIndex];

        // Знаходимо найпопулярнішу годину
        const maxHourIndex = hourStats.indexOf(Math.max(...hourStats));
        const mostPopularHour = `${maxHourIndex}:00 - ${maxHourIndex}:59`;

        return {
            first_entry: formatDate(firstEntry),
            last_entry: formatDate(lastEntry),
            duration_days: Math.ceil((lastEntry - firstEntry) / (1000 * 60 * 60 * 24)),
            most_popular_day: mostPopularDay,
            most_popular_hour: mostPopularHour,
            day_of_week_stats: dayOfWeekStats.map((count, index) => ({
                day: daysOfWeek[index],
                count
            })),
            hour_stats: hourStats.map((count, hour) => ({
                hour: `${hour}:00`,
                count
            }))
        };
    }

    /**
     * Показ індикатора завантаження
     * @private
     */
    _showLoader() {
        if (typeof window.showLoading === 'function') {
            window.showLoading('Завантаження...');
        }
    }

    /**
     * Приховування індикатора завантаження
     * @private
     */
    _hideLoader() {
        if (typeof window.hideLoading === 'function') {
            window.hideLoading();
        }
    }
}

// Експортуємо екземпляр класу
export default new RaffleParticipants();