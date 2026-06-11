import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholder for calendar */}
      <div className="grid grid-cols-7 gap-2 w-full max-w-4xl mt-8">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
