import React from 'react';

const CustomMenuIcon = ({ className, size = 24, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 8h16" />
      <path d="M4 16h12" />
    </svg>
  );
};

export default CustomMenuIcon;