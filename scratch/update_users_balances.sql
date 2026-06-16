-- 0. Ensure schema consistency
ALTER TABLE leave_ledger_entries ADD COLUMN IF NOT EXISTS comp_debit FLOAT;
ALTER TABLE leave_ledger_entries ADD COLUMN IF NOT EXISTS comp_credit FLOAT;
ALTER TABLE leave_ledger_entries ADD COLUMN IF NOT EXISTS comp_balance FLOAT DEFAULT 0;

-- 1. Riyanshu Subhashchandra Gupta (826ac260-6d80-4e3f-8034-26725a2aa248)
-- 2. Eshrat Eshrat Mehboob Khan (088c4acc-6f51-470f-90d4-e613ad62b785)

-- =====================================================================
-- RIYANSHU SUBHASHCHANDRA GUPTA
-- =====================================================================

-- Update profile
UPDATE profiles SET 
    join_date = '2025-05-15 00:00:00+00', 
    status = 'ACTIVE', 
    updated_at = NOW() 
WHERE id = '826ac260-6d80-4e3f-8034-26725a2aa248';

-- Update Leave Balances for 2026
-- Opening PL (Total) 12 = Base 9 + CF 3
-- Transactions: +1.5 PL Accrual, -1.0 PL Used, -1.0 CL Used, +1.0 Comp
-- Final PL: 12 + 1.5 - 1.0 = 12.5
-- Final CL: 9 - 1.0 = 8.0
UPDATE leave_balances SET 
    year = 2026, 
    opening_pl = 9.0, 
    opening_cl = 9.0, 
    opening_comp = 0.0, 
    pl = 12.5, 
    cl = 8.0, 
    sl = 0.0, 
    comp = 1.0, 
    lop = 0.0, 
    mat = 0.0, 
    pl_accrued = 1.5, 
    pl_used = 1.0, 
    cl_used = 1.0, 
    sl_used = 0.0, 
    pl_carry_forward = 3.0, 
    updated_at = NOW() 
WHERE user_id = '826ac260-6d80-4e3f-8034-26725a2aa248';

-- Carry Forward History
INSERT INTO carry_forward_histories (id, user_id, from_year, to_year, leave_type, carry_forward_days, expired_days, max_carry_limit, processed_by) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', 2025, 2026, 'PL', 3.0, 0.0, 30.0, 'bac371b3-bfb0-44ad-bc46-48aa21d4045b');

-- Leave Requests
-- Request 1: CL request for 1.0 day (2026-02-10)
INSERT INTO leave_requests (id, user_id, type, start_date, end_date, half_day, reason, status, is_negative, negative_amount, year, approved_by_id, approved_at, created_at, updated_at) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', 'CL', '2026-02-10 00:00:00+00', '2026-02-10 23:59:59+00', 'NONE', 'Family Wedding', 'HR_APPROVED', FALSE, 0.0, 2026, 'bac371b3-bfb0-44ad-bc46-48aa21d4045b', '2026-02-09 10:00:00+00', '2026-02-08 09:00:00+00', '2026-02-09 10:00:00+00');

-- Request 2: PL request for 1.0 day (2026-03-10)
INSERT INTO leave_requests (id, user_id, type, start_date, end_date, half_day, reason, status, is_negative, negative_amount, year, approved_by_id, approved_at, created_at, updated_at) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', 'PL', '2026-03-10 00:00:00+00', '2026-03-10 23:59:59+00', 'NONE', 'Doctor Appointment', 'HR_APPROVED', FALSE, 0.0, 2026, 'bac371b3-bfb0-44ad-bc46-48aa21d4045b', '2026-03-09 10:00:00+00', '2026-03-08 09:00:00+00', '2026-03-09 10:00:00+00');

-- Leave Balance Adjustments (PL Accrual)
INSERT INTO leave_balance_adjustments (id, user_id, leave_type, amount, adjustment_type, reason, effective_year, entered_by, entered_by_name, created_at) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', 'PL', 1.5, 'MONTHLY_ACCRUAL', 'Monthly PL Accrual (Jan 2026)', 2026, 'bac371b3-bfb0-44ad-bc46-48aa21d4045b', 'System (Auto)', '2026-02-01 00:00:05+00');

-- Comp-Off Work Entry
INSERT INTO comp_off_work_entries (id, user_id, date_worked, hours_worked, reason, status, expiry_date, days_credited, approved_by_id, approved_at) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', '2026-05-01 00:00:00+00', 8.0, 'Production Release', 'APPROVED', '2026-08-01 00:00:00+00', 1.0, 'bac371b3-bfb0-44ad-bc46-48aa21d4045b', '2026-05-02 10:00:00+00');

