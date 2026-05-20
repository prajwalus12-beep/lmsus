"use client"

import React from 'react'

export function PuppyLoader() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="puppy-container relative w-32 h-32 mb-4">
        {/* Simple SVG Puppy */}
        <svg viewBox="0 0 100 100" className="w-full h-full animate-bounce">
          {/* Body */}
          <ellipse cx="50" cy="60" rx="25" ry="15" fill="#8B4513" />
          {/* Head */}
          <circle cx="70" cy="45" r="15" fill="#8B4513" />
          {/* Ears */}
          <ellipse cx="60" cy="35" rx="5" ry="10" fill="#5D2E0A" transform="rotate(-20 60 35)" />
          <ellipse cx="80" cy="35" rx="5" ry="10" fill="#5D2E0A" transform="rotate(20 80 35)" />
          {/* Eyes */}
          <circle cx="65" cy="42" r="2" fill="white" />
          <circle cx="75" cy="42" r="2" fill="white" />
          {/* Tail */}
          <path d="M25 60 Q 15 50 20 40" stroke="#8B4513" strokeWidth="4" fill="none" className="animate-wiggle" />
          {/* Legs */}
          <rect x="35" y="70" width="6" height="10" rx="3" fill="#5D2E0A" className="animate-leg-front" />
          <rect x="55" y="70" width="6" height="10" rx="3" fill="#5D2E0A" className="animate-leg-back" />
        </svg>
      </div>
      <style jsx>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(30deg); }
        }
        @keyframes run {
          0%, 100% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
        }
        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out infinite;
          transform-origin: bottom right;
        }
        .animate-leg-front {
          animation: run 0.3s ease-in-out infinite;
        }
        .animate-leg-back {
          animation: run 0.3s ease-in-out infinite reverse;
        }
      `}</style>
      <div className="text-center">
        <h3 className="text-lg font-bold text-indigo-600">Puppy is fetching...</h3>
        <p className="text-sm text-slate-500">Wait a tail-wagging second!</p>
      </div>
    </div>
  )
}
