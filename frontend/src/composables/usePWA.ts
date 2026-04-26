import { ref, onMounted } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const isInstallable = ref(false);
const isInstalled = ref(false);
const isIOS = ref(false);

export function usePWA() {
  onMounted(() => {
    // Detecta iOS
    isIOS.value = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

    // Detecta se já está instalado (standalone)
    isInstalled.value =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (!isInstalled.value) {
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt.value = e as BeforeInstallPromptEvent;
        isInstallable.value = true;
      });

      window.addEventListener("appinstalled", () => {
        isInstalled.value = true;
        isInstallable.value = false;
        deferredPrompt.value = null;
      });
    }
  });

  async function install() {
    if (!deferredPrompt.value) return;
    await deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    if (outcome === "accepted") {
      isInstalled.value = true;
      isInstallable.value = false;
    }
    deferredPrompt.value = null;
  }

  return { isInstallable, isInstalled, isIOS, install };
}
