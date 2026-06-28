-- Replace length_feet + length_inches (integer) with length_total_inches + mainline_length_inches (real).
ALTER TABLE repo_modules
  ADD COLUMN length_total_inches REAL,
  ADD COLUMN mainline_length_inches REAL;

UPDATE repo_modules
  SET length_total_inches = (length_feet * 12.0) + length_inches
  WHERE length_feet IS NOT NULL AND length_inches IS NOT NULL;

ALTER TABLE repo_modules
  DROP COLUMN length_feet,
  DROP COLUMN length_inches;
