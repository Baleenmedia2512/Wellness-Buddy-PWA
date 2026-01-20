-- Safe Insert for Missing OTP Records
-- This will insert only the 4 missing records
-- Existing 356 records will be skipped (no errors)

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (1, 'logeshwaran67677@gmail.com', 'email', '$2b$10$FmSB25qWgscmcHFD/13deeM5HZTErmpl8aQyOp3fPwC0wcd8IEzsG', '2025-07-11 05:10:54', 0, 0, '2025-07-11 10:35:54')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (2, 'logeshwaran67677@gmail.com', 'email', '$2b$10$H3blZwoFxcsWzPLnpqpe2uyBhxHy9oL5RgT3I5G.08oGT5bOuDcpK', '2025-07-11 05:11:42', 1, 0, '2025-07-11 10:36:42')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (3, 'logeshwaranvelmurugan@gmail.com', 'email', '$2b$10$Sf5XNqY3qk2Xpnbo8lX95uvO95bKcNe9Jkb2EfQ8DrzgLXJ83vdoW', '2025-07-11 08:47:20', 0, 0, '2025-07-11 14:12:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (4, 'logeshwaran67677@gmail.com', 'email', '$2b$10$dToNvjSVnIxBKFHAqTKn9OPfeTDmeMsokh1p3LeIngQoPnG6OMWNC', '2025-07-11 08:47:42', 1, 0, '2025-07-11 14:12:42')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (5, 'logeshwaran67677@gmail.com', 'email', '$2b$10$fabM.8hcKNvR14A.u6DlleBfSgiq9YssHLl.QnZUUxbeRnSlovB/W', '2025-07-14 10:17:41', 1, 0, '2025-07-14 15:42:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (6, 'logeshwaran67677@gmail.com', 'email', '$2b$10$LPdCnWMRNj3AMZHcfPhNk.JZ.PhaHbY7v8Auunl0o.RHcoj8wUxdi', '2025-07-14 10:34:00', 1, 0, '2025-07-14 15:59:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (7, 'logeshwaran67677@gmail.com', 'email', '$2b$10$entkEfsY42jJy0vx4OSjsOcGY9nHN3uW0qaadUEbvWHnUK8qlX6xS', '2025-07-14 11:03:38', 1, 0, '2025-07-14 16:28:38')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (8, 'logeshwaran67677@gmail.com', 'email', '$2b$10$aLmQqx6M9EHTw4ZkL2TAEODFnh6m/s6EriVhivdBFFXNAMwhierU6', '2025-07-14 12:19:10', 1, 0, '2025-07-14 17:44:10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (9, 'contactksbalaji@gmail.com', 'email', '$2b$10$9OkEUBCVKRUhBYtBfV.50.FPMlUb9y3RarHk7id5MlzSCPRVN565K', '2025-07-14 14:17:50', 1, 0, '2025-07-14 19:42:51')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (10, 'prassananatarajan@gmail.com', 'email', '$2b$10$go5Wu3J7VBOH4QX/UbwBT.coaV1lrwKr93IWz9DjyKuXen30bkvGO', '2025-07-14 14:20:46', 1, 0, '2025-07-14 19:45:46')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (11, 'logeshwaran67677@gmail.com', 'email', '$2b$10$Wc8KcYjZWgfOQ6KbHVvTG.0lslvFQ51IsIYGTkfeHrpj84n41jYAK', '2025-07-18 05:36:32', 1, 0, '2025-07-18 11:01:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (12, 'logeshwaran67677@gmail.com', 'email', '$2b$10$cLhS2/oRdJxelpl/NtxCG.LZoIt8sfmFMMju10xmKy5glOg79g5ya', '2025-07-22 09:42:35', 1, 0, '2025-07-22 15:07:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (13, 'logeshwaran67677@gmail.com', 'email', '$2b$10$nW.mzF0Ytp4lg4Qv59K43O8oTBl7MNwWmW4QTuQQ9kcKeOSDyg.Da', '2025-07-22 11:02:23', 1, 0, '2025-07-22 16:27:23')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (14, 'logeshwaran67677@gmail.com', 'email', '$2b$10$EW9jn1bFBeKy2dEcU3ACK.IsYJYdrPXCiVaBhkzM09gSnhqTD9IOy', '2025-07-23 06:07:42', 1, 0, '2025-07-23 11:32:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (15, 'logeshwaran67677@gmail.com', 'email', '$2b$10$U8IH9KDaULWcHkU2.UtrYelUsIOJwttpPEechq0woh1Nw/wLeX5Ri', '2025-07-23 06:33:19', 1, 0, '2025-07-23 11:58:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (16, 'logeshwaran67677@gmail.com', 'email', '$2b$10$JQfyGA52SIWEmDhVB/NGuuGh.KJVczU/fZtn6p/OH2L/kwAuk2Osm', '2025-07-23 07:00:02', 0, 0, '2025-07-23 12:25:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (17, 'logeshwaran67677@gmail.com', 'email', '$2b$10$BWaR4/KvqztLH6IZf1IT.u5ODytYBTfhQ821dbukeC27iP8kGh.6K', '2025-07-23 07:01:33', 1, 0, '2025-07-23 12:26:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (18, 'logeshwaran67677@gmail.com', 'email', '$2b$10$XACXCabPbIcvnV2DXHsWeeIimNjq9HCofTXUkz3SpIlQrNfMLfL2G', '2025-07-23 10:45:09', 1, 0, '2025-07-23 16:10:09')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (19, 'logeshwaran67677@gmail.com', 'email', '$2b$10$r/kO4p48gxzuNLMTn4UrS.a3W/L/uKoizrhp7QnKamT2xolkUEJwG', '2025-07-24 09:08:43', 1, 0, '2025-07-24 14:33:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (20, 'contactksbalaji@gmail.com', 'email', '$2b$10$QhNHVz/nYAUEAl4.dB3BROhFn7I4kfgnKpJ.ED9ALXd0Os11IIbVe', '2025-07-25 08:41:12', 1, 0, '2025-07-25 14:06:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (21, 'logeshwaran67677@gmail.com', 'email', '$2b$10$2sBa9/xUh.p5MqZZvWzblu9USfuWzGKG3fFfngfzZBmPv5Tw5l6BW', '2025-07-25 10:28:21', 1, 0, '2025-07-25 15:53:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (22, 'logeshwaran67677@gmail.com', 'email', '$2b$10$.e/bloc9zAV5Lan3Nm4JVOXoyYhwAkIoXHZuQQNIPn1QSg7iqPo4S', '2025-07-25 10:42:20', 1, 0, '2025-07-25 16:07:21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (23, 'logeshwaran67677@gmail.com', 'email', '$2b$10$AEO2NN0hHTrJr4vRZPn0Zeg720Q7VfBCjZQpfEzWrTJjRNtufOXrC', '2025-07-25 10:51:26', 1, 0, '2025-07-25 16:16:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (24, 'logeshwaran67677@gmail.com', 'email', '$2b$10$N.XFjRYQ8ykO1kXQflxenuk40cIJkOQxeB27RrzM0IVPJIznOh/UG', '2025-07-25 11:01:05', 1, 0, '2025-07-25 16:26:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (25, 'logeshwaran67677@gmail.com', 'email', '$2b$10$2dqSQ/gpoO5RthSVHbeinufj0Q3YRlHPVr8u/rLGZItdPbOK0rhHK', '2025-07-25 11:52:18', 1, 0, '2025-07-25 17:17:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (26, 'logeshwaran67677@gmail.com', 'email', '$2b$10$KS8/tOI8YItMptDuN7vDCezU56qQamt/WVflkmzZDuImMRxybg8Cm', '2025-07-28 11:15:22', 1, 0, '2025-07-28 16:40:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (27, 'logeshwaran67677@gmail.com', 'email', '$2b$10$K/XPfJ90oCvGEiwHWMV5KOdu3iJ/weqmeU8rCnqr8Tv57pdVl2lLG', '2025-07-28 11:34:26', 0, 0, '2025-07-28 16:59:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (28, 'logeshwaran67677@gmail.com', 'email', '$2b$10$9CVJdPfUCOTXJqdND/4mJOzJI2uynJGcZsDuK6jJQvswvpppIXW2a', '2025-07-28 11:35:43', 1, 0, '2025-07-28 17:00:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (29, 'logeshwaran67677@gmail.com', 'email', '$2b$10$5M5yYkTbMogmptxTfiACbekj3T235rA9X47uc4Yc8HrUbGOqZPOua', '2025-07-31 11:38:13', 1, 0, '2025-07-31 17:03:13')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (30, 'logeshwaran67677@gmail.com', 'email', '$2b$10$w5GWkyB3wbueW0QJVaCjQOa/TiCnOYfpBptvT2KtNyLdPDLNjiw1S', '2025-07-31 11:45:02', 1, 0, '2025-07-31 17:10:02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (31, 'contactksbalaji@gmail.com', 'email', '$2b$10$ITGqUF4p/OzfZuiZZklwQuIO9qWRLWYEIDvMsgvNAjQFOxrSYFs7.', '2025-07-31 12:22:02', 1, 0, '2025-07-31 17:47:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (32, 'logeshwaran67677@gmail.com', 'email', '$2b$10$0pER1B9Uh35XiId/g.nIY.xacr2Ck5Jg2kehsYEIHcQbI1Z3sbBI.', '2025-08-06 15:14:10', 1, 0, '2025-08-06 20:39:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (33, 'logeshwaran67677@gmail.com', 'email', '$2b$10$ij3tQsO1/bXyuHpVl3pDd.7Vm01TQIk0eI3WJX75xkbVTi7D8lYja', '2025-08-13 11:27:09', 1, 0, '2025-08-13 16:52:09')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (34, 'logeshwaran67677@gmail.com', 'email', '$2b$10$mjD2CAuTDTIDaCNThWRWF.z9G.AZm2HN1AMtsvp4N3l4O4GoptF.a', '2025-08-19 12:06:01', 1, 0, '2025-08-19 17:31:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (35, 'jhhzqy', 'email', '$2b$10$zKz353vQWNS5nqvq2FDl3.JZHpzfwTiCsSyetgkBHzP.mKMFMLRXe', '2025-08-20 15:56:16', 0, 0, '2025-08-20 21:21:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (36, 'logeshwaran67677@gmail.com', 'email', '$2b$10$smL1tRisrtIdr1isySVnT.wLdjxrwlAvxP/5yecYZBxq1oMu95.5q', '2025-09-04 10:05:50', 1, 0, '2025-09-04 15:30:50')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (37, 'logeshwaran67677@gmail.com', 'email', '$2b$10$TliPAyNGspVVnOvZ99yJEeON2qRFQRQVrODK.3FpKobSbDeP6iWM.', '2025-09-04 10:09:18', 1, 0, '2025-09-04 15:34:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (38, 'logeshwaran67677@gmail.com', 'email', '$2b$10$51CN6tA1Lo3yhFfbUErQJe9P.t2H/FvvI7iw.VgzcRZ1ClNMUvKPG', '2025-09-18 10:36:43', 1, 0, '2025-09-18 16:01:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (39, 'logeshwaran67677@gmail.com', 'email', '$2b$10$Z0ug0yYWf5oVARH//ir1z.SKYx5IJQzS0SPTfKyizx05YpOleSDx6', '2025-09-18 10:40:51', 1, 0, '2025-09-18 16:05:52')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (40, 'logeshwaran67677@gmail.com', 'email', '$2b$10$I4gHaBb8ldkaELRXCKEJ1u1UBJF8Am2oOFhyvBeYNVF6q4JYgV1u6', '2025-09-18 10:58:38', 1, 0, '2025-09-18 16:23:39')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (41, 'logeshwaran67677@gmail.com', 'email', '$2b$10$o9gfoCN3XiiMj9WaLlcu9OCkXyYWLFwx9HRdn/L22FL6otZO1Vs0i', '2025-09-18 11:08:41', 1, 0, '2025-09-18 16:33:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (42, 'logeshwaran67677@gmail.com', 'email', '$2b$10$Cy0MgFXSK/i2W.TLeLM.2OKxWEolx90zktrHKCuMk0Flv/lEoQlKe', '2025-09-18 11:15:14', 1, 0, '2025-09-18 16:40:14')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (43, 'logeshwaran67677@gmail.com', 'email', '$2b$10$TRuet138LmO1hbHnUW5BmOctm7IT5e0GTCkXUqPvpqyCeuTEHrpq.', '2025-09-18 11:24:40', 0, 0, '2025-09-18 16:49:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (44, 'logeshwaran67677@gmail.com', 'email', '$2b$10$3PKnpK9H3bbVvZqYoIlDwOkV6x/knb12l/DIModrN6nhe14Nt.BFS', '2025-09-18 11:42:54', 1, 0, '2025-09-18 17:07:54')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (45, 'logeshwaran67677@gmail.com', 'email', '$2b$10$iHnG4I6gfMwBwma11t5oWej/UTVAipe5AzZnZum6aTMJwK0EOVqra', '2025-09-18 12:06:21', 1, 0, '2025-09-18 17:31:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (46, 'logeshwaran67677@gmail.com', 'email', '$2b$10$mv93yxJY3FHns9qiGzpabuNdXqc6xmuMmgH9OchJXxvAO6KoFk6aS', '2025-09-22 05:22:20', 1, 0, '2025-09-22 10:47:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (47, 'prassananatarajan@gmail.com', 'email', '$2b$10$yck726xGYUy/ff3XvUciX.vti0ssNNPD6kW8PADerCBDzM25wHrjO', '2025-09-22 08:31:18', 1, 0, '2025-09-22 13:56:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (48, 'logeshwaran67677@gmail.com', 'email', '$2b$10$fB99cFAGhFTDOMlfyc7dd.SElMqDBMxANbQ7asta.HoYfur8djjvu', '2025-10-08 08:18:59', 1, 0, '2025-10-08 13:44:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (49, 'logeshwaran67677@gmail.com', 'email', '$2b$10$07kCpw.L3EF0jCYu6g131ea/KIytL/jfN7JxNvmcA5r5czJm4zY7i', '2025-10-22 10:12:43', 1, 0, '2025-10-22 15:37:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (50, 'logeshwaran67677@gmail.com', 'email', '$2b$10$aWs1tzSsVVodsYn/7cxiNOM9eTT8Wzbl8r0.9mlIuKk6i4/F3nS9K', '2025-10-28 04:15:21', 1, 0, '2025-10-28 09:40:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (51, 'kxtyqh', 'email', '$2b$10$NdKsyrBieoks3nI2Rw0C/eZzQW7G1b9MNXDinSOt75/eNm.j3RwrK', '2025-10-28 11:12:34', 0, 0, '2025-10-28 16:37:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (52, 'logeshwaran67677@gmail.com', 'email', '$2b$10$HpV8/OfkBfdz.c/7syS8L.s160BotGL0zwffaJucaITxlj4Hg8bfW', '2025-10-28 12:13:21', 1, 0, '2025-10-28 17:38:21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (53, 'logeshwaran67677@gmail.com', 'email', '$2b$10$XaLb12q1wWxeWQM9hBymxepA56TxUN7F4Nd6cyhBNfKlnObN8x9OW', '2025-10-29 05:03:16', 1, 0, '2025-10-29 10:28:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (54, 'logeshwaran67677@gmail.com', 'email', '$2b$10$npChNv0GbewOKUY.IRgDnemb9jukM.j6QmXGTeYII2JmYB0eJ4UNO', '2025-10-29 10:17:59', 1, 0, '2025-10-29 15:42:59')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (55, 'kxtyqh', 'email', '$2b$10$YVbFBTQ9NAqopQCzoI4Kg.5QnXM2129PrWEPRrSMg1I8mSpACm2t2', '2025-10-30 04:28:49', 0, 0, '2025-10-30 09:53:49')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (56, 'logeshwaran67677@gmail.com', 'email', '$2b$10$9A6sMO4z0kbSKzV7ITdyo.AAOhuWucVXV.8ZF35SkOQrVXKXVP182', '2025-10-30 06:00:27', 1, 0, '2025-10-30 11:25:27')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (57, 'logeshwaran67677@gmail.com', 'email', '$2b$10$fQTZCar0PPomkMCIaIoRcuXubTnG.KjC/6FM8E8RGBo1OnNi9Lada', '2025-10-30 07:23:08', 1, 0, '2025-10-30 12:48:08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (58, 'logeshwaran67677@gmail.com', 'email', '$2b$10$CJkf9Iq9W6ZVWoxCmHN4ie5lXMzAIRStSPnMh9IizA2QJBoSBwbCy', '2025-10-30 09:59:01', 1, 0, '2025-10-30 15:24:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (59, 'logeshwaran67677@gmail.com', 'email', '$2b$10$tPzYKHflFJ4I38GgYd4azOQbZuOgjHIzYYd/sfp7TOJQ/RiW/3rWO', '2025-10-30 10:43:36', 1, 0, '2025-10-30 16:08:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (60, 'logeshwaran67677@gmail.com', 'email', '$2b$10$aUZpaUAg8Ot1CXfva6lZvOcFBYOnvjzdrbIZJBkBnu3SkBMygPo5e', '2025-10-30 10:45:40', 1, 0, '2025-10-30 16:10:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (61, 'logeshwaranvelmurugan@gmail.com', 'email', '$2b$10$.Ig0IwovdyrwgY6muvvdAeOrjfmIbMdGG/L2pPZnbLARlwTmW892y', '2025-10-30 11:36:05', 0, 1, '2025-10-30 17:01:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (62, 'logeshwaran67677@gmail.com', 'email', '$2b$10$cdQXX6WNj9VWiT6LBuYMXenrSB7Fbk56eX8H8z9oInqrVTOWHZ9JK', '2025-10-30 11:36:24', 1, 0, '2025-10-30 17:01:24')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (63, 'logeshwaran67677@gmail.com', 'email', '$2b$10$cgQhkUnKoVvODxvijmo83.70BAUYrJOa5QXmrOGc7.yCFuf09VHKC', '2025-10-30 12:12:43', 1, 0, '2025-10-30 17:37:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (64, 'logeshwaran67677@gmail.com', 'email', '$2b$10$cZliO4poN8DXSYFwcN/s8./j4v.qqBa7ZiqFmIEm8kwaCi8MgzQkq', '2025-10-30 14:09:59', 1, 0, '2025-10-30 19:34:59')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (65, 'DUMMY', 'email', '$2b$10$GL37Xku1FOSrtsAqa/c8WOlIrmjVQR/fV.R539poOD8mQ5BYR9foK', '2025-10-30 16:18:08', 0, 1, '2025-10-30 21:43:08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (66, 'logeshwaran67677@gmail.com', 'email', '$2b$10$PvfiMhndYtNxVZXIvH1CwOHZ0LmWKVVnZsIzhoqB7o4Vi6RdnzOx2', '2025-10-31 04:17:03', 1, 0, '2025-10-31 09:42:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (67, 'logeshwaran67677@gmail.com', 'email', '$2b$10$tzI/F.WAQ1leL.qAoiTyFOLqoaqGw5WG88jTiRa03UGdVwb0PbFXW', '2025-10-31 04:23:26', 1, 0, '2025-10-31 09:48:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (68, 'logeshwaran67677@gmail.com', 'email', '$2b$10$CGdo0jg/gKp6QTPaVFJ/b.2vmGo3yjYY7kGrH867O41VmdBmZKmBy', '2025-10-31 04:24:45', 1, 0, '2025-10-31 09:49:46')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (69, 'easy2work.india@gmail.com', 'email', '$2b$10$fV/oN0dxbUy3imkL/Gqc9e//i/aXAzw9K.ccK1v0DPPQT56nh3k3q', '2025-10-31 07:20:57', 1, 0, '2025-10-31 12:45:57')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (70, 'easy2work.india@gmail.com', 'email', '$2b$10$Mrrec6XEtv8t9dfB27FXDu9IKWc0C1AHwTisRRvmTLNHomaiGdGwS', '2025-10-31 07:24:33', 1, 0, '2025-10-31 12:49:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (71, 'easy2work.india@gmail.com', 'email', '$2b$10$0nzGWAz0U4OUoSTAaNMnd.pPeCpXBmrIuDyeBU9NeWpObS0YHIKSq', '2025-10-31 07:25:00', 1, 0, '2025-10-31 12:50:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (72, 'easy2work.india@gmail.com', 'email', '$2b$10$wW1Aw4g5DLJGLSug1.cjseJzmGhipJ/8D8C1fLIMRQGvvH6h3w3cy', '2025-10-31 07:27:14', 0, 0, '2025-10-31 12:52:14')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (73, 'easy2work.india@gmail.com', 'email', '$2b$10$Cpt7xN.o36WHtiRszpoQT.twm09b6amrT6Gk.1lLwr1ZQJTwQGv06', '2025-10-31 07:27:27', 1, 0, '2025-10-31 12:52:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (74, 'easy2work.india@gmail.com', 'email', '$2b$10$EWFPijzhS7PvCoZ1f9czZeCsCbq0rj3Z7CmkfE4OoEU4iWzWacr1K', '2025-10-31 07:43:16', 1, 0, '2025-10-31 13:08:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (75, 'easy2work.india@gmail.com', 'email', '$2b$10$J1rEKELHfhnZR0CNaA4/kuoh04qk9pHPCakvq0s9HlYoDH0pfljnu', '2025-10-31 07:43:41', 0, 0, '2025-10-31 13:08:42')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (76, 'easy2work.india@gmail.com', 'email', '$2b$10$7Ub/nL2I2T3C32WnqlKRg.WPKAWIgZiZH5iC3saZItvNqAJr8gte6', '2025-10-31 07:48:26', 1, 0, '2025-10-31 13:13:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (77, 'nsusha31@gmail.com', 'email', '$2b$10$4CAyxmT9IMCLyTeIEUadK.Qiy8zZ72i3qzHcmFyNX0SFpV7ivVCs.', '2025-11-03 00:07:05', 1, 0, '2025-11-03 05:32:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (78, 'easy2work.india@gmail.com', 'email', '$2b$10$j/4Vsg9zYWZ2f/W0jElTnOCjvM9P6ijlPf5xUZbCO/NMqGr7wVNSK', '2025-11-03 06:12:28', 1, 0, '2025-11-03 11:37:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (79, 'easy2work.india@gmail.com', 'email', '$2b$10$yLwHDJm6WcgiVuU5gZwwGuoIvOE.sCLdux.oo0sTSZCqp8fo/Vkza', '2025-11-03 07:20:41', 1, 0, '2025-11-03 12:45:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (80, 'gomathishaira@gmail.com', 'email', '$2b$10$Ri6NEuPnicFsiKHePQGWRu14MJwm3fGiHUoPsVM6TzHvkXCwcAOOC', '2025-11-03 08:45:33', 1, 0, '2025-11-03 14:10:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (81, 'alagupandi03@gmail.com', 'email', '$2b$10$t1RvjZGzfwYsxiV0gfL64OFRDnm7MAcv9eQYxFV1rG0TrGGXxO47C', '2025-11-03 09:00:31', 1, 0, '2025-11-03 14:25:31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (82, 'logeshwaran67677@gmail.com', 'email', '$2b$10$sbcs3arrwwE8a9Dx0B.dgeqDUdZKw042NUfvWCcH2KQQf4bJ.Xmxa', '2025-11-03 09:10:49', 1, 0, '2025-11-03 14:35:50')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (83, 'yasheeerali@gmail.com', 'email', '$2b$10$njK4lVyUIkMTDaXjPzd1kOHVmF6uCnRRuCaS5WVusTq46mtU7sEqm', '2025-11-03 09:18:01', 1, 0, '2025-11-03 14:43:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (84, 'logeshwaran67677@gmail.com', 'email', '$2b$10$cNPwxbzJex1cMrFAtuQ1EuNlvRfk54vSdq.P./M/pZgu23pnK4Ss.', '2025-11-03 12:11:48', 1, 0, '2025-11-03 17:36:49')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (85, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$TcnP.LtPrwohQmZayWp6TuIpbQFUbHjQnBYm50J4X253IMifuf/2q', '2025-11-03 16:26:54', 0, 0, '2025-11-03 21:51:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (86, 'yasheeerali@gmail.com', 'email', '$2b$10$JRkGON7JsFP1j1DUkW/56uk5voJW7d4G1D2aXWc45HN/lULilS23W', '2025-11-03 16:27:21', 1, 0, '2025-11-03 21:52:21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (87, 'yasheerali@gmail.com', 'email', '$2b$10$RKe7xh0yVWETsC7PFuIui.4pRQpU/SKT.2lWa5m9Vxq.n/trgBTAi', '2025-11-04 05:07:00', 0, 0, '2025-11-04 10:32:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (88, 'yasheeerali@gmail.com', 'email', '$2b$10$1xAqY1uei0ZIrBcrf6n7L.B0sDHDjFKMPhdXPVWCqjqIRKPf6FOzy', '2025-11-04 05:07:37', 0, 0, '2025-11-04 10:32:37')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (89, 'yasheeerali@gmail.com', 'email', '$2b$10$EDTBmkY1aJQtn49NYlNh1.5Zzj7N6eEw7tiURkGNxvp9oWWbFeIwa', '2025-11-04 05:08:46', 1, 0, '2025-11-04 10:33:46')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (90, 'logeshwaran67677@gmail.com', 'email', '$2b$10$VulbxBo3JqTOok04AmYidek1wh72.dsNRAJ/h5GivUemq3yH1ygpe', '2025-11-04 05:50:40', 1, 0, '2025-11-04 11:15:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (91, 'logeshwaran67677@gmail.com', 'email', '$2b$10$Uj.hBMsGHgW5GS7jetrxT.u9bpnJKo6j448pcQEEQ.o4knFyV1GLu', '2025-11-04 05:53:20', 1, 0, '2025-11-04 11:18:21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (92, 'logeshwaran67677@gmail.com', 'email', '$2b$10$ZUUh18sCd5IxKTtaLSfequpWNqhv0BPE9cs13BBQWy8.19IzGRqGm', '2025-11-04 05:54:50', 0, 0, '2025-11-04 11:19:50')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (93, 'logeshwaran67677@gmail.com', 'email', '$2b$10$qfH0cHLgy3tgDmjyVygt2.RyQ.z5UlvjNZy1jTn.ooa2.dDKlDw4W', '2025-11-04 05:56:05', 1, 0, '2025-11-04 11:21:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (94, 'logeshwaran67677@gmail.com', 'email', '$2b$10$9vfWEcQACh7KUWP7BB7unOAirYfhMXmB9ki7v7NigK7JiAlJpLbyq', '2025-11-04 05:58:12', 1, 0, '2025-11-04 11:23:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (95, 'logeshwaran67677@gmail.com', 'email', '$2b$10$IhFS5NRWDYcqEdA80m/s6OHabnRC268OS3n4teh.hE1/QwIOTHHz6', '2025-11-04 06:18:02', 1, 0, '2025-11-04 11:43:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (96, 'logeshwaran67677@gmail.com', 'email', '$2b$10$Mc3yg4F567tB3FAFk/iRQeRbKD0kNwBOHIgbIMNzPwheAg2kaocDS', '2025-11-04 06:22:02', 1, 0, '2025-11-04 11:47:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (97, 'logeshwaran67677@gmail.com', 'email', '$2b$10$9QLq/GByEvg9yZ8JMxw4Q.20wwOewJuYlaJikmMeyYu2A35JIEZgu', '2025-11-04 06:23:31', 1, 0, '2025-11-04 11:48:32')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (98, 'yasheeerali@gmail.com', 'email', '$2b$10$G5MUpfVU580UlTGrfmsIruM7uYsUcm/5HRw5u09TymjGGLuamHEMG', '2025-11-04 12:23:17', 1, 0, '2025-11-04 17:48:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (99, 'yasheeerali@gmail.com', 'email', '$2b$10$f7gpp9xoG5B5IorWzLbrXuEg9MJ1Pk4w1xqkvpVPYx3l1qSmM/tEq', '2025-11-04 12:28:15', 0, 0, '2025-11-04 17:53:15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (100, 'yasheeerali@gmail.com', 'email', '$2b$10$8B0OdWfRMrE5c0rikYP06uIT2o/XjtZP0sVJ.Wmyf./zCBh5BO6ee', '2025-11-04 12:29:48', 1, 0, '2025-11-04 17:54:49')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (101, 'yasheeerali@gmail.com', 'email', '$2b$10$wn2rbxqVOyv2R0A5wmwOden0SLTcUyZczu2liDIBc0eBonl7LQmjK', '2025-11-04 13:02:34', 1, 0, '2025-11-04 18:27:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (102, 'kxtyqh', 'email', '$2b$10$tCgOX4ejRKFKHrq4iCi2tODa3H9hwFYfXVZLHfTH9rm5U7AyzDI1K', '2025-11-05 14:56:01', 0, 0, '2025-11-05 20:21:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (103, 'rameshbalapr3@gmail.com', 'email', '$2b$10$SPImhWXH1yHbREXaQ4A0mepUtjNkprx46iN0Cg1HDZCBLBIVgJKz6', '2025-11-07 07:00:17', 1, 0, '2025-11-07 12:25:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (104, 'rameshbalapr3@gmail.com', 'email', '$2b$10$iEvjCHHiyr6OjslFHILZHeeQgooEa7yTPQGH4XgXIeIdvj5GzWzve', '2025-11-07 07:20:31', 1, 0, '2025-11-07 12:45:32')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (105, 'rameshbalapr3@gmail.com', 'email', '$2b$10$chVv3VPwsWloy/oNXf3iYeSPG9yti.sIUrfiP5Tafo7kwteDBZtTi', '2025-11-07 08:15:00', 1, 0, '2025-11-07 13:40:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (106, 'rameshbalapr3@gmail.com', 'email', '$2b$10$w10DY/3RTdArKQjWsP9W1eBM3ycaJ2hizqc0NJ5I7a/XzBdxZrJV.', '2025-11-07 09:02:53', 1, 0, '2025-11-07 14:27:53')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (107, 'rameshbalapr3@gmail.com', 'email', '$2b$10$D.XXpAWVJhSoHlkk0gDMaeNegIGyAAy72p/gDDFV0uwMCISAv8sDS', '2025-11-07 09:55:22', 1, 0, '2025-11-07 15:20:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (108, 'rameshbalapr3@gmail.com', 'email', '$2b$10$1od.2pJ205HgRjOEgke.u.kNMtviPbkpErh2C5U.lrOHehyc2e9S6', '2025-11-07 11:48:24', 1, 0, '2025-11-07 17:13:25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (109, 'rameshbalapr3@gmail.com', 'email', '$2b$10$IRB0i1b.YODrDDU8sfk3dOhijgRorV4/XRFAozcMT5rJYT0kx2YSa', '2025-11-07 11:54:41', 1, 0, '2025-11-07 17:19:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (110, 'rameshbalapr3@gmail.com', 'email', '$2b$10$c52xNz/matsIDLnEXMd.Wepts.Ew0alD5lnLC9bJ6t09rimtCCV.2', '2025-11-07 12:39:12', 1, 0, '2025-11-07 18:04:13')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (111, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$XvrfymW.Px79OEVsr7Qi.exHyPK3m7hz3u9Xbkj.cGig0EvcURuyC', '2025-11-07 12:41:09', 1, 0, '2025-11-07 18:06:10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (112, 'rameshbalapr3@gmail.com', 'email', '$2b$10$wl.IGAEmzB.Z2ikIKN29qOjiBrbc3H55CNo5ruKIyY2fX6nr.0BXe', '2025-11-07 12:49:27', 1, 0, '2025-11-07 18:14:27')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (113, 'rameshbalapr3@gmail.com', 'email', '$2b$10$wAM9G4o0fu7m8IyIRqkHcOLQ6EDEcXqE2fslyi4BGit9aFSW6Zrxu', '2025-11-07 12:57:54', 1, 0, '2025-11-07 18:22:54')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (114, '2011chithra@gmail.com', 'email', '$2b$10$XpIWQn0LkzdaNZHgknxyt.8bPst0Oj8eGeibr5DZuAFA8uJ90ZEjO', '2025-11-08 05:13:44', 1, 0, '2025-11-08 10:38:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (115, 'vasanthaaleph@gmail.com', 'email', '$2b$10$AjE6lv4ncJOZqTkk824JXu.28ad5tk2zW9nob0xwfu8ctzwZxjj9a', '2025-11-08 07:34:20', 1, 0, '2025-11-08 12:59:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (116, 'nagarajanjayathi24@gmail.com', 'email', '$2b$10$tXDtcHeWTCogf/rAqFenC.dfIo2zZciHJ8v3QY60Rq9DNBVg/Ahfy', '2025-11-08 08:28:02', 0, 1, '2025-11-08 13:53:02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (117, 'bharathipradeepan.cool@gmail.com', 'email', '$2b$10$1I3CXb4fhxBHrgPTpoJFaO0UAtjjxkBrcyWQRRfQgcXct/I5c631a', '2025-11-13 14:15:01', 1, 0, '2025-11-13 19:40:02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (118, 'logeshwaran67677@gmail.com', 'email', '$2b$10$g7Q8TNLLTKeHL1u2UdmKJOw1GzB6xrUvsYI7/sCs880fG6wTMoY1q', '2025-11-25 07:09:53', 0, 0, '2025-11-25 12:34:53')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (119, 'kxtyqh', 'email', '$2b$10$A5Wfu8v/zf9E1XEME9WgEu6cy29RVRXjdmSVYVxJaGMNmGLUrmMyy', '2025-11-26 05:57:06', 0, 0, '2025-11-26 11:22:06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (120, 'vijomc', 'email', '$2b$10$8NFsjfRJjV8RdTZmzhv4kOo1sntwEOK/roQzZr2ixRCtKkkdXqnz2', '2025-11-26 05:57:23', 0, 0, '2025-11-26 11:22:23')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (121, 'ewlwqh', 'email', '$2b$10$QU9VMMKttIaLIHGoOV8ghO.WRdt4ebX08BrUzdULxs42yJJQdRnNi', '2025-11-26 11:08:17', 0, 1, '2025-11-26 16:33:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (122, 'yasheerali@gmail.com', 'email', '$2b$10$mY./bwmG8ldGRvnF3g63UuPCz1SdJd.5/aa5Vm5BLV6b50Q5CUVou', '2025-12-01 16:56:18', 0, 0, '2025-12-01 16:51:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (123, 'yasheerali@gmail.com', 'email', '$2b$10$pKsJXLkV9LzEpBJmeg4Itei3x4ebD0tWNid5la/7tEWsa18F8RuB2', '2025-12-01 16:57:23', 0, 0, '2025-12-01 16:52:23')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (124, 'rameshbalapr3@gmail.com', 'email', '$2b$10$pIZv6bhn0ZZIj31I6cf6b.WKgqI1nS.44iZF3bIyvuhb9Pxh65joa', '2025-12-01 16:58:17', 1, 0, '2025-12-01 16:53:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (125, 'rameshbalapr3@gmail.com', 'email', '$2b$10$13MlS9LWAvpIh605qETUweN9AM7jxPN.5hV.N3ds67/dhGTf5D7Hq', '2025-12-01 17:57:22', 1, 0, '2025-12-01 17:52:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (126, 'adhithya5518@gmail.com', 'email', '$2b$10$r1lEuZ1TSCLDVT0mc9zXIuq1vcgmU5RvkAnwcttQ0/MzWkMwE1/4C', '2025-12-01 17:58:31', 1, 0, '2025-12-01 17:53:31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (127, 'adhithya5518@gmail.com', 'email', '$2b$10$EHVhh/7aNMxPSeDX6/xTwOlwkK59agHJJjfABFuXCbMVnpsUFBUVm', '2025-12-01 18:14:57', 1, 0, '2025-12-01 18:09:58')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (128, 'adhithya5518@gmail.com', 'email', '$2b$10$RlWaacIA/9coCwPIBaasx.4CyZDhWjKeDIFLatEOp3/5ZdUG2XBvW', '2025-12-01 18:16:40', 1, 0, '2025-12-01 18:11:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (129, 'rameshbala071103@gmail.com', 'email', '$2b$10$drmUI629BpYypO4HrcFG8OgzPs0lR11w6osbYRcBGNTvjSdLorl2i', '2025-12-01 18:18:43', 1, 0, '2025-12-01 18:13:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (130, 'easy2work.india@gmail.com', 'email', '$2b$10$bmaf9gGdyiRiDgc0dZZqGO4duP0nq.n1wsh6MEVbDtsRTfjqd5dqa', '2025-12-01 18:21:32', 1, 0, '2025-12-01 18:16:32')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (131, 'rameshbala071103@gmail.com', 'email', '$2b$10$zSecTm5iYQDUke5mxybHvuzbgm3tYcS1u6KneYkg7No9OaVG3pP.q', '2025-12-01 18:24:45', 1, 0, '2025-12-01 18:19:45')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (132, 'rameshbalapr11@gmail.com', 'email', '$2b$10$UjPkSc6YA5s4VQMcThuhwejBzZ1M/55tnF0rVRBhPaJxg4JlvrzXe', '2025-12-01 18:26:34', 1, 0, '2025-12-01 18:21:35')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (133, 'adhithya5518@gmail.com', 'email', '$2b$10$p7iSnhINcYKi/lcoH7G6l.7fSmPOnVIg6CA2BRaBvpOzvz0cpGmN6', '2025-12-04 05:20:07', 1, 0, '2025-12-04 10:45:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (134, 'kxtyqh', 'email', '$2b$10$iOak6eWavOOfToBcb2PGVeDhVLKuh7L2JQzvo/O7FHptHFT90fncC', '2025-12-04 07:00:57', 0, 0, '2025-12-04 12:25:58')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (135, 'kxtyqh', 'email', '$2b$10$MvlvyeQ0s/nLr/NdX5Mqb.y4Ixr2wwokKeeowV6qJV7tBCl7QLSLC', '2025-12-04 18:06:16', 0, 0, '2025-12-04 23:31:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (136, 'logeshwaran67677@gmail.com', 'email', '$2b$10$2a9O8lv5w7bk1q4ThdYxqu/mF32eEh.qsR6ZJhYoHfVGzKFylaUMG', '2025-12-05 05:24:47', 1, 0, '2025-12-05 10:49:47')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (137, 'adhithya5518@gmail.com', 'email', '$2b$10$3Wj/9IgwRUnT0SPtPJl0Ke3334GLWZ9BKofaJzTJJK8Ax4fId0NJe', '2025-12-05 06:07:54', 0, 0, '2025-12-05 11:32:54')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (138, 'kxtyqh', 'email', '$2b$10$.Dp8HYb3pOoG51rV9zrj5eQq04LCpvNUgREsMJ4fxHpwbPpOiGHYu', '2025-12-05 07:09:06', 0, 0, '2025-12-05 12:34:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (139, 'kxtyqh', 'email', '$2b$10$0vv0WNb5A7bnE.1V.RQg0OkqNhCZHpHJsf2C0Ts1eGUp0dhd/CwlK', '2025-12-05 08:05:10', 0, 0, '2025-12-05 13:30:10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (140, 'kxtyqh', 'email', '$2b$10$6JbreSKWdW6OZr7F/7IF.u3bPDymoNz3u1GxNx2/ipb4xVf7cQvDa', '2025-12-05 12:01:02', 0, 0, '2025-12-05 17:26:02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (141, 'kxtyqh', 'email', '$2b$10$1F2LfN7BWj5zPTEbflrYV.hTqlkGZy1m4QHKmG7.rlnDvWGKRLgY2', '2025-12-05 16:00:59', 0, 0, '2025-12-05 21:25:59')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (142, 'kxtyqh', 'email', '$2b$10$Tu.NWfas1D4MegtNKIZRXO4NtYwh1MJxV0nHSw9yfvcPcSIEPB4Nq', '2025-12-06 02:11:34', 0, 0, '2025-12-06 07:36:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (143, 'kxtyqh', 'email', '$2b$10$DGYtzSjMRdynNnBzASYbqe6h3yQNpgOG5mboQM.UWHyuFsE8yLAkS', '2025-12-06 03:01:12', 0, 0, '2025-12-06 08:26:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (144, 'kxtyqh', 'email', '$2b$10$zHLprFjSnrQxhubwBS61XOP2RcxQwv.LqACc3C1pHPkorQKyrkNfu', '2025-12-06 03:01:57', 0, 0, '2025-12-06 08:26:57')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (145, 'kxtyqh', 'email', '$2b$10$GdbMS/PPs7b3EyIKwEnCguT8/0fr4Lzr3P3Tr0ZuWeqezAPOttwaS', '2025-12-06 17:00:20', 0, 0, '2025-12-06 22:25:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (146, 'kxtyqh', 'email', '$2b$10$nnffxfYilSFqDFlcAFCW3OPsG8MxL9y3B.5/1w31qOCYRVPPv/ow2', '2025-12-07 01:02:01', 0, 0, '2025-12-07 06:27:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (147, 'kxtyqh', 'email', '$2b$10$ftl5P5W6LfMBzTV2T7zXP.8FEmbeJGJiGYm3q19jyhTVQByAEd9LK', '2025-12-07 05:06:04', 0, 0, '2025-12-07 10:31:04')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (148, 'kxtyqh', 'email', '$2b$10$VflAa76jAfT7251AlYiKgu1/kWswzNWTRjtLBczbmX5pytX20VMYu', '2025-12-07 13:11:32', 0, 0, '2025-12-07 18:36:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (149, 'kxtyqh', 'email', '$2b$10$UELGH3gSgYMU6JDWwVSrke2f2aCm.WvAsJ6qAKCV/hZ3KKm5AAfSO', '2025-12-07 16:08:42', 0, 0, '2025-12-07 21:33:42')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (150, 'kxtyqh', 'email', '$2b$10$GVnmizlbfknmTwBBf28ghuJDSbxKLweIp3h768I2PrNwo6WPm1nHC', '2025-12-07 21:08:46', 0, 0, '2025-12-08 02:33:46')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (151, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$cCs353L8967rC/9ChIKgye00T1X8df1A7nUOoHwoG/CEPSKslkqum', '2025-12-08 04:58:38', 1, 0, '2025-12-08 10:23:38')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (152, 'adhithya5518@gmail.com', 'email', '$2b$10$0/6NMxXENrlLg2PM5rsoOOT1sEZbEGzMSakexhMzbHSgH9bw7wdXW', '2025-12-08 08:11:40', 1, 0, '2025-12-08 13:36:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (153, 'yasheerjafar2003@gmail.com', 'email', '$2b$10$ebQxQmc8.hsxQGf7fYYn0O3HtUM9E4FLnc2jKRSEmNcj33hnc/LSa', '2025-12-08 10:52:05', 1, 0, '2025-12-08 16:17:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (154, 'kxtyqh', 'email', '$2b$10$MIvcSAz3ZrenRVfXfdSjzuba/y8dKoaZzLfCHZ.Jr6XkknYtGQqOG', '2025-12-08 14:03:13', 0, 0, '2025-12-08 19:28:14')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (155, 'kxtyqh', 'email', '$2b$10$LQ0mugsyoE5kfEZ6Epm.ruBBy6kWanuMKCEQTOXqai6WMzC9etgEK', '2025-12-08 15:08:52', 0, 0, '2025-12-08 20:33:53')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (156, 'jhhzqy', 'email', '$2b$10$9V4SjVaCg.Eg4.KC9bauWuRIQJpeL2cvNH28t76TgPHZ0ejAix5fC', '2025-12-08 19:03:40', 0, 0, '2025-12-09 00:28:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (157, 'kxtyqh', 'email', '$2b$10$/NhkLlnGdT0p28mfU3eNHOxA9iCNkGetbn4GPVJalyrhNeDncwqFK', '2025-12-08 21:37:11', 0, 0, '2025-12-09 03:02:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (158, 'kxtyqh', 'email', '$2b$10$8IsiLIhnYLbkVSGF57b7C.T31G6IlqFKEIKazZjV0jsqEpOoqMBOy', '2025-12-09 00:20:11', 0, 0, '2025-12-09 05:45:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (159, 'kxtyqh', 'email', '$2b$10$6FyM43Sfmg8wBjo/hNj9G.clXPvmGKYVn9cLTutFGzlejTdjLOd3y', '2025-12-09 00:59:49', 0, 0, '2025-12-09 06:24:49')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (160, 'easy2work.india@gmail.com', 'email', '$2b$10$ev4DzX1lRK5HXODTAraZZ.BXpZPjP9WYmV9XdcddV974irUxzURt2', '2025-12-09 05:37:55', 1, 0, '2025-12-09 11:02:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (161, 'adhithya5518@gmail.com', 'email', '$2b$10$4Z9FqIhN6Aj95dduJMAoteAzMZ6hKICwico2Zdt8flvCLGHR6VmWG', '2025-12-09 13:36:44', 1, 0, '2025-12-09 19:01:45')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (162, 'kxtyqh', 'email', '$2b$10$VpH6sZZOH5B5xUdj5zHntONM0bPfpBPEe4T0o0iuF9TG2OlkIi89O', '2025-12-09 19:00:28', 0, 0, '2025-12-10 00:25:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (163, 'kxtyqh', 'email', '$2b$10$7ei8JnY0nWYfHNH1z7cGmuMwAWoyh/9yLUL/TOJLsGZmPj8TQd7tK', '2025-12-09 20:00:01', 0, 0, '2025-12-10 01:25:02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (164, 'kxtyqh', 'email', '$2b$10$YBtLaNxZgT3aEM.CTn4FPexXLyBiPnR/Dg0mmP0CtusPQ0fBeeEeW', '2025-12-10 02:01:06', 0, 0, '2025-12-10 07:26:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (165, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$h1LLeBeD9bq9dFjbeXlUEe54TRuD.dtatBoPu6gk1ZrezMIKtiEj.', '2025-12-10 05:02:35', 1, 0, '2025-12-10 10:27:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (166, 'kxtyqh', 'email', '$2b$10$AoPrB5XrfoXsrT/T8sbHC.h147rdnm/iUATHvEROys/UXzigyiepe', '2025-12-10 08:38:47', 0, 0, '2025-12-10 14:03:48')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (167, 'kxtyqh', 'email', '$2b$10$tMysqooYMCLhyMacl9cTH.inEH9lrT/hMZSkpgvz9gUKqDawLe3BW', '2025-12-10 08:40:13', 0, 0, '2025-12-10 14:05:13')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (168, 'kxtyqh', 'email', '$2b$10$rJzw9GyXozoxItLWt5J5TeahDBVxqzHmTK4TIy3AeuKD.4Tic9y6C', '2025-12-10 10:14:16', 0, 0, '2025-12-10 15:39:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (169, 'testuser@example.com', 'email', '$2b$10$CBJq8p97mJdtupp.VCCrquFbpuSAAMNFdpgih.OTiaBr3qj9Vqxk.', '2025-12-10 10:24:45', 0, 0, '2025-12-10 15:49:45')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (170, 'testuser@example.com', 'email', '$2b$10$0lOL2dIhA0k2cA./6sbc6ulUUCW7y1gW0RH4U1JRycGtnuUz24px6', '2025-12-10 10:31:25', 0, 0, '2025-12-10 15:56:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (171, 'testuser@example.com', 'email', '$2b$10$i9SjcAc8/d.huGwqaQuIWOZZc/1Vea6JleABfT.F2ONHwJEwv3WSa', '2025-12-10 10:41:19', 0, 0, '2025-12-10 16:06:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (172, 'testuser@example.com', 'email', '$2b$10$daDJMV4norFvYhfptQuS6u0KaSGn4x3Jdo2ETgegWqLIBVloJ2Dca', '2025-12-10 10:41:20', 0, 0, '2025-12-10 16:06:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (173, 'testuser@example.com', 'email', '$2b$10$K0M5KCGPnlMQyB6iJKo7ouyGn/7B4wjxDIu4du5huaaQiGKTxspYG', '2025-12-10 10:45:40', 0, 0, '2025-12-10 16:10:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (174, 'testuser@example.com', 'email', '$2b$10$oiSYkDItA2I3fvV8Dr6eX.JWCfGWXq0exB0yit6ubCyjQxajIwEDq', '2025-12-10 10:47:46', 0, 0, '2025-12-10 16:12:46')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (175, 'testuser@example.com', 'email', '$2b$10$i4syD//9UM21.eU4HnMFVeqb2Q6HdkrS3EnhJCj9gtnZjYQteJHty', '2025-12-10 10:49:16', 0, 0, '2025-12-10 16:14:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (176, 'testuser@example.com', 'email', '$2b$10$zYiC71O6eb0/5qWPaNs42.8sxlLhNrWRhvHtzlM4YlD0m/Xqk665.', '2025-12-10 10:50:13', 0, 0, '2025-12-10 16:15:13')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (177, 'testuser@example.com', 'email', '$2b$10$gHWxN8FqTOwneXU51C5wket6HtALanWUCl23e18P8cM17LUgwmCHK', '2025-12-10 11:43:11', 0, 0, '2025-12-10 17:08:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (178, 'testuser@example.com', 'email', '$2b$10$yD19vbnCcD5aUGhDte2pDOo1QHiiaxy232dYQ/Bro6vmtuFo0YRFe', '2025-12-10 12:38:36', 0, 0, '2025-12-10 18:03:37')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (179, 'kxtyqh', 'email', '$2b$10$F3QBzdZvv39ZPordv3vGoOLakWTm8Oisv4aQw9GJ2vk.svzE0Rna6', '2025-12-10 14:03:59', 0, 0, '2025-12-10 19:28:59')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (180, 'kxtyqh', 'email', '$2b$10$47Wf.rCCH1QKDdHpiTj.V.fMUuP7.uMfKmQ/Z6O5l5bwiwaF0vvi6', '2025-12-10 22:59:28', 0, 0, '2025-12-11 04:24:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (181, 'testuser@example.com', 'email', '$2b$10$Nmwl9XBb5dyHuoBLlNt/PegDuPedfrlCEVwzX.uV7TnvBb0JsslDa', '2025-12-11 08:37:26', 0, 0, '2025-12-11 14:02:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (182, 'kxtyqh', 'email', '$2b$10$CUY43029TLjESUROjQr9.e3wXLisoTGwwWqyTbk1OvXbQvpD.S5kC', '2025-12-12 01:07:52', 0, 0, '2025-12-12 06:32:52')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (183, 'testuser@example.com', 'email', '$2b$10$5n5O16HdlZ/xz5G9hg55s.8Ghr74HJ.dor9x.AW7DDw6WyP1m5fOi', '2025-12-12 04:42:30', 0, 0, '2025-12-12 10:07:30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (184, 'testuser@example.com', 'email', '$2b$10$Am6wEfo0gAA2Q5d.zfdDCuzfrtmVSabA2RO5jMZhKB0X5qq0q0hH6', '2025-12-12 12:28:19', 0, 0, '2025-12-12 17:53:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (185, 'testuser@example.com', 'email', '$2b$10$f5A7Y155JBcSVPgpQQZOCOE76CezSWEn6TsYMAUHzcTZidXMlzEWC', '2025-12-12 12:28:22', 0, 0, '2025-12-12 17:53:23')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (186, 'testuser@example.com', 'email', '$2b$10$34YvHytaXhb.zgwYtfEKJex2XHfmblqV9jW95eOK5nooJtDWeWfsm', '2025-12-12 12:28:40', 0, 0, '2025-12-12 17:53:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (187, 'testuser@example.com', 'email', '$2b$10$i2xrjZyCwk4xSHEz0ButOeVeLVrDSvP1TPGc5DPLKVPRVpLwQ.gTe', '2025-12-12 12:32:30', 0, 0, '2025-12-12 17:57:31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (188, 'testuser@example.com', 'email', '$2b$10$Q/j6kax0hq1P.opb/J3POeOT9E1tmHmlu/LuBzCU4SqlTyGZRYh5q', '2025-12-12 12:32:33', 0, 0, '2025-12-12 17:57:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (189, 'kxtyqh', 'email', '$2b$10$/d5hxm2CxkdMBZHJpYevPOcJg60hZXxNQAMR1NLvTDsq7/rcICM/W', '2025-12-12 18:01:19', 0, 0, '2025-12-12 23:26:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (190, 'kxtyqh', 'email', '$2b$10$AruWVTvnEuA1b4PYnHqNluE322SXHewPQ1pmC3cNFag16j0ZtJluK', '2025-12-13 14:00:38', 0, 0, '2025-12-13 19:25:38')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (191, 'kxtyqh', 'email', '$2b$10$U5NX.7U39r7NDQRjjHLsievwe/Cb5kdIDWpd3AOU5m0SGswy/x4nC', '2025-12-13 21:20:24', 0, 0, '2025-12-14 02:45:25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (192, 'kxtyqh', 'email', '$2b$10$hGXZRPKWcaKYWeSC/xk5G.WUEah9e0WvESkLTQ5mFlCqfy97LYUlK', '2025-12-14 03:00:11', 0, 0, '2025-12-14 08:25:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (193, 'kxtyqh', 'email', '$2b$10$SvkvXpvOwccNKNsZaRzI3elS6NgsAtvf.0TguyxseDc7v8kbS892q', '2025-12-14 05:37:58', 0, 0, '2025-12-14 11:02:58')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (194, 'kxtyqh', 'email', '$2b$10$bQFUw9qObkkwsYBjiascb.1VnI0Qy9G0c/HvymqCsbiQk/t2M3INS', '2025-12-15 09:01:55', 0, 0, '2025-12-15 14:26:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (195, 'kxtyqh', 'email', '$2b$10$GVhHTMNbQpUuQ3i5jjiUw.5XVYBvaZNQeVMves.JMloh.FrbF9csS', '2025-12-15 16:01:33', 0, 0, '2025-12-15 21:26:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (196, 'kxtyqh', 'email', '$2b$10$g3ERA1FB8eOvWaBpEnARseH4tnD7pSUP9JTEeEjVlblLtAd./b8.e', '2025-12-15 19:01:30', 0, 0, '2025-12-16 00:26:30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (197, 'kxtyqh', 'email', '$2b$10$8RHXLPLpPDJaQdBsj.Pdm.uIXp8XXSze/LaRAsAznwrZuFnXvb976', '2025-12-15 19:08:52', 0, 0, '2025-12-16 00:33:53')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (198, 'kxtyqh', 'email', '$2b$10$OGE8ho3VUkGb4YDTqbFuBeODvJVHPDYIXyKAfsZU15MllZxfqx8F6', '2025-12-16 08:01:20', 0, 0, '2025-12-16 13:26:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (199, 'adhithya5518@gmail.com', 'email', '$2b$10$OFDad/3Bja48OGZHgoaEReGjMRBEMr.4V9RYN/yHsbNvtyqUCgS5a', '2025-12-16 17:36:06', 1, 0, '2025-12-16 23:01:06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (200, 'praveenkumarsakthivel5120@gmail.com', 'email', '$2b$10$jhBrQbr4Y8kimbRDd6zOb.uJsCcza54ZftKvPoI7es1qxw01vIH0W', '2025-12-16 18:21:36', 0, 1, '2025-12-16 23:46:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (201, 'praveensakthivel5120@gmail.com', 'email', '$2b$10$2WdzFmHM05rvAc69N/x8VuEGLtG0nWvQXfERE.uNWpxbd4NUj37aW', '2025-12-16 18:22:07', 1, 0, '2025-12-16 23:47:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (202, 'kxtyqh', 'email', '$2b$10$nlBgWvmOe3s2EdTgOkPMu.xrMomK5tGlS8loMAwygftsxhu.uiMLe', '2025-12-16 23:02:16', 0, 0, '2025-12-17 04:27:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (203, 'rameshbalapr3@gmail.com', 'email', '$2b$10$hoabubFknVHpDt91M3Bx5.ysByKlNKHk2yY5GH/Px0EqVCzPhGGF2', '2025-12-17 05:02:45', 1, 0, '2025-12-17 10:27:45')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (204, 'contactksbalaji@gmail.com', 'email', '$2b$10$KKSLYHKBlc1QZv141zliDeS2dNc7X6WMBlS.VD0on7QXS8mVO6kVS', '2025-12-17 08:24:36', 1, 0, '2025-12-17 13:49:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (205, 'kxtyqh', 'email', '$2b$10$Hpl3ZmYLPy.Sa9d0nSzEce6uYHzO6xm0nZY95zV1OlRb/ngVvo/Fu', '2025-12-17 15:11:32', 0, 0, '2025-12-17 20:36:32')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (206, 'jhhzqy', 'email', '$2b$10$3UTunwT9zMShNwn1gxZHReyV0wD/s1U.zepu1ygwMjuJ/K1A3FspK', '2025-12-17 15:58:32', 0, 0, '2025-12-17 21:23:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (207, 'kxtyqh', 'email', '$2b$10$9SDvz7AaOFWCDTMSs.Zll.CCTBYtwdGstZaGDSqfjCFq2OlUsaLfu', '2025-12-17 19:00:40', 0, 0, '2025-12-18 00:25:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (208, 'kxtyqh', 'email', '$2b$10$hti/yHy1.omcvHsZC3JxcO6eXEN97L4C.bRl8iYQDdv8YIpLYkbF.', '2025-12-18 01:19:17', 0, 0, '2025-12-18 06:44:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (209, 'kxtyqh', 'email', '$2b$10$u/vRbTgO4pSF9GT1WT5ByueWkDm9gAiA1aMAe3kcM.UGJyRi2c4/y', '2025-12-18 04:12:49', 0, 0, '2025-12-18 09:37:50')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (210, 'testuser@example.com', 'email', '$2b$10$TJQVvZOvD.BgHmyvDMNMaeQcVaNWOMaMJ.hEBeix.a5ymh6pLUYzC', '2025-12-18 06:12:39', 0, 0, '2025-12-18 11:37:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (211, 'testuser@example.com', 'email', '$2b$10$qzVr84B.fmSZADPw7Eqy2OvGbfORJ9gdzrNQRDC6MsMcDsYpLWGoO', '2025-12-18 06:13:44', 0, 0, '2025-12-18 11:38:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (212, 'testuser@example.com', 'email', '$2b$10$oAL05ZLYu7k7wudbMJgH8.LztAh2tRZYLvstC68RQeAbaCnVne.96', '2025-12-18 06:16:10', 0, 0, '2025-12-18 11:41:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (213, 'testuser@example.com', 'email', '$2b$10$hLcY7JJwKYOc1wVSkSSsheGAxzQX0/sg1XF7FSpkj.a0SJKWAFcdC', '2025-12-18 06:18:55', 0, 0, '2025-12-18 11:43:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (214, 'testuser@example.com', 'email', '$2b$10$Z6o6AG4b.nVgOSkBA4WBu.3HRU1gOEcDzTgyNyNhMI8D/qW5e0UrS', '2025-12-18 06:21:40', 0, 0, '2025-12-18 11:46:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (215, 'testuser@example.com', 'email', '$2b$10$QkosiD8ydmzNAOAmzLE1g.bX5aiH6cMpLq2qanft5EKBxOJRZOSZq', '2025-12-18 06:24:44', 0, 0, '2025-12-18 11:49:45')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (216, '2011chithra@gmail.com', 'email', '$2b$10$YbL85hhKZvCMLZuF1.568.sUdLD.KtA8h87HejYVV4wf1WWN6co7u', '2025-12-18 06:37:08', 1, 0, '2025-12-18 12:02:09')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (217, '2011chithra@gmail.com', 'email', '$2b$10$NPqbBPrPZ78jg4.acLXmQuCd9kC998XIF2gdNyHjZmmXAoCkA..qy', '2025-12-18 06:39:57', 1, 0, '2025-12-18 12:04:57')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (218, 'kxtyqh', 'email', '$2b$10$DIs98/tLygK.CNJMp806u.eDBMc5D81m.fTND7nnQ04R54b4EXni2', '2025-12-18 12:10:09', 0, 0, '2025-12-18 17:35:09')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (219, 'kxtyqh', 'email', '$2b$10$CrezkgzBUsxQKwgdixAWcueJE1hqDREvDb/Dh2Ve/Rv3c8Zp4T4b6', '2025-12-18 12:16:30', 0, 0, '2025-12-18 17:41:30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (220, 'jhhzqy', 'email', '$2b$10$57iKRBSNw9czPWHM7F/O3OhzxxkCayhgOqZs3xV7.2SL37HW7z5TC', '2025-12-18 12:58:39', 0, 0, '2025-12-18 18:23:39')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (221, 'kxtyqh', 'email', '$2b$10$aJukidAJEhRVbT9pIa8DauwiabCEmwdLJZj8aHcMYvDIpQygZM0mG', '2025-12-18 20:00:59', 0, 0, '2025-12-19 01:26:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (222, 'kxtyqh', 'email', '$2b$10$HKS.Jlw/JiFJfRmHnNw3Qu44dw7MwzYIcBn7PYh0zxrHjeOcokzfm', '2025-12-18 22:58:58', 0, 0, '2025-12-19 04:23:58')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (223, 'kxtyqh', 'email', '$2b$10$aVbCaQ7NJtsAR4/mPlvPJeddWl7BEZsJQ2RtbSa9GK5p.5K8EgvQa', '2025-12-19 03:06:24', 0, 0, '2025-12-19 08:31:25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (224, 'kxtyqh', 'email', '$2b$10$1L2XLfcDg0hHjlaCE5MOmuD7dwEApPfjqzn1NNlMdARdQJCob5l3G', '2025-12-19 14:36:44', 0, 0, '2025-12-19 20:01:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (225, 'vasanthaaleph@gmsil.com', 'email', '$2b$10$pN0PWYoVRtvbfQUCSGEVG.ueAtv91duFlYw6XEZaR1PTSmbdTfoca', '2025-12-20 08:26:23', 0, 1, '2025-12-20 13:51:23')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (226, 'jhhzqy', 'email', '$2b$10$sKWBicFUcjXlDp5yTUMcQORMlIBj95QRuqBJnFRRhsGXnq/RMf8qa', '2025-12-20 12:20:22', 0, 0, '2025-12-20 17:45:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (227, 'kxtyqh', 'email', '$2b$10$DFfqIiytCg2tYCDI597TyezfDRxoUPzSXbfi1rqQ.Z36QTxlbcs4O', '2025-12-20 12:25:18', 0, 0, '2025-12-20 17:50:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (228, 'jhhzqy', 'email', '$2b$10$gHmhhEv1dhBvg7.PfChBwekw8AABt2IXNRTvXd7f2uA1cugsVNe8.', '2025-12-20 13:05:01', 0, 0, '2025-12-20 18:30:02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (229, 'kxtyqh', 'email', '$2b$10$f3x4sDaN.zcODYeyiehb8.FeBprPbH672yfWmSJEUd0/hz/a/EhUq', '2025-12-20 13:13:54', 0, 0, '2025-12-20 18:38:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (230, 'kxtyqh', 'email', '$2b$10$SdjP/KTJjoSbU3DWKN7wRu1aUoXWrF3uNg1GawAlteDwIbRkmLbWK', '2025-12-20 14:01:52', 0, 0, '2025-12-20 19:26:52')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (231, 'kxtyqh', 'email', '$2b$10$x975gOYyr6drnZ8nbA2F0.N2ZUCXKBVNwtP1Tf/UAidgxHFFWKFTu', '2025-12-20 16:09:51', 0, 0, '2025-12-20 21:34:51')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (232, 'kxtyqh', 'email', '$2b$10$YaysGYRW2VDnwTFKtfiNy.9nmppZbgzGRPKC.2LSk1L/vYC2rvk52', '2025-12-21 01:59:37', 0, 0, '2025-12-21 07:24:38')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (233, 'kxtyqh', 'email', '$2b$10$AWk1EHOaKpw9KR1H.HxPSupCOJGkiYiSBR5.r2S8IDDZI/dSEWkgG', '2025-12-21 04:00:49', 0, 0, '2025-12-21 09:25:50')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (234, 'kxtyqh', 'email', '$2b$10$MTgkvwEo6ZZHggF8EHJkoeAVrj4VmCe/JPK5IAv/1QsdZOTlBQMmq', '2025-12-21 07:00:37', 0, 0, '2025-12-21 12:25:37')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (235, 'kxtyqh', 'email', '$2b$10$UP9raovbUUeX60ugvzr1C.n4qcJDlKOULldUs/RPTaqfgjEPInXf.', '2025-12-21 10:00:40', 0, 0, '2025-12-21 15:25:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (236, 'kxtyqh', 'email', '$2b$10$klgrxWvuGIYy1ZSycHErEe.2tfcvaG/ar.2av5x6P.JOIN//ijQ2q', '2025-12-22 07:01:22', 0, 0, '2025-12-22 12:26:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (237, 'rameshbalapr3@gmail.com', 'email', '$2b$10$Wda9UYFArwG.1oBrzaKRj.HuTuqTUDr8dHUWZhAaNxjN8aAS6vRM.', '2025-12-22 13:37:03', 1, 0, '2025-12-22 13:32:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (238, 'kxtyqh', 'email', '$2b$10$iOhEzQYikI9CozU.4XUJDO.CmUntskvPtFDBcdN9/M/EcByprbpde', '2025-12-22 08:43:36', 0, 0, '2025-12-22 14:08:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (239, 'adhithya5518@gmail.com', 'email', '$2b$10$PCW5PovnvtloVC9NzJM92O7rhN75rzpq7USchT966QOYC4iOZEkIq', '2025-12-22 15:06:05', 1, 0, '2025-12-22 15:01:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (240, 'adhithya5518@gmail.com', 'email', '$2b$10$mqQI1s1EefkeFY83jGvKCOgeBN1UQrgfteN50es0XffmSWrt6BkOG', '2025-12-22 15:41:41', 1, 0, '2025-12-22 15:36:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (241, 'rameshbalapr3@gmail.com', 'email', '$2b$10$1wOPEXYsWqrslb1KgtSNYOdXsBa0EZlKE/xvl6GkxvVNj7mNxBwNO', '2025-12-22 15:43:30', 1, 0, '2025-12-22 15:38:30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (242, 'kxtyqh', 'email', '$2b$10$ktzw3SyL5mRrUm261fH7vetR1Vc3QNnKzodfspeiXdBP1gPytSYmu', '2025-12-23 00:00:21', 0, 0, '2025-12-23 05:25:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (243, 'kxtyqh', 'email', '$2b$10$ayha0gQspfkHrD7KCDHsoOgPvLzrdJmS6qQIgiA3zpY4blK8o43Jq', '2025-12-23 03:36:12', 0, 0, '2025-12-23 09:01:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (244, 'adhithya5518@gmail.com', 'email', '$2b$10$Irs3NEMhhSd61BedflgT4.69xhcp6/CnIG6jPjPljJI94UTC67Ovy', '2025-12-23 16:41:55', 1, 0, '2025-12-23 16:36:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (245, 'rameshbalapr3@gmail.com', 'email', '$2b$10$2QISxcyydJ2uMyNmoWfbVubAn01XhG23Hv.aaLTcAw7HKzbq8jAw.', '2025-12-23 16:47:41', 1, 0, '2025-12-23 16:42:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (246, 'kxtyqh', 'email', '$2b$10$QSV4iYHB.Y1ubAqWLWMk3e20DxF0pVIEbZUVBRrYnBLAoO5WhproS', '2025-12-23 17:01:10', 0, 0, '2025-12-23 22:26:10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (247, 'kxtyqh', 'email', '$2b$10$BffiQ86gJCwhBwGyWD58q.54JVa29Okj7K/PAFLtrfNKghGGgQzju', '2025-12-23 18:08:43', 0, 0, '2025-12-23 23:33:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (248, 'kxtyqh', 'email', '$2b$10$L4m5pD8hWVvq6lCOTY7aje6tya0UCjdwMS4QH9DCLrczoyWmR2HQO', '2025-12-23 19:05:05', 0, 0, '2025-12-24 00:30:06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (249, 'kxtyqh', 'email', '$2b$10$ZJAKmb1gnt0Bz7pCTX8D9etIwDCAG6a7fTioUOS737nXJVXw8SaZC', '2025-12-23 19:05:27', 0, 0, '2025-12-24 00:30:27')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (250, 'kxtyqh', 'email', '$2b$10$oJIYGjaY2ctjS65.4XWQGuQpvB/6wXupV8duDn4lWO5sMPUNsp8BW', '2025-12-23 21:00:21', 0, 0, '2025-12-24 02:25:21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (251, 'kxtyqh', 'email', '$2b$10$AUTqloFU8O.118uZJM.wYe9aO57LvmrTSmG/hvb08Xez9Whn5YC4O', '2025-12-23 21:01:31', 0, 0, '2025-12-24 02:26:31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (252, 'adhithya5518@gmail.com', 'email', '$2b$10$CuD71vxAFgmNmFKiPvriQ.DWua2YPZXSD.bVzFzGT5dqCAC6QnwYS', '2025-12-24 16:06:05', 1, 0, '2025-12-24 16:01:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (253, 'rameshbalapr3@gmail.com', 'email', '$2b$10$cwaSXdL2ax51l5Ee3z/mJegQhtxhYFAtFqYCrbxqke1Pt3Y2tkw5u', '2025-12-24 18:02:59', 1, 0, '2025-12-24 17:57:59')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (254, 'kxtyqh', 'email', '$2b$10$aHqDYi8drVSzjm9JsZE1Gu0.tFsJyMKvd.ozrgI4zohAOS84J9whq', '2025-12-25 01:01:55', 0, 0, '2025-12-25 06:26:56')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (255, 'kxtyqh', 'email', '$2b$10$zFur83okDkcoBi6pfJPMJe49.bpO3nCjPrE86Fzu/IeGBe/bpe7Da', '2025-12-25 15:59:11', 0, 0, '2025-12-25 21:24:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (256, 'kxtyqh', 'email', '$2b$10$i3hOKjosZdX4xnX10.GByesWcFj4lNTH7r.tHSK8aejOV4Vo.Voti', '2025-12-26 05:19:25', 0, 0, '2025-12-26 10:44:25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (257, 'vijomc', 'email', '$2b$10$WMKMKcU6fhHLN4X9z2FU0.OOUj37S2wbkKeEld.NomB9oL4cuyMHa', '2025-12-26 05:19:43', 0, 1, '2025-12-26 10:44:43')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (258, 'kxtyqh', 'email', '$2b$10$/Nl2.BktD.VWE4xBb9BAUuLQBbINIDPEOH1d5a0eZ7.5DB83frF4S', '2025-12-26 08:11:06', 0, 0, '2025-12-26 13:36:06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (259, 'kxtyqh', 'email', '$2b$10$QxteZmIAY5uimUO2R7.11uaXj/WtKaEg8lOSfGE3gsqD5bI.m.b7C', '2025-12-27 02:01:17', 0, 0, '2025-12-27 07:26:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (260, 'kxtyqh', 'email', '$2b$10$AlJ7l2h0l.ha.ifQwJwyL.lO0yjNPv5ebOJ8NSWlr66K2NLTBHwxW', '2025-12-27 12:21:16', 0, 0, '2025-12-27 17:46:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (261, 'kxtyqh', 'email', '$2b$10$0EaMsCdTJJ160SjNEof0He7boBtw70fgeSMV2vKGkHDyXkTkf/RbW', '2025-12-27 13:02:32', 0, 0, '2025-12-27 18:27:32')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (262, 'kxtyqh', 'email', '$2b$10$sCAZft.yHxuRR0BMdKUtRucLrgQkgyL7QMIO3CrJOc6Snv4ly8r5O', '2025-12-27 22:06:51', 0, 0, '2025-12-28 03:31:52')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (263, 'kxtyqh', 'email', '$2b$10$qr446EAyhiF8jS0RW.9.sO/NfSANllYR2utkUeJWAYQiEiXZb6ZvW', '2025-12-28 05:58:38', 0, 0, '2025-12-28 11:23:38')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (264, 'kxtyqh', 'email', '$2b$10$tizoHTzPcDCysVdixwtUF.OURtWMpswWLK4B7y37w7uFT4GfErxXm', '2025-12-28 07:01:59', 0, 0, '2025-12-28 12:26:59')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (265, 'kxtyqh', 'email', '$2b$10$TOStsZ/YsXEARZSGaYbCkuMGHS7W2hRB1bvJP7s8NoM6GlQ//kEie', '2025-12-28 13:13:00', 0, 0, '2025-12-28 18:38:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (266, 'kxtyqh', 'email', '$2b$10$dVYXZLZTQJAl9.ToScrWrurdDaPb2TFGV73YvXmT1R7ZWtw9JCXFC', '2025-12-29 04:09:12', 0, 0, '2025-12-29 09:34:12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (267, 'kxtyqh', 'email', '$2b$10$lwpKLX70b9EBuEQMZBMOA.tc5dXbf1Ns/YYQteFXe3jKLA9/gRdHG', '2025-12-29 07:00:06', 0, 0, '2025-12-29 12:25:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (268, 'kxtyqh', 'email', '$2b$10$pQJK4ehfsYMWbdq0WSB9duITywOHAd8EsyiI6tt2qyest2zCq7yMy', '2025-12-29 13:21:06', 0, 0, '2025-12-29 18:46:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (269, 'test@example.com', 'email', '$2b$10$SOwq4MozvD6VUvrlpmAih.RqqGZYuQrUL7Lqp/Z9tUDcBWPjd252S', '2025-12-29 13:22:35', 0, 0, '2025-12-29 18:47:35')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (270, 'kxtyqh', 'email', '$2b$10$Bj9jQ1H6wnw6u4AA8dEgXOhvaO.SWAVgJIKWtnMILfZegrtcp55tq', '2025-12-29 13:28:28', 0, 0, '2025-12-29 18:53:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (271, 'kxtyqh', 'email', '$2b$10$yZORJ5xaGJw2tlE2W2KvEungY3dfEJnZrisoFyoH1/DosWi.oAd7.', '2025-12-30 01:03:44', 0, 0, '2025-12-30 06:28:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (272, 'rameshbalapr3@gmail.com', 'email', '$2b$10$uSrfxWlh/FgQOMfjDDzrZ.n4/A80p6bXTg/cPqqdKww0ncvbkjiHW', '2025-12-30 07:10:41', 1, 0, '2025-12-30 12:35:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (273, 'rameshbalapr3@gmail.com', 'email', '$2b$10$MvvoKYgSzhcGTZvObA5.SeuWLGl0ln3LgWW0Vq0Y7OZpbPjMUY2Re', '2025-12-30 13:06:37', 1, 0, '2025-12-30 13:01:37')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (274, 'rameshbalapr3@gmail.com', 'email', '$2b$10$oD.mKwDn2PlF9WG28Mme8useRUqQoqBS4Nc9tmjPGJLZoeAkJxahG', '2025-12-30 14:42:28', 1, 0, '2025-12-30 14:37:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (275, 'kxtyqh', 'email', '$2b$10$ONjcKlGJ0T9qR/HFmVA14O/nSmjSCdfUsXOBXQJk3mgSU4gC1M5Za', '2025-12-30 10:01:52', 0, 0, '2025-12-30 15:26:53')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (276, 'kxtyqh', 'email', '$2b$10$kZUpz17CoVR8Tza4ONWkWuQCgu.8vFIati0YcShpw4SRRbHZZ6fpi', '2025-12-30 13:06:07', 0, 0, '2025-12-30 18:31:08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (277, 'kxtyqh', 'email', '$2b$10$exJEpzqBCILpmDzOK5Y0xOCE4yhmS/CPMbuYMLYabDjMDtyC9ZY/C', '2025-12-30 21:13:29', 0, 0, '2025-12-31 02:38:29')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (278, 'kxtyqh', 'email', '$2b$10$cjVaTLiPfPXbU7y3k6O7LuseEZZnxJ1X8MgxlPxjs/wrcT8deHHoS', '2025-12-31 02:10:19', 0, 0, '2025-12-31 07:35:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (279, 'kxtyqh', 'email', '$2b$10$t1yH/R/YsmlBo1lALiAr6.IO4p1VB5Ms/OgI8TOx/mr2Oy8nO7n4.', '2025-12-31 08:04:37', 0, 0, '2025-12-31 13:29:37')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (280, 'kxtyqh', 'email', '$2b$10$yxpuQnr4qLsMLmNCdmHp3OUO.JQqjBgpQ0aSwr7MgrNm69xMJY/ki', '2025-12-31 13:04:19', 0, 0, '2025-12-31 18:29:19')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (281, 'kxtyqh', 'email', '$2b$10$swAR9OwGFiGP4cvnBMTqHOFGkuirFYwoZSelktpEYnzh4HNx.w27u', '2025-12-31 23:59:29', 0, 0, '2026-01-01 05:24:30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (282, 'kxtyqh', 'email', '$2b$10$7sQ54yOcAz.7jCTKfAE6h.Cw/PeSxPYhmdXmm6zRKb5YvL6X5DmYq', '2026-01-01 01:59:59', 0, 0, '2026-01-01 07:25:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (283, 'kxtyqh', 'email', '$2b$10$dBeRrZ3v/jR82w/sfcPb/u24pU0aH4aA5I8dQnW0787Smfee0uN4y', '2026-01-01 05:00:29', 0, 0, '2026-01-01 10:25:29')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (284, 'thirilokcharan2014 @gmail.com', 'email', '$2b$10$Jd6CnjC8UmJf0VTKMMpQpuehJ.ngb.i5dfiPqnbCVEoln01n.q3OS', '2026-01-01 05:40:34', 0, 0, '2026-01-01 11:05:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (285, 'thirilokcharan2014 @gmail.com', 'email', '$2b$10$fR0YE7Pj.PSLnolmIlo20eh3Y91dgN0V1QGqQ1yadmPZxkV.9/Hs.', '2026-01-01 05:40:39', 0, 0, '2026-01-01 11:05:39')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (286, 'thirilokcharan2014 @gmail.com', 'email', '$2b$10$F7emsgfKlwOZzs/ODw7DF.qBpx048gnAqCLvQNVSDiizwIzFXO/9O', '2026-01-01 05:41:00', 0, 1, '2026-01-01 11:06:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (287, 'thirilokcharan2014@gmail.com', 'email', '$2b$10$7WI5B93c9fVOtNrYduLHLeQDKbtm4JlRK9jE.AefdAE14Zy21Mvvu', '2026-01-01 05:48:44', 0, 0, '2026-01-01 11:13:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (288, 'thirilokcharan2014@gmail.com', 'email', '$2b$10$v89kK6UXltEj9E3wl.d3BuEyXDUBC1oImXtQD9jap9snjA2lDdn5y', '2026-01-01 05:50:38', 1, 0, '2026-01-01 11:15:39')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (289, 'onlykarthickks@gmail.com', 'email', '$2b$10$axvjL8pFLxJjuv0U14DL1OttVwJ2N3vdsiJs03Y8vhqryCy0owx2y', '2026-01-01 11:01:13', 1, 0, '2026-01-01 16:26:14')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (290, 'onlykarthickks@gmail.com', 'email', '$2b$10$7h2slUUajMywHGcVMcWSpuEUBizerD8DXrAPZaFx0BAypJVnzxToi', '2026-01-01 11:08:17', 1, 0, '2026-01-01 16:33:17')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (291, 'onlykarthickks@gmail.com', 'email', '$2b$10$85LSQPLv3dw.hpdlSOXXFOZkWAGxIC2BFEMwT1Fw0h8BtHzelkY66', '2026-01-01 11:15:33', 1, 0, '2026-01-01 16:40:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (292, 'rameshbalapr3@gmail.com', 'email', '$2b$10$52V15Zp7fS3yGa/K7H/Ac.om6GPg4czNOQ284MDpV.V4iBHBdm6qe', '2026-01-01 11:52:06', 1, 0, '2026-01-01 17:17:06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (293, 'kxtyqh', 'email', '$2b$10$UQI3ronMQfhsTEy1ffQb9e7DFNRAV4hUxMIpEELa.EF82346KrIhm', '2026-01-01 14:01:30', 0, 0, '2026-01-01 19:26:31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (294, 'vasanthaaleph@gmail.com', 'email', '$2b$10$lOXL4ohHVfCjGYK3Tqm.N./ieU6JBNxdrNYhgUj4QTZG489FU8Ppu', '2026-01-01 16:57:25', 1, 0, '2026-01-01 22:22:25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (295, 'kxtyqh', 'email', '$2b$10$QZ6euYUZ46mpAK02C.Aw5OVEbtMrHV1v0C6Rj82vjZO8iO4IGkk8G', '2026-01-02 05:03:10', 0, 0, '2026-01-02 10:28:11')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (296, 'kxtyqh', 'email', '$2b$10$gW6sZuu2FOvwsCCGlgbrPODT7uw8YUw1rdQX5PnMa2OxyiW405xAy', '2026-01-02 06:59:54', 0, 0, '2026-01-02 12:24:54')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (297, 'testuser@example.com', 'email', '$2b$10$ZtHrTrPr8s1fZYxlnnO.2uRkgueV6WZC78K7dCzzRFdUrBYTTgtiy', '2026-01-02 07:06:28', 0, 1, '2026-01-02 12:31:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (298, 'kxtyqh', 'email', '$2b$10$LwmgWC0PrqmDIIX.nwMMPOx5j1G895LkVUHB/KFg9tpD3sdHPC8PS', '2026-01-02 08:02:14', 0, 0, '2026-01-02 13:27:14')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (299, 'kxtyqh', 'email', '$2b$10$xjwv9ElTwI5Ab8dLixpEzuyrbxbsVqtcb3zat71gFZcDhWqSweLOG', '2026-01-02 10:59:48', 0, 0, '2026-01-02 16:24:48')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (300, 'kxtyqh', 'email', '$2b$10$iWn4UYnj9MwuKU7VJ72qVuMVbZNKBfMXq62KNvpoXcXRlf45zyx8.', '2026-01-02 12:10:00', 0, 0, '2026-01-02 17:35:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (301, 'kxtyqh', 'email', '$2b$10$LPPwDJ3VwV/w4I/DMs0H6ebD/FbKMpuesA1Ma1b/g.OWz0Otg2G8m', '2026-01-02 15:02:08', 0, 0, '2026-01-02 20:27:08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (302, 'kxtyqh', 'email', '$2b$10$asnM1YcUYZ.3ZbRv9xxRXulVVSyjbC/9Lev/WetiwFw4Qea5LKBem', '2026-01-03 01:00:34', 0, 0, '2026-01-03 06:25:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (303, 'kxtyqh', 'email', '$2b$10$q7sThBIstuy2b1erzE/I5.JGMvKXbryvRifDpi2pN/hPmj25g.4lS', '2026-01-03 03:02:47', 0, 0, '2026-01-03 08:27:47')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (304, 'bobbyvenkat@70gmail.com', 'email', '$2b$10$kVv7VYe2.WgRCJcBbuViLeLk5epXum5yFnM3sPQnYzuaxphd052Oi', '2026-01-03 03:07:36', 0, 1, '2026-01-03 08:32:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (305, 'kxtyqh', 'email', '$2b$10$6RVT5P9IEgAVthFpxGzhG.KECJjZtT9xVOyHv/pra7p38sku.VjsG', '2026-01-03 11:03:27', 0, 0, '2026-01-03 16:28:28')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (306, 'kxtyqh', 'email', '$2b$10$V9WJd2wgfTbXxzmbPG/HN.vle0r.6KPFSiZgIIxMKLYCp/ZMuvlRa', '2026-01-03 23:00:33', 0, 0, '2026-01-04 04:25:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (307, 'kxtyqh', 'email', '$2b$10$qaw8UbR3BYqjb7QP9GZAf.h8qAOamVS1s1c7l53QWs2yXC3n2T0Be', '2026-01-04 00:01:52', 0, 0, '2026-01-04 05:26:52')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (308, 'kxtyqh', 'email', '$2b$10$qj9bHUImq5tkE2gUo8rmwuNLhuwlrTlheEMTFDOAlhHfO69u6W9bO', '2026-01-04 03:02:01', 0, 0, '2026-01-04 08:27:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (309, 'moridavidfrancis2811@gmail.com', 'email', '$2b$10$Ea3WpmIS3bZf4chrLgvMX.T6jSZqaIuT5Q4eBI9vfl6Rvwh4Lo38e', '2026-01-04 03:15:05', 1, 0, '2026-01-04 08:40:05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (310, 'kxtyqh', 'email', '$2b$10$rH6LbYN3Wie/.hKWFNVyGO36detsqpDp6It7U5mAp1Nev40OMtMfy', '2026-01-04 10:07:00', 0, 0, '2026-01-04 15:32:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (311, 'kxtyqh', 'email', '$2b$10$UwtGhgxkiuPzExDqW.M33.UHP5GKobTPtQe01kNe7SYllUnFXF9Eq', '2026-01-04 16:58:36', 0, 0, '2026-01-04 22:23:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (312, 'kxtyqh', 'email', '$2b$10$BzNkbHLieZmu3NsanX6H0.qgyr1b4mbchAyflZNANw.EdSndw//ui', '2026-01-04 20:59:08', 0, 0, '2026-01-05 02:24:08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (313, 'kxtyqh', 'email', '$2b$10$Ay4ekU0H8Zty2M1XIMhpYeuiqiOzlqWOC8Z8MKCDficLcUDZ99J3a', '2026-01-04 21:01:24', 0, 0, '2026-01-05 02:26:24')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (314, 'kxtyqh', 'email', '$2b$10$yhqB64RdXwvwGDo7ctz02u80KyT6jP8UYWPbioBeAdbgPcQnhNc2W', '2026-01-05 07:42:16', 0, 0, '2026-01-05 13:07:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (315, 'kxtyqh', 'email', '$2b$10$cqKV74XJP2oGOQobWTRsPes2sREpWxR3T.v.vcKZyI3leYX.wVXiq', '2026-01-05 10:59:09', 0, 0, '2026-01-05 16:24:09')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (316, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$FnvNwzUjk8p3d39sjgdl8uqgelB31ivyXutvK/hmSznP2VZW5HlRy', '2026-01-06 05:30:22', 1, 0, '2026-01-06 10:55:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (317, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$2pFtuggVC9i0CG8qtOs4denQ0ckxHJt5IwiSjtqBq.x0/3HozWIcu', '2026-01-06 05:31:01', 1, 0, '2026-01-06 10:56:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (318, 'kxtyqh', 'email', '$2b$10$44WLMdvjNQFPRQcG2XA.lu6yv/XY28jp5SbKEbeEv12VrcBpJt/5W', '2026-01-06 08:01:58', 0, 0, '2026-01-06 13:26:58')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (319, 'test@example.com', 'email', '$2b$10$3ligiog0NsFg5OEoRY47Muk4DyocwX2.X5EIq7xgSnG1xlQh0NdnO', '2026-01-06 09:34:18', 0, 0, '2026-01-06 14:59:18')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (320, 'kxtyqh', 'email', '$2b$10$DqeA4tP3jeyoJTN26jna5eZjsiHQSK2Wx3Do0nQ1/NRjXdJD0RJwq', '2026-01-06 09:39:51', 0, 0, '2026-01-06 15:04:52')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (321, 'kxtyqh', 'email', '$2b$10$0fkt3Z143TbemFD4BH5hB.vnCKfRfvSHEkZs9rKCzVl5SePTxrrUe', '2026-01-07 05:01:46', 0, 0, '2026-01-07 10:26:46')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (322, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$a55NM5gln0IjHvxwVLT9nO88LtgOXDGxws959NfQbKcBObe50m.B6', '2026-01-07 10:39:26', 1, 0, '2026-01-07 10:34:26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (323, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$ydNEmAfYPpQTSD2UVNH9LeoRgiTcUVuDVrE26z.gtvcKQX.e0EYjG', '2026-01-07 11:02:15', 1, 0, '2026-01-07 10:57:16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (324, 'yasheeer.yash03@gmail.com', 'email', '$2b$10$usA1ixKTQR9IBv4vXMTTyuTF1wJzt/iTQkxwQBK/URZ4ZzBiTyiLG', '2026-01-07 06:00:08', 1, 0, '2026-01-07 11:25:08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (325, 'yasheeerali@gmail.com', 'email', '$2b$10$VBnAcyAL7QWcO6qiF/lHCu.t8vVBSAlQC0B/ThF7V5XGQX0jz59XS', '2026-01-07 11:52:36', 1, 0, '2026-01-07 11:47:36')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (326, 'yasheeerali@gmail', 'email', '$2b$10$rODGNNaLKRERJsyLWXXPFu/rxvs7RvuajlWNtjUw81KXFosQ4GAXO', '2026-01-07 11:57:27', 0, 0, '2026-01-07 11:52:27')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (327, 'yasheeerali@gmail', 'email', '$2b$10$RtNWvg201f5VxhtPcSBp0udHI0z.EgmuBNvgdSmt7VFRerh2TSTCW', '2026-01-07 12:01:29', 0, 1, '2026-01-07 11:56:29')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (328, 'yasheeerali@gmail.com', 'email', '$2b$10$dCsZENyC/uvB7BKlWnXUC.ceDRboHCzS0v60IgjU6UYrrdL5mHB1S', '2026-01-07 12:01:55', 1, 0, '2026-01-07 11:56:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (329, 'rameshpr2003@gmail.com', 'email', '$2b$10$mGKt.s/1HLVGtBUNP62qIuBZwbcTOMQJjiGHoLZ8ccEcbWQ4AOK8O', '2026-01-07 12:03:21', 1, 0, '2026-01-07 11:58:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (330, 'yasheeerali@gmail.com', 'email', '$2b$10$waO8uqfiBuGU65XquBPn3udRXCLdnLN/Y1MpgLx3KtJLNd2KNPqwW', '2026-01-07 12:17:40', 1, 0, '2026-01-07 12:12:40')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (331, 'yasheeerali@gmail.com', 'email', '$2b$10$LD/uKUE2n5XTBhpZUHjC8elcxzHPuen7.4zAucnKYXASVe34U2Tv2', '2026-01-07 12:25:42', 1, 0, '2026-01-07 12:20:42')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (332, 'yasheeerali@gmail.com', 'email', '$2b$10$2pKOn/ykc0keicQKuK3nROOraHHn8KEMpANOPUSSOksYYrFXxAKey', '2026-01-07 12:27:29', 1, 0, '2026-01-07 12:22:29')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (333, 'yasheeerali@gmail.com', 'email', '$2b$10$7UFJyPM5RJ7MQrvhPeIrk.8SAhUkXLSOrUfgGzOOP33vIQkPKSFQS', '2026-01-07 12:32:55', 1, 0, '2026-01-07 12:27:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (334, 'yasheeerali@gmail.com', 'email', '$2b$10$Go./msZ8Ezg1WE91yUOXOuh33xQ2PxWYT/jHvHuCBueT70GeAd6Gu', '2026-01-07 12:53:22', 1, 0, '2026-01-07 12:48:22')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (335, 'adiee2191@gmail.com', 'email', '$2b$10$iZ0EatBJDWzzkrQYZBh9buKG7TFTt7OVcSYw0ygofb3WJumT.dO6.', '2026-01-07 12:56:37', 1, 0, '2026-01-07 12:51:37')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (336, 'adiee2191@gmail.com', 'email', '$2b$10$4OnsMmkun6HWh02BnJd6wOi08WmSmYadG0fMU2OjjcaykRtF3zCni', '2026-01-07 13:02:20', 1, 0, '2026-01-07 12:57:20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (337, 'yasheeerali@gmail.com', 'email', '$2b$10$BpdcevjZX4UwBoL9J1FRQePJU0laACrBuO3EhrDdSkOeONN3Eo7Vm', '2026-01-07 13:07:40', 1, 0, '2026-01-07 13:02:41')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (338, 'yasheeerali@gmail.com', 'email', '$2b$10$zdOBFA0u7ZUt5jmkyKgmrOBEAg3no2swQoUhmF3uEm9hvLncybVom', '2026-01-07 13:09:06', 1, 0, '2026-01-07 13:04:06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (339, 'yasheeerali@gmail.com', 'email', '$2b$10$f5iMCXJ2NdoWtWAX0TR4H.7xPXLoilOzOgzLyMFQrnE4idDhUXpF.', '2026-01-07 13:19:33', 1, 0, '2026-01-07 13:14:33')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (340, 'yasheerali@gmail.com', 'email', '$2b$10$FXksGpgVM8NkTC0zeTRVReNQRvfthIcjw6a3DSenXtl//JYItjQ3.', '2026-01-07 13:22:34', 0, 0, '2026-01-07 13:17:34')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (341, 'yasheerali@gmail.com', 'email', '$2b$10$Q/fEBMoW8zElOZNhxyGzgua1iUwGTp6pS9XjltNM8b/2861buAOL6', '2026-01-07 13:24:24', 0, 0, '2026-01-07 13:19:24')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (342, 'yasheerali@gmail.com', 'email', '$2b$10$SbdVWhPawn1ZMqYsllg7ru9uPwDP6SGkRzAiq6WJ.4wH/qmOpkez.', '2026-01-07 13:24:29', 0, 0, '2026-01-07 13:19:29')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (343, 'yasheeerali@gmail.com', 'email', '$2b$10$IwWFnVH6SESU119cVOfCPudhURNurQDL2ON1bmhvfsnH/LUFMIirS', '2026-01-07 13:25:24', 1, 0, '2026-01-07 13:20:24')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (344, 'adiee2191@gmail.com', 'email', '$2b$10$0ZaI6HyJH9eO/rB/dbhrI.96UH9ztM9i5NbtPBQktx9ZU3OXX5sme', '2026-01-07 13:29:50', 1, 0, '2026-01-07 13:24:50')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (345, 'kxtyqh', 'email', '$2b$10$oAE1cQVb26NCTkXRa2OMM.3Tc9CS.niCQl.UlfZcxbe5/3szqCF8u', '2026-01-07 09:04:43', 0, 0, '2026-01-07 14:29:44')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (346, 'test@example.com', 'email', '$2b$10$4ynPZlANssZ9kT8zKNe6R.wWkZ9N0TtXbC210f/nfG1eU/KRp9vj.', '2026-01-07 10:37:54', 0, 1, '2026-01-07 16:02:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (347, 'kxtyqh', 'email', '$2b$10$JjdDzkXBnShuRAR8ClAm5.LJngh0taFnbOaieFWSTWRytcxl8HvHe', '2026-01-07 10:39:08', 0, 0, '2026-01-07 16:04:09')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (348, 'kxtyqh', 'email', '$2b$10$fOQn6Hs2t2A1.9cRoTczUe2CB.DOr9ypbF9F.0WpEnyVm4KTiyaMW', '2026-01-07 10:47:54', 0, 0, '2026-01-07 16:12:55')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (349, 'kxtyqh', 'email', '$2b$10$oGC5.q0dE0AjKqMDY/zt8O0q/M4/X8HMvgZukE4KydjS6NMDpeSwu', '2026-01-08 10:00:31', 0, 0, '2026-01-08 15:25:31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (350, 'yasheerali@gmail.com', 'email', '$2b$10$EGvko47bk8vUUAMhetQ0GOiYuFT2K9rq3B8O5gXFT8lz5wiIKBxhK', '2026-01-08 16:40:03', 0, 1, '2026-01-08 16:35:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (351, 'yasheeerali@gmail.com', 'email', '$2b$10$f9/sQ1VHTa7/TtRaX/Ew4udvf2RbD8nuaEoRNacGPrTQAq51kwY2K', '2026-01-08 16:41:01', 1, 0, '2026-01-08 16:36:01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (352, 'yasheeerali@gmail.com', 'email', '$2b$10$lgq609ZjKBzvdxOuaMcCGO9zuBXL096SIeMLuD4Pxcyq5bIlOE64G', '2026-01-08 16:45:03', 1, 0, '2026-01-08 16:40:03')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (353, 'yasheeerali@gmail.com', 'email', '$2b$10$UHJgVVBku/j76YBBawSEJe6wjYn9FrWGZI.dPST59eZspsVunRebq', '2026-01-08 16:46:35', 1, 0, '2026-01-08 16:41:35')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (354, 'kxtyqh', 'email', '$2b$10$RrdNUuwLxDwFcLcbpFExBOUEfKQBdpDnCOyQnomOc/EIFQYCm9X3u', '2026-01-08 11:29:39', 0, 0, '2026-01-08 16:54:39')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (355, 'kxtyqh', 'email', '$2b$10$KKNHHvvGXhiDX35n6l.Dkup7YpT4TfbyyK7mPWoMQxWYi8M3MWQcu', '2026-01-08 13:00:07', 0, 0, '2026-01-08 18:25:07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO otp_table (id, recipient, contact_type, otp_hash, expires_at, verified, is_active, created_at)
VALUES (356, 'jhhzqy', 'email', '$2b$10$VBC/oelZO40RhizYGZrwKeFMGhRrZCn7WUH1d7BR1IWpDz1koZsme', '2026-01-08 13:12:21', 0, 1, '2026-01-08 18:37:21')
ON CONFLICT (id) DO NOTHING;

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

-- Verify final count (should be 360)
SELECT COUNT(*) as total FROM otp_table;
