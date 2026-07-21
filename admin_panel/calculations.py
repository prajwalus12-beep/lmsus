import datetime
from dateutil.relativedelta import relativedelta

def calculate_requested_days(start_date: datetime.date, end_date: datetime.date, holiday_dates: set, is_sandwich_enabled: bool, leave_type: str, is_half_day: bool = False):
    if is_half_day:
        return 0.5, leave_type
        
    # Rule 37 Check: If CL and duration > 4 calendar days, convert to PL
    calendar_duration = (end_date - start_date).days + 1
    effective_type = "PL" if (leave_type == "CL" and calendar_duration > 4) else leave_type
    
    days = 0
    current_date = start_date
    
    # Rule: CL and PL have sandwich if enabled.
    apply_sandwich = (leave_type in ["CL", "PL"] and is_sandwich_enabled)
    
    while current_date <= end_date:
        # Check if day is weekend (Saturday = 5, Sunday = 6 in python weekday())
        is_wknd = current_date.weekday() in [5, 6]
        is_hol = str(current_date) in holiday_dates
        
        if apply_sandwich:
            days += 1
        else:
            if not is_wknd and not is_hol:
                days += 1
        current_date += datetime.timedelta(days=1)
        
    return float(days), effective_type

def calculate_monthly_pl_accrual(supabase_client, user_id: str, year: int, month: int):
    # Retrieve configurations from database
    configs = supabase_client.table("system_configs").select("*").execute().data
    config_dict = {c['key']: c['value'] for c in configs}
    
    rate = float(config_dict.get("ACCRUAL_RATE_PL", 1.5))
    base_days = int(config_dict.get("ACCRUAL_BASE_DAYS", 20))
    threshold = int(config_dict.get("MIN_WORKED_DAYS_FOR_PL", 15))
    
    # Get month boundaries
    start_date = datetime.date(year, month + 1, 1)
    # Get last day of month
    if month == 11: 
        end_date = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        end_date = datetime.date(year, month + 2, 1) - datetime.timedelta(days=1)
        
    total_days = (end_date - start_date).days + 1
    
    # Count weekends
    weekends_count = 0
    curr = start_date
    while curr <= end_date:
        if curr.weekday() in [5, 6]:
            weekends_count += 1
        curr += datetime.timedelta(days=1)
        
    # Query holidays
    holidays = supabase_client.table("holidays").select("date").gte("date", start_date.isoformat()).lte("date", end_date.isoformat()).execute().data
    holidays_count = len(holidays)
    
    # Query approved leaves within the month
    leaves = supabase_client.table("leave_requests").select("*").eq("user_id", user_id).eq("status", "HR_APPROVED").execute().data
    
    include_paid = config_dict.get("INCLUDE_PAID_LEAVE_IN_ACCRUAL", "false").lower() == "true"
    holiday_dates_set = {h['date'].split('T')[0] for h in holidays}

    leave_days_count = 0
    for l in leaves:
        is_paid_leave = l['type'].upper() != 'LOP'
        if include_paid and is_paid_leave:
            continue

        l_start = datetime.datetime.fromisoformat(l['start_date'].replace('Z', '')).date()
        l_end = datetime.datetime.fromisoformat(l['end_date'].replace('Z', '')).date()
        
        # Overlap boundaries
        overlap_start = max(start_date, l_start)
        overlap_end = min(end_date, l_end)
        
        if overlap_start <= overlap_end:
            curr = overlap_start
            while curr <= overlap_end:
                is_wknd = curr.weekday() in [5, 6]
                is_hol = curr.isoformat() in holiday_dates_set
                if not is_wknd and not is_hol:
                    leave_days_count += 1
                curr += datetime.timedelta(days=1)
            
    working_days = total_days - weekends_count - holidays_count - leave_days_count
    
    if working_days < threshold:
        return 0.0, f"Working days ({working_days}) below threshold ({threshold})"
        
    accrued = (working_days / base_days) * rate if base_days > 0 else 0.0
    return round(accrued, 2), "Eligible"

