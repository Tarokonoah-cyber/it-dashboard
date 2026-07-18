import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 38,
          background: "#102a49",
          color: "#ffffff",
          fontSize: 92,
          fontWeight: 900
        }}
      >
        T
        <div
          style={{
            width: 16,
            height: 16,
            marginLeft: -8,
            marginTop: -76,
            background: "#f5c84b"
          }}
        />
      </div>
    ),
    size
  );
}
