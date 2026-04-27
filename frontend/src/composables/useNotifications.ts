/**
 * useNotifications — Stub de notificações PWA
 *
 * TODO: implementar quando o sistema de push for ativado
 *
 * Requer:
 *   - VAPID keys geradas no backend (web-push)
 *   - Service worker com suporte a push events
 *   - Endpoint no backend para salvar a PushSubscription
 *
 * Plataformas:
 *   - PC Windows: Chrome/Edge suportam Web Push nativamente
 *   - Android: Chrome/Firefox suportam Web Push + PWA shortcuts
 */

export function useNotifications() {
  const isSupported = "Notification" in window && "serviceWorker" in navigator;

  async function requestPermission(): Promise<boolean> {
    if (!isSupported) return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  async function subscribe(): Promise<void> {
    // TODO: obter VAPID public key do backend (GET /api/push/vapid-key)
    // TODO: registrar service worker e criar PushSubscription
    // TODO: enviar subscription para o backend (POST /api/push/subscribe)
    console.log("[useNotifications] subscribe stub — não implementado");
  }

  async function unsubscribe(): Promise<void> {
    // TODO: cancelar subscription no backend
    console.log("[useNotifications] unsubscribe stub — não implementado");
  }

  return { isSupported, requestPermission, subscribe, unsubscribe };
}
