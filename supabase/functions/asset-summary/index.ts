import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createHandler } from "../_shared/assistantHandler.ts";
Deno.serve(createHandler({ createClient, env: (key) => Deno.env.get(key) }));
