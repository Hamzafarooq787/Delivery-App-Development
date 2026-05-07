"use client"

import dynamic from "next/dynamic"

export type { DriverPinType } from "./multi-driver-map"

export const MultiDriverMapDynamic = dynamic(
  () => import("./multi-driver-map").then((m) => m.MultiDriverMap),
  {
    ssr: false,
    loading: () => (
      <div style={{ background: "#0e0e0e", borderRadius: 12, height: "100%", width: "100%" }} />
    ),
  }
)
