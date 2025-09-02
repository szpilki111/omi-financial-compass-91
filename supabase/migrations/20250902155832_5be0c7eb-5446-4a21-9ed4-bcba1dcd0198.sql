-- Etap 1: Dodanie NIP i REGON do tabeli locations
ALTER TABLE public.locations 
ADD COLUMN nip VARCHAR(10),
ADD COLUMN regon VARCHAR(14);

-- Etap 2: Rozszerzenie tabeli profiles
ALTER TABLE public.profiles 
ADD COLUMN login VARCHAR(50) UNIQUE,
ADD COLUMN position TEXT,
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN phone VARCHAR(20);

-- Migracja istniejących danych - rozdzielenie name na first_name i last_name
UPDATE public.profiles 
SET 
  first_name = TRIM(SPLIT_PART(name, ' ', 1)),
  last_name = CASE 
    WHEN POSITION(' ' IN name) > 0 THEN TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1))
    ELSE ''
  END
WHERE name IS NOT NULL;

-- Generowanie unikalnych loginów dla istniejących użytkowników (na podstawie email)
UPDATE public.profiles 
SET login = LOWER(SPLIT_PART(email, '@', 1))
WHERE login IS NULL;

-- Rozwiązanie konfliktów loginów poprzez dodanie numerów
WITH login_conflicts AS (
  SELECT id, login, ROW_NUMBER() OVER (PARTITION BY login ORDER BY created_at) as rn
  FROM public.profiles
  WHERE login IS NOT NULL
),
updated_logins AS (
  SELECT 
    id,
    CASE 
      WHEN rn = 1 THEN login
      ELSE login || '_' || rn::text
    END as new_login
  FROM login_conflicts
)
UPDATE public.profiles 
SET login = updated_logins.new_login
FROM updated_logins
WHERE public.profiles.id = updated_logins.id;