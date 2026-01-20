-- Insert the 4 missing OTP records
-- Copy all of this and paste into Supabase SQL Editor, then click "Run"

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (357, 'kxtyqh', 'email', '$2b$10$MlaeWNUKYjr63nE.QCnUq.6FM05ieJA1jH8sTZiZ3Av1RzoI4Hvx2', '2026-01-09 13:14:19', 0, 0, '2026-01-09 18:39:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (358, 'kxtyqh', 'email', '$2b$10$NaEeUdwzVbJ50wki6u80xuMisQW7khz0ZJVAYEcgaqu9sIZagPDe.', '2026-01-10 13:09:27', 0, 0, '2026-01-10 18:34:27')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (359, 'kxtyqh', 'email', '$2b$10$HFBczoL26lvvDHK5e4VnzuTxdiOaBVp7DG3XNDcvsbI9aGeBm7gfm', '2026-01-11 06:59:48', 0, 0, '2026-01-11 12:24:49')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (360, 'kxtyqh', 'email', '$2b$10$McfRYXJO4vLoQ.KG3Fn6mOeJ2VYbgvkeoG3dN0.tu9i6agb38wVQm', '2026-01-11 13:05:16', 0, 1, '2026-01-11 18:30:16')
ON CONFLICT (id) DO NOTHING;

-- After running, verify with:
-- SELECT COUNT(*) FROM otp_table;
-- Should show: 360
