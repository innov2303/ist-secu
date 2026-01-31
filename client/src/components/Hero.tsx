import { motion } from "framer-motion";
import { Lock, FileText, FileCode, Activity } from "lucide-react";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/ist_shield_logo_tech_style.png";
import featureAudit from "@assets/images/feature-audit.png";
import featureRapport from "@assets/images/feature-rapport.png";
import featureSecure from "@assets/images/feature-secure.png";
import featureEvolution from "@assets/images/feature-evolution.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="space-y-2 flex flex-col items-center">
            <Card className="border-transparent py-2 max-w-xl w-full" data-testid="card-audit-conformite">
              <CardHeader className="pb-1 pt-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCode className="w-4 h-4 text-primary" />
                  Audit Sécurité & Conformité
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-xs text-muted-foreground">
                  Standards ANSSI-BP-028, CIS Benchmark, DISA STIG.
                </p>
              </CardContent>
            </Card>
            <div className="rounded-lg overflow-hidden border border-border/40 hover-elevate transition-all max-w-xl">
              <img src={featureAudit} alt="Audit Sécurité" className="w-full h-auto object-cover" />
            </div>
          </div>

          <div className="space-y-2 flex flex-col items-center">
            <Card className="border-transparent py-2 max-w-xl w-full" data-testid="card-rapport">
              <CardHeader className="pb-1 pt-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4 text-primary" />
                  Rapport & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-xs text-muted-foreground">
                  Synthèse HTML/PDF avec scores et remédiations.
                </p>
              </CardContent>
            </Card>
            <div className="rounded-lg overflow-hidden border border-border/40 hover-elevate transition-all max-w-xl">
              <img src={featureRapport} alt="Rapport & Recommendations" className="w-full h-auto object-cover" />
            </div>
          </div>

          <div className="space-y-2 flex flex-col items-center">
            <Card className="border-transparent py-2 max-w-xl w-full" data-testid="card-secure">
              <CardHeader className="pb-1 pt-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="w-4 h-4 text-primary" />
                  Secure
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-xs text-muted-foreground">
                  Durcissement des configurations sensibles.
                </p>
              </CardContent>
            </Card>
            <div className="rounded-lg overflow-hidden border border-border/40 hover-elevate transition-all max-w-xl">
              <img src={featureSecure} alt="Secure" className="w-full h-auto object-cover" />
            </div>
          </div>

          <div className="space-y-2 flex flex-col items-center">
            <Card className="border-transparent py-2 max-w-xl w-full" data-testid="card-evolution">
              <CardHeader className="pb-1 pt-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="w-4 h-4 text-primary" />
                  Suivez l'évolution
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-xs text-muted-foreground">
                  Mesurez la sécurité au fil des audits.
                </p>
              </CardContent>
            </Card>
            <div className="rounded-lg overflow-hidden border border-border/40 hover-elevate transition-all max-w-xl">
              <img src={featureEvolution} alt="Suivez l'évolution" className="w-full h-auto object-cover" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
