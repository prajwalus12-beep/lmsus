import os
from supabase import create_client, Client
import streamlit as st

@st.cache_resource
def get_supabase_client() -> Client:
    # Uses service role key for admin transactions (e.g. bypass RLS for proration updates)
    url = os.environ.get("SUPABASE_URL") or st.secrets.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or st.secrets.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        st.error("SUPABASE_URL or SUPABASE_SERVICE_KEY missing from environment/secrets.")
    return create_client(url, key)
