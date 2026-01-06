import { motion } from "framer-motion";
import { ShieldCheck, Terminal, Lock } from "lucide-react";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/igs_cybersecurity_logo_dark_blue.png";

export function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* Banner Top */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img 
          src={bannerImg} 
          alt="Security Infrastructure" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-4 px-6 py-4 bg-background/80 backdrop-blur-md rounded-xl border border-border/50 shadow-2xl">
            <img src={logoImg} alt="IGS Logo" className="w-14 h-14 rounded-lg" />
            <h1 className="text-2xl font-bold tracking-tight">InfraGuard Security</h1>
          </div>
        </div>
      </div>

      <div className="container relative z-10 px-4 mx-auto text-center pt-12 pb-16 md:pb-24">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60"
        >
          Secure Your Infrastructure<br />
          <span className="text-primary">Verify Your Systems</span>
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
