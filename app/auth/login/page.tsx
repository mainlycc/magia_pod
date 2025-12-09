import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <LoginForm />
        <Button asChild variant="outline" className="w-full">
          <Link href="/trip">Zobacz wycieczki</Link>
        </Button>
      </div>
    </div>
  );
}
