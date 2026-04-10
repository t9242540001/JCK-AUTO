"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { CONTACTS } from "@/lib/constants";
import LeadFormModal from "@/components/LeadFormModal";

interface CarSidebarActionsProps {
  carName: string;
}

export default function CarSidebarActions({ carName }: CarSidebarActionsProps) {
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);

  return (
    <>
      {/* Main CTA button */}
      <button
        onClick={() => setIsLeadFormOpen(true)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-medium text-white transition-colors hover:bg-primary/90"
      >
        <FileText className="h-5 w-5" />
        Оставить заявку — перезвоним
      </button>

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

      {/* Lead form modal */}
      <LeadFormModal
        isOpen={isLeadFormOpen}
        onClose={() => setIsLeadFormOpen(false)}
        carName={carName}
      />
    </>
  );
}
