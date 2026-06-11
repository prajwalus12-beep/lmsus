import streamlit as st
import pandas as pd
from supabase_client import get_supabase_client
from calculations import calculate_monthly_pl_accrual, sync_user_ledger
import datetime

st.set_page_config(layout="wide", page_title="LMS Admin Engine")
st.title("LMS Admin Engine")

try:
    supabase = get_supabase_client()
except Exception as e:
    st.error(f"Failed to connect to Supabase: {e}")
    st.stop()

menu = ["Policy Configuration", "Trigger Monthly Accrual", "Year-End Closure", "System Date Override"]
choice = st.sidebar.selectbox("Admin Menu", menu)

if choice == "Policy Configuration":
    st.header("Configure Leave Policies")
    
    # Fetch configurations
    configs = supabase.table("system_configs").select("*").execute().data
    if configs:
        df = pd.DataFrame(configs)
        st.dataframe(df[["key", "value", "description"]])
        
        with st.form("edit_config"):
            key_to_edit = st.selectbox("Select Setting Key", df["key"].tolist())
            new_val = st.text_input("New Value")
            submitted = st.form_submit_button("Update Configuration")
            
            if submitted:
                supabase.table("system_configs").update({"value": new_val}).eq("key", key_to_edit).execute()
                st.success(f"Updated {key_to_edit} to {new_val}")
                st.rerun()
    else:
        st.info("No configurations found.")

elif choice == "Trigger Monthly Accrual":
    st.header("Trigger PL Accruals")
    
    col1, col2 = st.columns(2)
    with col1:
        year = st.number_input("Accrual Year", min_value=2020, max_value=2100, value=2026)
    with col2:
        month_idx = st.selectbox("Accrual Month", list(range(12)), format_func=lambda x: datetime.date(2026, x+1, 1).strftime('%B'))
        
    if st.button("Calculate & Apply Accruals for Active Employees"):
        active_users = supabase.table("profiles").select("id, name").eq("status", "ACTIVE").execute().data
        
        results = []
        for user in active_users:
            accrued, reason = calculate_monthly_pl_accrual(supabase, user['id'], year, month_idx)
            if accrued > 0:
                # Apply update to live balance
                balance_data = supabase.table("leave_balances").select("pl, pl_accrued").eq("user_id", user['id']).single().execute().data
                if balance_data:
                    new_pl = balance_data['pl'] + accrued
                    new_accrued = balance_data['pl_accrued'] + accrued
                    
                    # Update DB
                    supabase.table("leave_balances").update({"pl": new_pl, "pl_accrued": new_accrued}).eq("user_id", user['id']).execute()
                    
                    # Log adjustment
                    supabase.table("leave_balance_adjustments").insert({
                        "user_id": user['id'],
                        "leave_type": "PL",
                        "amount": accrued,
                        "adjustment_type": "MONTHLY_ACCRUAL",
                        "reason": f"Accrual for {month_idx+1}/{year}",
                        "effective_year": year,
                        "entered_by": "00000000-0000-0000-0000-000000000000", # System placeholder
                        "entered_by_name": "System (Auto)"
                    }).execute()
                    
                    # Re-sync personal ledger
                    sync_user_ledger(supabase, user['id'], year)
                    
                    results.append({"Employee": user['name'], "Accrued (Days)": accrued, "Status": "Success"})
            else:
                results.append({"Employee": user['name'], "Accrued (Days)": 0.0, "Status": reason})
                
        if results:
            st.dataframe(pd.DataFrame(results))
            st.success("Accrual cycle execution completed.")
        else:
            st.warning("No active employees found to process.")

elif choice == "Year-End Closure":
    st.header("Execute Year-End Balance Rollovers")
    year_to_close = st.number_input("Year to Reset & Close", min_value=2020, max_value=2100, value=2026)
    
    st.warning("⚠️ Running year-end closures carries forward up to 30 PL days, resets CL/SL entitlements, and lapses excess balances.")
    
    if st.button("Execute Annual Rollovers"):
        balances = supabase.table("leave_balances").select("*, profiles(name)").execute().data
        
        for bal in balances:
            current_pl = bal['pl']
            carry_forward = min(current_pl, 30.0)
            expired = max(0.0, current_pl - 30.0)
            
            # Archive Carry Forward
            supabase.table("carry_forward_histories").insert({
                "user_id": bal['user_id'],
                "from_year": year_to_close,
                "to_year": year_to_close + 1,
                "leave_type": "PL",
                "carry_forward_days": carry_forward,
                "expired_days": expired,
                "processed_by": "00000000-0000-0000-0000-000000000000"
            }).execute()
            
            # Reset Balance record
            supabase.table("leave_balances").update({
                "year": year_to_close + 1,
                "opening_pl": carry_forward,
                "opening_cl": 7.0,
                "opening_comp": 0.0,
                "pl": carry_forward,
                "cl": 7.0,
                "sl": 7.0,
                "comp": 0.0,
                "pl_accrued": 0.0,
                "pl_used": 0.0,
                "cl_used": 0.0,
                "sl_used": 0.0,
                "pl_carry_forward": carry_forward
            }).eq("id", bal['id']).execute()
            
        supabase.table("leave_year_closures").insert({
            "year": year_to_close,
            "closed_by": "00000000-0000-0000-0000-000000000000",
            "status": "CLOSED"
        }).execute()
        
        st.success("All balances reset. Carry-forwards computed and logged.")

elif choice == "System Date Override":
    st.header("Test Mode / Date Override")
    
    current_override = supabase.table("system_date_overrides").select("*").order("created_at", descending=True).limit(1).execute().data
    
    if current_override:
        ov = current_override[0]
        st.info(f"Current Status: {'TEST MODE ACTIVE' if ov['is_test_mode'] else 'NORMAL MODE'}")
        if ov['override_date']:
            st.info(f"Overridden Date: {ov['override_date']}")
            
    with st.form("date_override"):
        is_test = st.checkbox("Enable Test Mode")
        new_date = st.date_input("Override Date")
        reason = st.text_area("Reason for override")
        submit = st.form_submit_button("Update System Date")
        
        if submit:
            supabase.table("system_date_overrides").insert({
                "is_test_mode": is_test,
                "override_date": new_date.isoformat(),
                "reason": reason,
                "changed_by": "00000000-0000-0000-0000-000000000000",
                "changed_by_name": "Admin (Streamlit)"
            }).execute()
            st.success("System date configuration updated.")
            st.rerun()
