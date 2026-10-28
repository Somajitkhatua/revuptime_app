import React from "react";
import Svg, { Path } from "react-native-svg";

/** Circular machine-health mark from the supplied RevUpTime reference. */
export default function RevUpTimeLogo({
  size = 82,
  variant = "inverse",
}: {
  size?: number;
  variant?: "inverse" | "brand";
}) {
  if (variant === "brand")
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        accessibilityLabel="RevUpTime logo"
      >
        <Path
          d="M16 41A35 35 0 0 1 80 28"
          fill="none"
          stroke="#102744"
          strokeWidth="9"
        />
        <Path
          d="M85 56A35 35 0 0 1 17 61"
          fill="none"
          stroke="#102744"
          strokeWidth="9"
        />
        <Path
          d="M7 51H29L40 34L52 69L63 49H75L86 39"
          fill="none"
          stroke="#0085FF"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M75 33L92 33L91 51L85 43Z" fill="#0085FF" />
      </Svg>
    );
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityLabel="RevUpTime logo"
    >
      <Path
        d="M18 49A33 33 0 0 1 67 21"
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Path d="M64 12L72 25L57 27" fill="white" />
      <Path
        d="M82 51A33 33 0 0 1 33 79"
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Path d="M36 88L28 75L43 73" fill="white" />
      <Path
        d="M12 55H33L43 32L53 72L64 48H89"
        fill="none"
        stroke="#1B96FF"
        strokeWidth="6"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
