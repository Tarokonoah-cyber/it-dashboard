import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 112,
          background: "#102a49",
          color: "#ffffff",
          fontSize: 260,
          fontWeight: 900,
          letterSpacing: -18
        }}
      >
        T
        <div
          style={{
            width: 46,
            height: 46,
            marginLeft: -22,
            marginTop: -210,
            background: "#f5c84b"
          }}
        />
      </div>
    ),
    size
  );
}
