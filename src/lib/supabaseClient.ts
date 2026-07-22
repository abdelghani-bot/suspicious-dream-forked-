import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://glcdvwpwxbhutfecljdj.supabase.co";

export const supabase = createClient(
  SUPABASE_URL,
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsY2R2d3B3eGJodXRmZWNsamRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE1OTIsImV4cCI6MjA5NTU0NzU5Mn0.w-dLQiFTTPzB0eeA7Asf95hy5x7kjA-OvilneYAIHHA"
);
