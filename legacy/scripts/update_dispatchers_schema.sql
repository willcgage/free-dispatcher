-- update_dispatchers_schema.sql
-- This script updates the dispatchers table to add layout_id and district_id foreign keys.
-- Run this in your PostgreSQL database (e.g., with psql or a GUI).

ALTER TABLE dispatchers
  ADD COLUMN layout_id INTEGER REFERENCES layouts(id),
  ADD COLUMN district_id INTEGER REFERENCES districts(id);

-- If you want to enforce NOT NULL (after updating existing rows):
-- ALTER TABLE dispatchers ALTER COLUMN layout_id SET NOT NULL;
-- ALTER TABLE dispatchers ALTER COLUMN district_id SET NOT NULL;

-- Optionally, update existing rows to set valid layout_id and district_id values before enforcing NOT NULL.
