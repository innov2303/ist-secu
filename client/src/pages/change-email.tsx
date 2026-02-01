import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function ChangeEmailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");

    if (!tokenParam) {
      setTokenValid(false);
      setErrorMessage("Missing token");
      setStatus("error");
      return;
    }

    setToken(tokenParam);
    setTokenValid(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token || !newEmail) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile/submit-new-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        toast({
          title: "Email changed",
          description: "Your email address has been updated successfully.",
        });
      } else {
        setStatus("error");
        setErrorMessage(data.message || "Error changing email");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("Server connection error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              {status === "form" && (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
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
              {status === "form" && "Change Your Email"}
              {status === "success" && "Email Changed"}
              {status === "error" && "Error"}
            </CardTitle>
            <CardDescription className="mt-2">
              {status === "form" && "Enter your new email address"}
              {status === "success" && "Your email address has been updated successfully"}
              {status === "error" && errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "form" && tokenValid && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newEmail">New email address</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    placeholder="new@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    data-testid="input-new-email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !newEmail}
                  data-testid="button-submit-email"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Confirm new email"
                  )}
                </Button>
              </form>
            )}

            {status === "success" && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  You can now use your new email address to sign in.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button asChild>
                    <Link href="/profile">My Account</Link>
                  </Button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  The link may be expired or invalid. You can request a new link from your profile.
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button asChild variant="outline">
                    <Link href="/">Back to Home</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/profile">My Profile</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
