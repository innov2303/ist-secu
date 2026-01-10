import { motion } from "framer-motion";
import { ShieldCheck, Lock, FileText, BarChart3, CheckCircle2 } from "lucide-react";
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
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="IGS Logo" className="w-56 h-56 drop-shadow-lg mix-blend-screen" />
            <h1 className="text-2xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>InfraGuard Security</h1>
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
          <Card className="overflow-hidden" data-testid="card-audit-conformite">
            <div className="flex items-center justify-center h-32 bg-primary/10">
              <ShieldCheck className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Audit & Conformité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Audit de sécurité complet et vérification de conformité des configurations selon les standards ANSSI-BP-028 et CIS Benchmark.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden" data-testid="card-secure">
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
                Durcissement automatique des configurations sensibles et surveillance continue des dérives de sécurité sur vos systèmes.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden" data-testid="card-rapport">
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
                Synthèse PDF/HTML avec scores de conformité détaillés et plan d'actions priorisé pour remédier aux vulnérabilités détectées.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Reports Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center justify-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Rapports d'Audit Complets
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Format PDF / HTML</h3>
                <p className="text-sm text-muted-foreground">
                  Exportez vos rapports en PDF pour l'archivage ou en HTML pour une consultation interactive.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Scores & Graphiques</h3>
                <p className="text-sm text-muted-foreground">
                  Visualisez votre niveau de conformité avec des scores détaillés et des graphiques clairs.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Recommandations</h3>
                <p className="text-sm text-muted-foreground">
                  Recevez des recommandations de correction précises pour chaque point de contrôle échoué.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
