import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function ConfirmEmailChangePage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de confirmation manquant");
      return;
    }

    const confirmEmailChange = async () => {
      try {
        const response = await fetch(`/api/profile/confirm-email-change?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Votre adresse email a ete modifiee avec succes");
        } else {
          setStatus("error");
          setMessage(data.message || "Erreur lors de la confirmation");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Erreur de connexion au serveur");
      }
    };

    confirmEmailChange();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === "loading" && (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}
              {status === "success" && (
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              )}
              {status === "error" && (
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              )}
            </div>
            <CardTitle className="text-xl">
              {status === "loading" && "Confirmation en cours..."}
              {status === "success" && "Email modifie"}
              {status === "error" && "Echec de la confirmation"}
            </CardTitle>
            <CardDescription className="mt-2">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {status === "success" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Votre nouvelle adresse email est maintenant active. Vous pouvez l'utiliser pour vous connecter.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button asChild>
                    <Link href="/profile">Mon compte</Link>
                  </Button>
                </div>
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Le lien de confirmation est peut-etre expire ou invalide. Vous pouvez demander un nouveau lien depuis votre profil.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button asChild variant="outline">
                    <Link href="/">Retour a l'accueil</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/profile">
                      <Mail className="w-4 h-4 mr-2" />
                      Mon profil
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
