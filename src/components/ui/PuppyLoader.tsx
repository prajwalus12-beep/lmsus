"use client"

import React from 'react'
import { Loader2 } from 'lucide-react'

export function PuppyLoader() {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
    </div>
  )
}
