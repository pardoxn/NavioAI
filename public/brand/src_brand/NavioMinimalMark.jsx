// src/brand/NavioMinimalMark.jsx
import React from 'react';

export default function NavioMinimalMark({ size = 64, tile = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-label="Navio AI">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60A5FA"/>
          <stop offset="100%" stopColor="#06B6D4"/>
        </linearGradient>
      </defs>
      {tile ? <rect x="0" y="0" width="512" height="512" rx="96" fill="#0F172A" /> : null}
      <path d="M128 384 L128 128 L384 384 L384 128" fill="none" stroke="url(#g)" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
