import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholders for settings */}
      <div className="w-full max-w-3xl mt-8 space-y-4">
        <div className="h-10 bg-slate-100 rounded-xl animate-pulse w-1/3" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    </div>
  )
}
