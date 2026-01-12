-- Napraw brakujący profil dla użytkownika powolania@oblaci.pl
-- ID pochodzi z auth.users
INSERT INTO profiles (
  id, 
  name, 
  email, 
  role, 
  location_id,
  blocked
)
VALUES (
  '180d5392-60e9-4f5b-a447-6db8a7e87e40',
  'Powołania Oblaci',
  'powolania@oblaci.pl',
  'ekonom',
  NULL,
  false
)
ON CONFLICT (id) DO NOTHING;