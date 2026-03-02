-- Force re-login: delete all trusted devices so every user must re-verify
DELETE FROM public.trusted_devices;