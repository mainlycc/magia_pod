"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookingForm } from "@/components/booking-form";

export default function ReservePage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = use(params instanceof Promise ? params : Promise.resolve(params));

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Rezerwacja wycieczki</h1>
          <p className="text-muted-foreground text-sm">
            Wypełnij dane kontaktowe, listę uczestników oraz zaakceptuj wymagane zgody, aby wysłać rezerwację.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href={`/trip/${slug}`}>Wróć do szczegółów</Link>
        </Button>
      </div>

      <BookingForm slug={slug} />
    </div>
  );
}


