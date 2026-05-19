import { Sparkles } from 'lucide-react';

export default function SkeletonLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-pulse pt-20">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-32 h-32 bg-[var(--color-primary)]/20 rounded-full blur-3xl animate-pulse" />
        <Sparkles className="w-16 h-16 text-[var(--color-primary)] animate-bounce" />
      </div>
      <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-2">
        AI 스카우팅 중<span className="animate-pulse">...</span>
      </h2>
      <p className="text-[var(--color-muted)] text-center max-w-md">
        전 세계 트렌드 데이터를 분석하여<br />
        가장 적합한 촬영 아이템을 발굴하고 있습니다.
      </p>

      {/* List skeleton */}
      <div className="w-full max-w-4xl space-y-4 mt-12 opacity-50">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 flex gap-6 items-center">
            <div className="w-32 h-24 bg-[var(--color-border)] rounded-xl" />
            <div className="flex-1 space-y-3">
              <div className="h-6 bg-[var(--color-border)] rounded-md w-3/4" />
              <div className="h-4 bg-[var(--color-border)] rounded-md w-1/2" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-16 bg-[var(--color-border)] rounded-full" />
                <div className="h-6 w-20 bg-[var(--color-border)] rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
