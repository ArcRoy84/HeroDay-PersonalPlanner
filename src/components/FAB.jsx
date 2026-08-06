import React, { useState } from 'react';

export default function FAB({ onClick }) {
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
    onClick();
  };

  return (
    <button
      className={`fab ${pressed ? 'pressed' : ''}`}
      onClick={handleClick}
      title="New task (N)"
      aria-label="Add new task"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="11" y1="4" x2="11" y2="18" />
        <line x1="4" y1="11" x2="18" y2="11" />
      </svg>
      <span className="fab-label">New task</span>
    </button>
  );
}
