 /**
  * Utility functions for timezone-safe date handling.
  * These functions prevent the common issue where toISOString() shifts
  * midnight local time to the previous day in UTC.
  */
 
 /**
  * Formats a Date object to YYYY-MM-DD string in local timezone.
  * This avoids the timezone shift issue with toISOString().split('T')[0]
  * 
  * @example
  * // For Polish timezone (CET +1)
  * const date = new Date(2025, 11, 31); // 31 Dec 2025, 00:00:00 CET
  * formatDateForDB(date); // "2025-12-31" ✓ (correct)
  * date.toISOString().split('T')[0]; // "2025-12-30" ✗ (wrong - UTC shift)
  */
 export const formatDateForDB = (date: Date): string => {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
 };
 
 /**
  * Returns the last day of a given month as YYYY-MM-DD string.
  * @param year - Full year (e.g., 2025)
  * @param month - Month number 1-12 (January = 1, December = 12)
  */
 export const getLastDayOfMonth = (year: number, month: number): string => {
   // new Date(year, month, 0) gives the last day of the previous month
   // So for month=12 (December), we use new Date(year, 12, 0) = Dec 31
   const lastDay = new Date(year, month, 0);
   return formatDateForDB(lastDay);
 };
 
 /**
  * Returns the first day of a given month as YYYY-MM-DD string.
  * @param year - Full year (e.g., 2025)
  * @param month - Month number 1-12 (January = 1, December = 12)
  */
 export const getFirstDayOfMonth = (year: number, month: number): string => {
   const firstDay = new Date(year, month - 1, 1);
   return formatDateForDB(firstDay);
 };
 
 /**
  * Returns both the first and last day of a given month.
  * @param year - Full year (e.g., 2025)
  * @param month - Month number 1-12 (January = 1, December = 12)
  */
 export const getMonthDateRange = (year: number, month: number): { dateFrom: string; dateTo: string } => {
   return {
     dateFrom: getFirstDayOfMonth(year, month),
     dateTo: getLastDayOfMonth(year, month)
   };
 };