-- Ledger Entries
INSERT INTO leave_ledger_entries (id, user_id, date, type, description, is_opening, cl_balance, pl_balance, comp_balance) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', '2026-01-01 00:00:00+00', 'OPENING', 'Opening Balance — 1 Jan 2026', TRUE, 9.0, 12.0, 0.0);

INSERT INTO leave_ledger_entries (id, user_id, date, type, description, is_adjustment, days, pl_credit, cl_balance, pl_balance) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', '2026-02-01 00:00:05+00', 'ACCRUAL', 'Monthly PL Accrual (Jan 2026)', TRUE, 1.5, 1.5, 9.0, 13.5);

INSERT INTO leave_ledger_entries (id, user_id, date, type, description, start_date, end_date, days, cl_debit, cl_balance, pl_balance) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', '2026-02-10 00:00:00+00', 'CL', 'Family Wedding', '2026-02-10 00:00:00+00', '2026-02-10 23:59:59+00', 1.0, 1.0, 8.0, 13.5);

INSERT INTO leave_ledger_entries (id, user_id, date, type, description, start_date, end_date, days, pl_debit, cl_balance, pl_balance) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', '2026-03-10 00:00:00+00', 'PL', 'Doctor Appointment', '2026-03-10 00:00:00+00', '2026-03-10 23:59:59+00', 1.0, 1.0, 8.0, 12.5);

INSERT INTO leave_ledger_entries (id, user_id, date, type, description, is_adjustment, days, comp_credit, cl_balance, pl_balance, comp_balance) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', '2026-05-01 00:00:00+00', 'COMP_OFF', 'Production Release', TRUE, 1.0, 1.0, 8.0, 12.5, 1.0);

INSERT INTO leave_ledger_entries (id, user_id, date, type, description, is_closing, cl_balance, pl_balance, comp_balance) 
VALUES (gen_random_uuid()::text, '826ac260-6d80-4e3f-8034-26725a2aa248', NOW(), 'CLOSING', 'Closing Balance (as of today)', TRUE, 8.0, 12.5, 1.0);


-- =====================================================================
-- ESHRAT ESHRAT MEHBOOB KHAN
-- =====================================================================

-- Update profile
UPDATE profiles SET 
    join_date = '2025-06-01 00:00:00+00', 
    status = 'ACTIVE', 
    updated_at = NOW() 
WHERE id = '088c4acc-6f51-470f-90d4-e613ad62b785';

-- Update Leave Balances for 2026
-- Opening PL (Total) 12 = Base 10 + CF 2
-- No transactions recorded in sheet
UPDATE leave_balances SET 
    year = 2026, 
    opening_pl = 10.0, 
    opening_cl = 9.0, 
    opening_comp = 0.0, 
    pl = 12.0, 
    cl = 9.0, 
    sl = 0.0, 
    comp = 0.0, 
    lop = 0.0, 
    mat = 0.0, 
    pl_accrued = 0.0, 
    pl_used = 0.0, 
    cl_used = 0.0, 
    sl_used = 0.0, 
    pl_carry_forward = 2.0, 
    updated_at = NOW() 
WHERE user_id = '088c4acc-6f51-470f-90d4-e613ad62b785';

-- Carry Forward History
INSERT INTO carry_forward_histories (id, user_id, from_year, to_year, leave_type, carry_forward_days, expired_days, max_carry_limit, processed_by) 
VALUES (gen_random_uuid()::text, '088c4acc-6f51-470f-90d4-e613ad62b785', 2025, 2026, 'PL', 2.0, 0.0, 30.0, 'bac371b3-bfb0-44ad-bc46-48aa21d4045b');

-- Ledger Entries
INSERT INTO leave_ledger_entries (id, user_id, date, type, description, is_opening, cl_balance, pl_balance) 
VALUES (gen_random_uuid()::text, '088c4acc-6f51-470f-90d4-e613ad62b785', '2026-01-01 00:00:00+00', 'OPENING', 'Opening Balance — 1 Jan 2026', TRUE, 9.0, 12.0);

INSERT INTO leave_ledger_entries (id, user_id, date, type, description, is_closing, cl_balance, pl_balance) 
VALUES (gen_random_uuid()::text, '088c4acc-6f51-470f-90d4-e613ad62b785', NOW(), 'CLOSING', 'Closing Balance (as of today)', TRUE, 9.0, 12.0);
