"use client";

interface ProductReadiness {
  productId: string;
  productName: string;
  readinessScore: number;
  factors: { name: string; score: number }[];
}

interface ReadinessScorePanelProps {
  products: ProductReadiness[];
}

function getScoreColor(score: number): {
  bar: string;
  text: string;
  bg: string;
} {
  if (score < 3) {
    return {
      bar: "bg-red-500",
      text: "text-red-400",
      bg: "bg-red-500/10",
    };
  }
  if (score <= 5) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-400",
      bg: "bg-amber-500/10",
    };
  }
  return {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
  };
}

export default function ReadinessScorePanel({ products }: ReadinessScorePanelProps) {
  if (products.length === 0) {
    return (
      <div className="glass-panel-sm rounded-xl p-8 flex items-center justify-center">
        <p className="text-sm text-white/40">No product readiness data available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((product) => {
        const colors = getScoreColor(product.readinessScore);

        return (
          <div
            key={product.productId}
            className="glass-panel-sm rounded-xl p-5 border border-white/5 space-y-4"
          >
            {/* Header: Product name + score */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/90 truncate">
                {product.productName}
              </h3>
              <span
                className={`text-lg font-bold tabular-nums ${colors.text}`}
              >
                {product.readinessScore.toFixed(1)}
              </span>
            </div>

            {/* Gauge bar */}
            <div className="space-y-1">
              <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{ width: `${(product.readinessScore / 10) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/30">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            {/* Factor breakdown */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
                Factor Breakdown
              </p>
              <ul className="space-y-1.5">
                {product.factors.map((factor, fi) => {
                  const factorColors = getScoreColor(factor.score);
                  return (
                    <li key={`${fi}-${factor.name}`} className="flex items-center gap-2">
                      <span className="text-xs text-white/60 flex-1 truncate">
                        {factor.name}
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${factorColors.bar}`}
                          style={{
                            width: `${(factor.score / 10) * 100}%`,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium tabular-nums w-7 text-right ${factorColors.text}`}
                      >
                        {factor.score.toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
