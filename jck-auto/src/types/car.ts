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
  createdAt: string;
}
