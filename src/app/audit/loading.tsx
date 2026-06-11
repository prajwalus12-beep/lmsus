import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholders for audit log */}
      <div className="w-full max-w-4xl mt-8 space-y-3">
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
