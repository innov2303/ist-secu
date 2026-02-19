import { motion } from "framer-motion";
import { Shield, FileText, Lock, Activity, ChevronRight } from "lucide-react";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@/assets/generated_images/ist_logo_white.png";

export function Hero() {
  const steps = [
    {
      icon: Shield,
      title: "Audit",
      subtitle: "Security Audit & Compliance",
      desc: "ANSSI-BP-028, CIS Benchmark, DISA STIG, CIS Docker, CIS Kubernetes, OWASP",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/30",
      glow: "shadow-cyan-400/20",
    },
    {
      icon: FileText,
      title: "Report",
      subtitle: "Reports & Recommendations",
      desc: "HTML/JSON reports with scores, grades and detailed remediation steps",
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/30",
      glow: "shadow-blue-400/20",
    },
    {
      icon: Lock,
      title: "Harden",
      subtitle: "Secure Configurations",
      desc: "Hardening of sensitive system and network configurations",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/30",
      glow: "shadow-emerald-400/20",
    },
    {
      icon: Activity,
      title: "Track",
      subtitle: "Track Progress",
      desc: "Monitor security posture evolution across all your audits",
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/30",
      glow: "shadow-violet-400/20",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="relative h-40 md:h-48 w-full overflow-hidden">
        <img 
          src={bannerImg} 
          alt="Security Infrastructure" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex items-start justify-start p-6">
          <div className="flex items-center gap-6">
            <img src={logoImg} alt="IST Logo" className="w-32 h-32 md:w-40 md:h-40 drop-shadow-lg mix-blend-screen" />
            <h1 className="text-3xl md:text-4xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>Infra Shield Tools</h1>
          </div>
        </div>
      </div>

      <div className="relative w-full py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-background to-background" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-bold uppercase tracking-[0.3em] text-cyan-400 mb-3">How it works</span>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Security Workflow</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">From audit to continuous monitoring, a complete pipeline to secure your infrastructure.</p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-1/2 left-[8%] right-[8%] h-px -translate-y-1/2 z-0">
                <div className="w-full h-full bg-gradient-to-r from-cyan-500/40 via-blue-500/40 via-emerald-500/40 to-violet-500/40" />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-cyan-500/40 via-blue-500/40 via-emerald-500/40 to-violet-500/40 blur-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-y-4 relative z-10">
                {steps.map((step, i) => (
                  <>
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.15 * i }}
                      className="h-full"
                      data-testid={`card-step-${step.title.toLowerCase()}`}
                    >
                      <div className={`relative rounded-md border ${step.border} ${step.bg} backdrop-blur-sm p-6 shadow-lg ${step.glow} transition-all h-full flex flex-col items-center text-center justify-start gap-3`}>
                        <div className={`flex items-center justify-center w-14 h-14 rounded-md ${step.bg} border ${step.border}`}>
                          <step.icon className={`w-7 h-7 ${step.color}`} />
                        </div>
                        <div className="space-y-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-[0.25em] ${step.color}`}>
                            Step {i + 1}
                          </span>
                          <h3 className="text-sm font-semibold">{step.subtitle}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    </motion.div>

                    {i < steps.length - 1 && (
                      <div key={`arrow-${i}`} className="hidden md:flex items-center justify-center px-1">
                        <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
