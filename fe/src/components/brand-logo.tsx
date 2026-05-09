export const BrandLogo = ({ className = 'w-5 h-5 text-white', strokeWidth = 4 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M 60 46 L 60 15 L 40 52 L 85 52 A 25 25 0 0 1 35 52" />
    </svg>
  );
};
