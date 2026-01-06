import { motion } from "framer-motion";
import { ShieldCheck, Terminal, Lock } from "lucide-react";

export function Hero() {
  return (
    <div className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
      {/* Background Decoration */}
      <div className="absolute inset-0 z-0 cyber-grid pointer-events-none" />
      
      <div className="container relative z-10 px-4 mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="inline-flex items-center justify-center px-4 py-1.5 mb-8 border rounded-full bg-primary/10 border-primary/20 text-primary font-mono text-sm"
        >
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          System Security Verification Protocol v1.0
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
        >
          Secure Your Infrastructure<br />
          <span className="text-primary text-glow">Verify Your Systems</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed"
        >
          Download official security verification scripts for your operating environment. 
          Automated checks for compliance, vulnerabilities, and configuration drift.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4 text-sm font-mono text-muted-foreground"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Integrity Check</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
            <Terminal className="w-4 h-4 text-primary" />
            <span>Automated Audit</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border">
            <Lock className="w-4 h-4 text-primary" />
            <span>Zero Trust</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
