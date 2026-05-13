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
