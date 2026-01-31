import { motion } from "framer-motion";
import { Lock, FileText, FileCode, Activity } from "lucide-react";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/ist_shield_logo_tech_style.png";
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
          <Card className="border-transparent" data-testid="card-audit-conformite">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <FileCode className="w-5 h-5 text-primary" />
                </div>
                Audit Sécurité & Conformité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Audit de sécurité complet selon les standards ANSSI-BP-028, CIS Benchmark, DISA STIG, CIS Docker et CIS Kubernetes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-transparent" data-testid="card-rapport">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                Rapport & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Synthèse HTML/PDF avec scores de conformité détaillés et remédiations proposées par niveau de gravité.
              </p>
            </CardContent>
          </Card>

          <Card className="border-transparent" data-testid="card-secure">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                Secure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Durcissement par vos soins des configurations sensibles selon les recommendations.
              </p>
            </CardContent>
          </Card>

          <Card className="border-transparent" data-testid="card-evolution">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                Suivez l'évolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Mesurez et suivez l'évolution du niveau de sécurité de vos machines au fil des audits.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
