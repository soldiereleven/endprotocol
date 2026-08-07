import clsx from "clsx";

export function cn(...inputs: Parameters<typeof clsx>[]) {
  return clsx(...inputs);
}
