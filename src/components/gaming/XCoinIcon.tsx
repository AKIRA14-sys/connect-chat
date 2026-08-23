import type { SVGProps } from "react";

type XCoinIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function XCoinIcon({
  size = 32,
  ...props
}: XCoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="X Coin"
      role="img"
      {...props}
    >
      {/* Outer coin */}
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="currentColor"
        opacity="0.18"
      />

      {/* Main coin */}
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="currentColor"
      />

      {/* Inner coin rim */}
      <circle
        cx="32"
        cy="32"
        r="21"
        fill="none"
        stroke="white"
        strokeWidth="2"
        opacity="0.45"
      />

      {/* X symbol */}
      <path
        d="M22 20L32 30L42 20"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M22 44L32 34L42 44"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default XCoinIcon;