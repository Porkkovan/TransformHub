"use client";

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Blue orb */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-float opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)",
          top: "10%",
          left: "15%",
        }}
      />
      {/* Purple orb */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full animate-float-delayed opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)",
          top: "50%",
          right: "10%",
        }}
      />
      {/* Cyan orb */}
      <div
        className="absolute w-[350px] h-[350px] rounded-full animate-float-slow opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)",
          bottom: "10%",
          left: "40%",
        }}
      />
    </div>
  );
}
