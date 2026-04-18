/**
 * @file        UploadZone.tsx
 * @description Upload zone for the auction-sheet tool: drag & drop region, hidden file input, idle placeholder, and file preview with remove action. Fully controlled — file/preview/dragOver state and validation live in the orchestrator (AuctionSheetClient.tsx); this component only renders and emits events.
 * @rule        This component is fully controlled. Do NOT own `file`, `preview`, or `dragOver` state internally. Do NOT own a revokeObjectURL lifecycle — the parent owns the preview URL string and revokes it in clearFile.
 * @rule        The hidden `<input type="file">` ref is the ONLY ref owned by this component. Do NOT expose it via forwardRef — not needed for current use.
 */

"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { formatSize } from "./auctionSheetHelpers";

export interface UploadZoneProps {
  /** Parent orchestrator's current sub-state. Only "idle" and "preview" reach this component. */
  state: "idle" | "preview";
  /** The file currently selected, or null when state === "idle". */
  file: File | null;
  /** Object URL for the file preview, or null when state === "idle". */
  preview: string | null;
  /** Whether a dragenter/dragover event is currently active on the zone. */
  dragOver: boolean;
  /** Called when the user picks a file via dialog or drop. Parent validates size/type and may transition state to "error". */
  onFileSelect: (file: File) => void;
  /** Called with true on dragover, false on dragleave. Parent stores in state for visual feedback. */
  onDragOverChange: (over: boolean) => void;
  /** Called when the user clicks the X button in preview. Parent resets all file + job state. */
  onClear: () => void;
}

export default function UploadZone({
  state,
  file,
  preview,
  dragOver,
  onFileSelect,
  onDragOverChange,
  onClear,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOverChange(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverChange(true);
      }}
      onDragLeave={() => onDragOverChange(false)}
      onDrop={handleDrop}
      onClick={() => state === "idle" && inputRef.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
        }}
      />

      {state === "idle" && (
        <>
          <Upload className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 font-medium text-text">
            Перетащите фото аукционного листа или нажмите для выбора
          </p>
          <p className="mt-1 text-xs text-text-muted">JPG, PNG, WebP, HEIC — до 10 МБ</p>
        </>
      )}

      {state === "preview" && file && preview && (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
          <img
            src={preview}
            alt="Превью"
            className="h-32 w-auto rounded-xl object-contain"
          />
          <div className="flex-1">
            <p className="font-medium text-text">{file.name}</p>
            <p className="text-sm text-text-muted">{formatSize(file.size)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="mt-2 flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
            >
              <X className="h-3 w-3" /> Убрать
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
