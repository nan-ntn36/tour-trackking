import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// cái này cần làm lại 
const SUPABASE_URL = "https://tlwgglufjtmgoresvbgy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FVC9KEylwfwAodCpyJP27Q_lUg6V_22";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Không cần cho React Native
    },
});
