-- Adds the Faculty Member role. A new enum value cannot be used in the same
-- transaction that adds it, so this is its own migration.
alter type public.app_role add value if not exists 'faculty';
