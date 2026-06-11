import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholders for profile */}
      <div className="w-full max-w-2xl mt-8 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-slate-100 rounded-lg animate-pulse w-1/2" />
            <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-1/3" />
          </div>
        </div>
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    </div>
  )
}
