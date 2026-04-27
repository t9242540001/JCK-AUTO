/**
 * @file        auctionSheetTypes.ts
 * @description TypeScript types for the auction-sheet tool — API response shapes, job status, component state. Mirrors the extended JSON schema defined in src/app/api/tools/auction-sheet/route.ts (PARSE_SYSTEM_PROMPT).
 * @rule        Keep in sync with PARSE_SYSTEM_PROMPT schema in route.ts. A drift between server schema and this interface silently drops fields at the client layer.
 */

export interface BodyDamage {
  location: string;
  code: string;
  description: string;
  severity: "minor" | "moderate" | "major";
}

/**
 * VIN extraction confidence from the parser.
 * - "high" — VIN clearly printed and fully extracted
 * - "medium" — partial or slightly blurred read
 * - "unreadable" — the VIN cell exists on the sheet but characters are illegible
 * - null — there is no VIN cell on the sheet at all
 */
export type VinConfidence = "high" | "medium" | "unreadable" | null;

export interface CarDimensions {
  length: number | null; // cm
  width: number | null;  // cm
  height: number | null; // cm
}

/**
 * Result of formatVin() helper. UI layer decides rendering.
 * - { value: "...", note: null }     — VIN present, high confidence
 * - { value: "...", note: "..." }    — VIN present but partial
 * - { value: null, note: "..." }     — VIN cell exists but unreadable
 * - { value: null, note: null }      — no VIN cell at all
 */
export interface FormattedVin {
  value: string | null;
  note: string | null;
}

export interface AuctionResult {
  auctionName: string | null;
  lotNumber: string | null;
  overallGrade: string | null;
  interiorGrade: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  engineVolume: string | null;
  engineType: string | null;
  transmission: string | null;
  mileage: string | null;
  mileageWarning: boolean;
  color: string | null;
  ownership: string | null;
  // --- fields added 2026-04-18 via Prompt 01 schema extension ---
  vin: string | null;
  vinConfidence: VinConfidence;
  modelCode: string | null;
  registrationNumber: string | null;
  inspectionValidUntil: string | null; // ISO-8601 "YYYY-MM"
  recycleFee: number | null;           // JPY integer
  seats: number | null;
  colorCode: string | null;
  dimensions: CarDimensions | null;
  salesPoints: string[];               // empty [] when no block
  bodyType: string | null;
  // --- end new fields ---
  bodyDamages: BodyDamage[];
  equipment: string[];
  expertComments: string | null;
  unrecognized: string[];
  confidence: "high" | "medium" | "low";
  recommendation: string | null;
  warnings: string[];
}

export interface ApiResponse {
  success: boolean;
  data: AuctionResult;
  meta: { model: string; tokens: number; remaining: number };
}

export interface ApiError {
  error: string;
  message: string;
  /** Seconds until the rate-limit window resets. Present when `error === "rate_limit"`. */
  resetIn?: number;
  /**
   * Remaining requests before the next cooldown or quota sweep.
   * Present only when `error === "rate_limit"`. Semantics:
   *   - `> 0` — the user hit a 2-minute cooldown; they still have quota left.
   *   - `0` + `isLifetimeLimit === true` — anonymous user exhausted the 3-request lifetime quota.
   *   - `0` + `isLifetimeLimit === false` — authenticated user exhausted the daily 10-request quota.
   */
  remaining?: number;
  /**
   * True when the anonymous 3-request lifetime quota is exhausted.
   * Present only when `error === "rate_limit"`. For any other error code, undefined.
   * When `remaining > 0` (cooldown case), this is explicitly `false`.
   */
  isLifetimeLimit?: boolean;
}

export interface AcceptedResponse {
  jobId: string;
  statusUrl: string;
  position: number;
  etaSec: number;
}

export interface JobStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  position: number;
  etaSec: number;
  enqueuedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  result?: {
    data: AuctionResult;
    meta: { model: string; tokens: number; remaining: number };
  };
  error?: string;
}

export interface QueueFullError {
  error: "queue_full";
  message: string;
  queueSize: number;
  maxSize: number;
  retryInSeconds: number;
}

export type State =
  | "idle"
  | "preview"
  | "submitting"
  | "queued"
  | "processing"
  | "result"
  | "error";

/**
 * Discriminated union representing the lifecycle of an auction-sheet
 * decoding job, from accepting the upload through queue → processing
 * → terminal state. Returned by the useAuctionSheetJob hook.
 *
 * Phases:
 * - "idle"        — no active job. Initial state. Also reached after reset().
 * - "queued"      — accepted by server, waiting in queue. position > 0.
 * - "processing"  — pipeline is running on the server. position === 0.
 *                   `stage` rotates through approximate progress steps
 *                   (0=ocr, 1=parse, 2=overrun) based on elapsed time.
 * - "done"        — pipeline returned a result. Terminal.
 * - "failed"      — pipeline threw or job_not_found. Terminal.
 * - "lost"        — orchestrator should treat as terminal failure.
 *                   Distinct phase so orchestrator can render a network
 *                   message instead of pipeline-failure message.
 *
 * Exhaustiveness: every consumer (the orchestrator's reactive useEffect)
 * MUST handle all phases. TypeScript will flag a missing case. Adding
 * a new phase is a deliberate edit — both this union and the consumer
 * must be updated together.
 */
export type JobState =
  | { phase: "idle" }
  | { phase: "queued";     jobId: string; position: number; etaSec: number }
  | { phase: "processing"; jobId: string; stage: number }
  | { phase: "done";       jobId: string; result: AuctionResult; meta: ApiResponse["meta"] }
  | { phase: "failed";     jobId: string | null; error: ApiError }
  | { phase: "lost";       jobId: string | null };
