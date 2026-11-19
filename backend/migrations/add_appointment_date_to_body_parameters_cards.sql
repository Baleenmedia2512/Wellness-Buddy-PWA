-- Migration: Add appointment_date to body_parameters_cards
ALTER TABLE body_parameters_cards
ADD COLUMN IF NOT EXISTS appointment_date DATE DEFAULT NULL;

COMMENT ON COLUMN body_parameters_cards.appointment_date IS 'Scheduled next appointment date for client follow-up';
