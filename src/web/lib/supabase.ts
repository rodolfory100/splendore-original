import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://orovbbxhzizbpphggqxa.supabase.co";
const SUPABASE_KEY = "sb_publishable_E_XcTVRHg1VHePc2S1xH7w_l4cFkhJ7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
