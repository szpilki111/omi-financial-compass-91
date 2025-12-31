-- Czyszczenie bazy danych przed wdrożeniem produkcyjnym
-- Data: 2024-12-31
-- Zachowane: profiles, locations, accounts, konfiguracja, user_login_events, trusted_devices, failed_logins

-- Krok 1: Usunięcie transakcji i wpisów raportów (tabele zależne)
DELETE FROM transactions;
DELETE FROM report_entries;
DELETE FROM report_account_details;
DELETE FROM report_details;

-- Krok 2: Usunięcie pozycji budżetowych (zależne od budget_plans)
DELETE FROM budget_items;

-- Krok 3: Usunięcie dokumentów głównych
DELETE FROM documents;
DELETE FROM budget_plans;
DELETE FROM reports;

-- Krok 4: Usunięcie powiadomień i zdarzeń
DELETE FROM notifications;
DELETE FROM calendar_events;

-- Krok 5: Usunięcie zgłoszeń błędów i odpowiedzi
DELETE FROM error_report_responses;
DELETE FROM error_reports;

-- Krok 6: Usunięcie tokenów i kodów weryfikacyjnych
DELETE FROM verification_codes;
DELETE FROM password_reset_tokens;

-- Krok 7: Usunięcie logów przypomnień i historii kursów
DELETE FROM reminder_logs;
DELETE FROM exchange_rate_history;