def sync_user_ledger(supabase_client, user_id: str, year: int = 2026):
    start_of_year = f"{year}-01-01T00:00:00Z"
    end_of_year = f"{year}-12-31T23:59:59Z"
    
    # 1. Fetch user profile, holiday settings, and configurations
    user = supabase_client.table("profiles").select("*, leave_balances(*)").eq("id", user_id).single().execute().data
    holidays = supabase_client.table("holidays").select("date").execute().data
    sandwich_rule = supabase_client.table("system_configs").select("value").eq("key", "weekend_sandwich_rule").single().execute().data
    
    if not user or not user.get('leave_balances'):
        return
        
    holiday_dates = {h['date'].split('T')[0] for h in holidays}
    is_sandwich_enabled = (sandwich_rule.get('value') == 'true') if sandwich_rule else False
    
    # 2. Delete existing ledger entries for this user/year
    supabase_client.table("leave_ledger_entries").delete().eq("user_id", user_id).gte("date", start_of_year).lte("date", end_of_year).execute()
    
    # 3. Pull all updates
    approved_leaves = supabase_client.table("leave_requests").select("*").eq("user_id", user_id).eq("status", "HR_APPROVED").order("start_date").execute().data
    adjustments = supabase_client.table("leave_balance_adjustments").select("*").eq("user_id", user_id).eq("effective_year", year).order("created_at").execute().data
    
    # Extract opening variables
    balance_rec = user['leave_balances'][0] if isinstance(user['leave_balances'], list) else user['leave_balances']
    opening_cl = balance_rec['opening_cl']
    opening_pl = balance_rec['opening_pl']
    
    cl_bal = opening_cl
    pl_bal = opening_pl
    
    ledger_entries = []
    
    # Add Opening Log
    ledger_entries.append({
        "user_id": user_id,
        "date": start_of_year,
        "type": "OPENING",
        "description": f"Opening Balance — 1 Jan {year}",
        "cl_credit": opening_cl,
        "pl_credit": opening_pl,
        "cl_balance": cl_bal,
        "pl_balance": pl_bal,
        "is_opening": True
    })
    
    # Sort events chronologically
    events = []
    for l in approved_leaves:
        events.append({"kind": "leave", "date": l['start_date'], "data": l})
    for a in adjustments:
        events.append({"kind": "adj", "date": a['created_at'], "data": a})
    events.sort(key=lambda x: x['date'])
    
    for ev in events:
        if ev['kind'] == 'leave':
            leave = ev['data']
            start_dt = datetime.datetime.fromisoformat(leave['start_date'].replace('Z', '')).date()
            end_dt = datetime.datetime.fromisoformat(leave['end_date'].replace('Z', '')).date()
            
            days, eff_type = calculate_requested_days(start_dt, end_dt, holiday_dates, is_sandwich_enabled, leave['type'], leave['half_day'] != 'NONE')
            
            cl_debit, pl_debit = None, None
            if eff_type == 'CL':
                cl_debit = days
                cl_bal -= days
            elif eff_type == 'PL':
                pl_debit = days
                pl_bal -= days
            else:
                continue
                
            ledger_entries.append({
                "user_id": user_id,
                "date": leave['start_date'],
                "type": eff_type, # Use effective type (Rule 37)
                "description": leave['reason'],
                "start_date": leave['start_date'],
                "end_date": leave['end_date'],
                "days": days,
                "cl_debit": cl_debit,
                "pl_debit": pl_debit,
                "cl_balance": cl_bal,
                "pl_balance": pl_bal
            })
            
        else:
            adj = ev['data']
            amount = adj['amount']
            cl_debit, cl_credit, pl_debit, pl_credit = None, None, None, None
            
            if adj['leave_type'] == 'CL':
                if amount < 0:
                    cl_debit = abs(amount)
                else:
                    cl_credit = amount
                cl_bal += amount
            elif adj['leave_type'] == 'PL':
                if amount < 0:
                    pl_debit = abs(amount)
                else:
                    pl_credit = amount
                pl_bal += amount
                
            ledger_entries.append({
                "user_id": user_id,
                "date": adj['created_at'],
                "type": "ACCRUAL" if adj['adjustment_type'] == "MONTHLY_ACCRUAL" else f"ADJ-{adj['leave_type']}",
                "description": adj['reason'],
                "days": abs(amount),
                "cl_debit": cl_debit,
                "cl_credit": cl_credit,
                "cl_balance": cl_bal,
                "pl_debit": pl_debit,
                "pl_credit": pl_credit,
                "pl_balance": pl_bal,
                "is_adjustment": True
            })
            
    # Add Closing Record
    ledger_entries.append({
        "user_id": user_id,
        "date": datetime.datetime.utcnow().isoformat() + "Z",
        "type": "CLOSING",
        "description": "Closing Balance (as of today)",
        "cl_balance": cl_bal,
        "pl_balance": pl_bal,
        "is_closing": True
    })
    
    # Bulk insert entries to Supabase
    if ledger_entries:
        supabase_client.table("leave_ledger_entries").insert(ledger_entries).execute()
