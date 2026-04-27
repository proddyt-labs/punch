/**
 * notify.ts — Stub de notificações push
 *
 * TODO: implementar sistema de notificações
 *
 * Alvos:
 *   - PC (Windows): Web Push API via PWA service worker (VAPID)
 *   - Mobile (Android): Web Push / Firebase Cloud Messaging (FCM)
 *
 * Eventos planejados:
 *   - "Esqueceu de bater saída" — CLOCK_IN sem CLOCK_OUT após X horas
 *   - Lembrete diário de ponto (configurável por usuário)
 *   - Resumo semanal automático
 *
 * Dependências necessárias quando for implementar:
 *   - web-push (npm install web-push)
 *   - node-cron (npm install node-cron)
 *   - Tabela PushSubscription no banco (userId, endpoint, keys)
 */

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Envia notificação push para um usuário específico.
 * Stub — não faz nada ainda.
 */
export async function sendPushNotification(
  _userId: string,
  _payload: NotificationPayload
): Promise<void> {
  // TODO: buscar PushSubscription do usuário no banco
  // TODO: usar web-push para disparar a notificação
  console.log("[notify] push stub — não implementado ainda");
}

/**
 * Agenda um lembrete recorrente para um usuário.
 * Stub — não faz nada ainda.
 */
export async function scheduleReminder(
  _userId: string,
  _cronExpression: string,
  _payload: NotificationPayload
): Promise<void> {
  // TODO: usar node-cron para agendar
  console.log("[notify] schedule stub — não implementado ainda");
}
