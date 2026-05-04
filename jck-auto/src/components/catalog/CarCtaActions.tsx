"use client";

import { FileText } from "lucide-react";
import LeadFormTrigger from "@/components/LeadFormTrigger";

interface CarCtaActionsProps {
  carName: string;
}

export default function CarCtaActions({ carName }: CarCtaActionsProps) {
  return (
    <LeadFormTrigger
      triggerLabel="Оставить заявку"
      triggerVariant="on-primary-soft"
      triggerIcon={<FileText className="h-5 w-5" />}
      subject={`Заявка на ${carName}`}
      source="catalog-car-detail"
    />
  );
}
