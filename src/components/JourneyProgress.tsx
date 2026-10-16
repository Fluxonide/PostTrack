import React from "react";
import { FiCheck, FiTruck, FiBox, FiHome, FiAlertCircle } from "react-icons/fi";
import type { ShipmentStatus } from "../carriers/types";
import { STATUS_CONFIG, TRACKING_STEPS } from "../lib/status";

interface JourneyProgressProps {
  status: ShipmentStatus;
}

export const JourneyProgress: React.FC<JourneyProgressProps> = ({ status }) => {
  const meta = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const currentStep = meta.stepIndex;
  const isException = status === "exception" || status === "returned";

  const getStepIcon = (index: number) => {
    switch (index) {
      case 0:
        return <FiBox className="w-3.5 h-3.5" />;
      case 1:
        return <FiTruck className="w-3.5 h-3.5" />;
      case 2:
        return <FiTruck className="w-3.5 h-3.5" />;
      case 3:
        return <FiHome className="w-3.5 h-3.5" />;
      case 4:
        return <FiCheck className="w-3.5 h-3.5" />;
      default:
        return <FiBox className="w-3.5 h-3.5" />;
    }
  };

  if (isException) {
    return (
      <div className="my-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300">
        <FiAlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
        <div className="text-xs sm:text-sm">
          <span className="font-semibold">{meta.label}</span>: Delivery exception encountered. Please review the scan log below for carrier notes.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full my-7">
      <div className="relative flex items-center justify-between">
        {/* Background track line */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 bg-[var(--border)] z-0" />

        {/* Progress colored line */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-all duration-700 ease-out z-0"
          style={{
            width:
              currentStep <= 0
                ? "0%"
                : `calc(${Math.min(100, (currentStep / (TRACKING_STEPS.length - 1)) * 100)}% - 24px)`,
          }}
        />

        {/* Step Checkpoints */}
        {TRACKING_STEPS.map((step, idx) => {
          const isDone = currentStep >= idx;
          const isCurrent = currentStep === idx;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCurrent
                    ? "bg-[var(--accent)] text-black font-bold shadow-[0_0_15px_var(--accent-glow)] ring-4 ring-[rgba(192,133,50,0.25)]"
                    : isDone
                    ? "bg-[var(--accent)] text-black"
                    : "bg-[#1a1710] border border-[var(--border)] text-[var(--text-3)]"
                }`}
              >
                {isDone && !isCurrent ? (
                  <FiCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                ) : (
                  getStepIcon(idx)
                )}
              </div>

              <span
                className={`mt-2 text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
                  isCurrent
                    ? "text-[var(--accent)] font-semibold"
                    : isDone
                    ? "text-[var(--text)]"
                    : "text-[var(--text-3)]"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
