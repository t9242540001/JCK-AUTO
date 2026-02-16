import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "JCK AUTO — импорт автомобилей из Китая, Кореи и Японии";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1E3A5F",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
        }}
      >
        <div
          style={{
            color: "#C9A84C",
            fontSize: 72,
            fontWeight: 900,
            marginBottom: 20,
          }}
        >
          JCK AUTO
        </div>
        <div
          style={{
            color: "white",
            fontSize: 32,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Импорт автомобилей из Китая, Кореи и Японии с полным сопровождением
        </div>
        <div style={{ color: "#9CA3AF", fontSize: 24, marginTop: 30 }}>
          jckauto.ru
        </div>
      </div>
    ),
    { ...size },
  );
}
