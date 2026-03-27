'use client'

import React from 'react'

export default function ButtonTest() {
  return (
    <div className="min-h-screen p-10 space-y-10">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Global Button Styles</h1>
        <div className="flex flex-wrap gap-4 items-center">
          <button>⌘+D</button>
          <button>⌘+K</button>
          <button>ESC</button>
          <button>⇧⌘+P</button>
          <button disabled>Disabled</button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">With Icons</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <button>
            <span className="opacity-70">🔍</span> Search
          </button>
          <button>
            <span className="text-red-500">🗑️</span> Delete
          </button>
          <button className="px-10">Large Button</button>
        </div>
      </div>

      <div className="p-6 border border-dashed border-gray-500 rounded-lg">
        <p className="text-sm text-gray-400 mb-4 italic">
          Try switching your system to Light Mode to see the theme change automatically.
        </p>
        <div className="flex gap-4">
          <button className="kbd">Manual .kbd Class</button>
          <button className="no-style text-blue-500 underline">No Style Button</button>
        </div>
      </div>
    </div>
  )
}
