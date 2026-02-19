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
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img 
          src={bannerImg} 
          alt="Security Infrastructure" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex items-start justify-start p-6">
          <div className="flex items-center gap-6">
            <img src={logoImg} alt="IST Logo" className="w-64 h-64 md:w-72 md:h-72 drop-shadow-lg mix-blend-screen" />
            <h1 className="text-3xl md:text-4xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>Infra Shield Tools</h1>
          </div>
        </div>
      </div>

      <div className="container relative z-10 px-4 mx-auto pt-12 pb-16 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-5xl mx-auto"
        >
          <h2 className="text-center text-lg font-semibold text-muted-foreground mb-8 tracking-wide uppercase">Security Workflow</h2>

          <div className="relative">
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-3 relative z-10">
              {steps.map((step, i) => (
                <div key={step.title} className="flex items-center gap-2">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 * i }}
                    className="flex-1"
                    data-testid={`card-step-${step.title.toLowerCase()}`}
                  >
                    <div className={`relative rounded-md border ${step.border} ${step.bg} p-5 shadow-lg ${step.glow} transition-all group`}>
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-md ${step.bg} border ${step.border}`}>
                          <step.icon className={`w-6 h-6 ${step.color}`} />
                        </div>
                        <div className="space-y-1">
                          <span className={`text-xs font-bold uppercase tracking-widest ${step.color}`}>
                            Step {i + 1}
                          </span>
                          <h3 className="text-sm font-semibold">{step.subtitle}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {i < steps.length - 1 && (
                    <ChevronRight className="hidden md:block w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
