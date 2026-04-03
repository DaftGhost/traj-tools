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
export function removeFromArray<T>(
  arr: T[],
  predicate: (item: T) => boolean
): boolean {
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
  return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * 获取文件扩展名（小写）
 */
export function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.([^/.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * 交换字符串中的左右方向词
 * Swaps left/right directional words in a string for reversed routes
 *
 * @param str - 输入字符串
 * @returns 交换后的字符串
 *
 * @example
 * swapLeftRight("road_left") // returns "road_right"
 * swapLeftRight("右转弯") // returns "左转弯"
 * swapLeftRight("N_S_route") // returns "N_S_route" (no change)
 */
export function swapLeftRight(str: string): string {
  // Use placeholders that don't contain "left", "right", "左", or "右"
  const TEMP_L_LOWER = '\x01\x02\x03__AAAA__\x03\x02\x01';
  const TEMP_L_UPPER = '\x01\x02\x03__BBBB__\x03\x02\x01';
  const TEMP_L_TITLE = '\x01\x02\x03__CCCC__\x03\x02\x01';
  const TEMP_CN_L = '\x01\x02\x03__DDDD__\x03\x02\x01';

  // Step 1: Replace all 'left' variations with unique placeholders
  let result = str
    .replace(/left/g, TEMP_L_LOWER)
    .replace(/LEFT/g, TEMP_L_UPPER)
    .replace(/Left/g, TEMP_L_TITLE);

  // Step 2: Replace all 'right' variations with 'left' (preserving case)
  result = result
    .replace(/right/g, 'left')
    .replace(/RIGHT/g, 'LEFT')
    .replace(/Right/g, 'Left');

  // Step 3: Replace placeholders with 'right' (preserving case)
  result = result
    .replace(new RegExp(escapeRegExp(TEMP_L_LOWER), 'g'), 'right')
    .replace(new RegExp(escapeRegExp(TEMP_L_UPPER), 'g'), 'RIGHT')
    .replace(new RegExp(escapeRegExp(TEMP_L_TITLE), 'g'), 'Right');

  // Step 4: Swap Chinese characters
  result = result
    .replace(/左/g, TEMP_CN_L)
    .replace(/右/g, '左')
    .replace(new RegExp(escapeRegExp(TEMP_CN_L), 'g'), '右');

  return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
