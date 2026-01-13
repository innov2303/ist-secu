import { motion } from "framer-motion";
import { Lock, FileText, FileCode } from "lucide-react";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/white_igs_logo_black_bg.png";
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
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="overflow-hidden border-transparent" data-testid="card-audit-conformite">
            <div className="flex items-center justify-center h-32 bg-primary/10">
              <FileCode className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-primary" />
                Audit & Conformité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Audit de sécurité complet selon les standards ANSSI-BP-028, CIS Benchmark, DISA STIG, CIS Docker et CIS Kubernetes.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-transparent" data-testid="card-rapport">
            <div className="flex items-center justify-center h-32 bg-primary/10">
              <FileText className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Rapport & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Synthèse HTML/PDF avec scores de conformité détaillés et remédiations proposées par niveau de gravité.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-transparent" data-testid="card-secure">
            <div className="flex items-center justify-center h-32 bg-primary/10">
              <Lock className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Secure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Durcissement par vos soins des configurations sensibles selon les recommendations.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
