import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholders for holidays list */}
      <div className="space-y-3 w-full max-w-3xl mt-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
