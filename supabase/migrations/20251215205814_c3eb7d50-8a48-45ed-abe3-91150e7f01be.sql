-- Remove demo knowledge_documents that don't have actual files in storage
DELETE FROM public.knowledge_documents WHERE uploaded_by = 'fbdffef6-646d-4237-aa54-62ae80792ba4';