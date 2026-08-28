import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient(): Promise<
  ReturnType<typeof createSupabaseServerClient>
> {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options } as any);
          } catch (error) {
            // Handle error if needed
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options } as any);
          } catch (error) {
            // Handle error if needed
          }
        },
      },
    },
  );
}
