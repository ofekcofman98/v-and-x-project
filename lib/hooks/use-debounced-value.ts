/**
 * useDebouncedValue Hook
 * Debounces a value to prevent excessive re-renders or expensive operations
 * Based on: docs/10_PERFORMANCE.md §3.3
 */

import { useEffect, useState } from 'react';

/**
 * Debounce a value - only updates after the specified delay with no changes
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds before updating (default: 300)
 * @returns The debounced value
 * 
 * @example
 * ```tsx
 * function SearchTable() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
 * 
 *   // Only triggers expensive search after 300ms of no typing
 *   const results = useSearchResults(debouncedSearchTerm);
 * 
 *   return (
 *     <input
 *       value={searchTerm}
 *       onChange={(e) => setSearchTerm(e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
