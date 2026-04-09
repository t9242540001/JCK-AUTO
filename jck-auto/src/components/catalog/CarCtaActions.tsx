"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import LeadFormModal from "@/components/LeadFormModal";

interface CarCtaActionsProps {
  carName: string;
}

export default function CarCtaActions({ carName }: CarCtaActionsProps) {
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);

  return (
    <>
      {/* Lead form button */}
      <button
        onClick={() => setIsLeadFormOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 px-8 py-4 font-medium text-white transition-colors hover:bg-white/30"
      >
        <FileText className="h-5 w-5" />
        Оставить заявку
      </button>

      <LeadFormModal
        isOpen={isLeadFormOpen}
        onClose={() => setIsLeadFormOpen(false)}
        carName={carName}
      />
    </>
  );
}
