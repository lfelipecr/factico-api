"use client";

import { createClient } from "@/lib/supabase/client";

export async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("No hay sesión activa");
  }
  return data.session.access_token;
}
