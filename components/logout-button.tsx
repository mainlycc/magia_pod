"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
    } catch (error) {
      // Jeśli wystąpi błąd, nadal przekieruj do logowania
      console.error("Błąd podczas wylogowywania:", error);
      router.push("/auth/login");
    }
  };

  return <Button onClick={logout}>Logout</Button>;
}
