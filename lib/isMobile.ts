export function isMobileDevice() {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent.toLowerCase();

  const mobile =
    /android|iphone|ipad|ipod|windows phone/i.test(ua);

  const standalone =
    (window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as any).standalone === true;

  return mobile || standalone;
}
