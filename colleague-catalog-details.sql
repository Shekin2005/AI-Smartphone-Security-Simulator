-- Optional catalog details for the fictional Colleague-style interface.
-- Run AFTER school-upgrade.sql; preserves existing registrations and payments.
ALTER TABLE acadia_catalog ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE acadia_catalog ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 3 CHECK (credits BETWEEN 0 AND 9);
ALTER TABLE acadia_catalog ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'TBA';
ALTER TABLE acadia_catalog ADD COLUMN IF NOT EXISTS end_time TIME;
UPDATE acadia_catalog SET description=CASE code
 WHEN 'COMP 3123' THEN 'Introduction to computer and network security, authentication, access control and threat analysis.'
 WHEN 'COMP 3553' THEN 'Computer graphics concepts, transformations, rendering and interactive visualization.'
 WHEN 'COMP 2663' THEN 'Software requirements, design, team development and testing practices.'
 WHEN 'COMP 3503' THEN 'Data analysis methods, visualization and interpretation of datasets.'
 WHEN 'COMP 2103' THEN 'Programming concepts and implementation techniques.'
 ELSE description END WHERE description='';
