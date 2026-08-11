// src/components/BankLogo.jsx
import React, { useState } from "react";
import { getBankLogoUrl } from "../data/bankLogos";

/**
 * Deterministic color palette for fallback avatars.
 */
const colorPalette = [
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#cddc39",
  "#ff9800",
  "#ff5722",
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getColorForBank(bankName) {
  const idx = hashString(bankName) % colorPalette.length;
  return colorPalette[idx];
}

const BankLogo = ({ bankName = "", size = 48, className = "" }) => {
  const [error, setError] = useState(false);
  const safeName = bankName || "";
  const logoUrl = getBankLogoUrl(safeName);

  if (!logoUrl || error) {
    const initials = safeName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
    const bg = getColorForBank(safeName);
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          backgroundColor: bg,
          color: "white",
          borderRadius: "0.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "600",
          fontSize: size / 2.5,
        }}
        aria-label={`${safeName} logo placeholder`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={logoUrl}
        alt={`${safeName} logo`}
        onError={() => setError(true)}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
};

export default BankLogo;
