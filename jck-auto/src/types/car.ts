export interface Car {
  id: string;
  folderName: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  currency: "CNY" | "KRW" | "JPY";
  country: "china" | "korea" | "japan";
  mileage: number;
  engineVolume: number;
  transmission: "AT" | "MT";
  drivetrain: string;
  fuelType: string;
  color: string;
  power: number;
  bodyType: string;
  photos: string[];
  features: string[];
  condition: string;
  location: string;
  isNativeMileage: boolean;
  hasInspectionReport: boolean;
  description?: string;
  needsAiProcessing?: boolean;
  priceRub?: number;
  exchangeRate?: number;
  priceCalculatedAt?: string;
  priceBreakdown?: {
    carPriceRub: number;
    customsFee: number;
    customsDuty: number;
    recyclingFee: number;
    deliveryCost: number;
    serviceFee: number;
  };
  createdAt: string;
}

export interface DriveCarFolder {
  folderId: string;
  folderName: string;
  screenshotFileId: string;
  photoFileIds: string[];
}

export interface SyncResult {
  added: string[];
  removed: string[];
  updated: string[];
  errors: { folder: string; error: string }[];
}
