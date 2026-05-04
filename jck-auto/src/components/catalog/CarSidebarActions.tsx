"use client";

import { FileText } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import LeadFormTrigger from "@/components/LeadFormTrigger";

interface CarSidebarActionsProps {
  carName: string;
}

export default function CarSidebarActions({ carName }: CarSidebarActionsProps) {
  return (
    <>
      {/* Main CTA — LeadFormTrigger opens modal with LeadForm */}
      <LeadFormTrigger
        triggerLabel="Оставить заявку — перезвоним"
        triggerVariant="primary"
        triggerIcon={<FileText className="h-5 w-5" />}
        subject={`Заявка на ${carName}`}
        source="catalog-car-detail"
        className="mt-6"
      />

      {/* Phone */}
      <p className="mt-2 text-center text-xs text-gray-400">
        или позвоните:{" "}
        <a
          href={`tel:${CONTACTS.phoneRaw}`}
          className="text-gray-500 hover:text-primary"
        >
          {CONTACTS.phone}
        </a>
      </p>
    </>
  );
}
