import { motion } from "framer-motion";
import { Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function Suivi() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <Card className="border-primary/20">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mx-auto mb-6">
              <Construction className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Suivi de votre parc</h1>
            <p className="text-muted-foreground mb-6">
              En developpement
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                Cette fonctionnalite vous permettra de suivre l'evolution du niveau de securite de l'ensemble de vos machines au fil des audits.
              </p>
            </div>
            <p className="text-primary font-medium mb-6">
              Prochainement disponible
            </p>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour a l'accueil
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
