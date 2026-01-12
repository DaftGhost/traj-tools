/**
 * 辅助函数工具集
 */

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 从数组中安全移除元素
 */
export function removeFromArray<T>(arr: T[], predicate: (item: T) => boolean): boolean {
  const idx = arr.findIndex(predicate);
  if (idx !== -1) {
    arr.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * 限制数值在范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * 格式化文件名（去除扩展名）
 */
export function formatFileName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

/**
 * 获取文件扩展名（小写）
 */
export function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.([^/.]+)$/);
  return match ? match[1].toLowerCase() : "";
}
