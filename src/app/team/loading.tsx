import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholders for team cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
