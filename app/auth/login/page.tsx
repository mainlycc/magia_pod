import { LoginForm } from "@/components/login-form";
import Image from "next/image";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo23.png"
            alt="Magia podróżowania"
            width={72}
            height={72}
            className="size-[72px] object-contain"
            priority
          />
          <div className="text-sm font-semibold leading-none tracking-tight">
            <span className="block">MAGIA</span>
            <span className="block mt-0.5">PODRÓŻOWANIA</span>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
