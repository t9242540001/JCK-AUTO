const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

export function getGoogleDriveFolderId(): string {
  return requiredEnv("GOOGLE_DRIVE_FOLDER_ID");
}

export function getGoogleServiceAccountKey(): Record<string, unknown> {
  const raw = requiredEnv("GOOGLE_SERVICE_ACCOUNT_KEY");
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Ensure the entire JSON is in a single env variable."
    );
  }
}

export function getAnthropicApiKey(): string {
  return requiredEnv("ANTHROPIC_API_KEY");
}
