import { PuppyLoader } from "@/components/ui/PuppyLoader"

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <PuppyLoader />
      {/* Skeleton placeholders */}
      <div className="space-y-4 w-full max-w-5xl mt-8">
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    </div>
  )
}
