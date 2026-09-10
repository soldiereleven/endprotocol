export interface InAppBrowserState {
  url: string;
  isOpen: boolean;
}

let currentUrl = "";
let isOpen = false;
let isSuspended = false;
let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((fn) => fn());
}

export function getInAppBrowserUrl(): string {
  return currentUrl;
}

export function isBrowserOpen(): boolean {
  return isOpen;
}

export function isBrowserSuspended(): boolean {
  return isSuspended;
}

export function openInAppBrowser(url: string) {
  currentUrl = url;
  isOpen = true;
  isSuspended = false;
  emit();
}

export function closeInAppBrowser() {
  isOpen = false;
  isSuspended = false;
  currentUrl = "";
  emit();
}

export function suspendInAppBrowser() {
  if (isOpen) {
    isSuspended = true;
    isOpen = false;
    emit();
  }
}

export function resumeInAppBrowser() {
  if (isSuspended && currentUrl) {
    isOpen = true;
    isSuspended = false;
    emit();
  }
}

export function navigateInAppBrowser(url: string) {
  currentUrl = url;
  emit();
}

export function subscribeInAppBrowser(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
