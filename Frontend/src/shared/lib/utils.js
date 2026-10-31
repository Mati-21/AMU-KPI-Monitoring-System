import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_URL } from '../api/axios';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getFileUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url}`;
}

/**
 * Dispatches a custom event and updates localStorage to notify other open tabs
 * or components that report-related data has changed.
 */
export const emitReportDataChanged = () => {
  const timestamp = String(Date.now());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('amu:report-data-changed', { detail: { timestamp } }));
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('amu:report-data-changed', timestamp);
  }
};

