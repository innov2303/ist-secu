import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

interface MathCaptchaProps {
  onVerify: (isValid: boolean, challengeId: string, answer: number) => void;
  className?: string;
}

interface ChallengeData {
  challengeId: string;
  question: string;
}

export function MathCaptcha({ onVerify, className }: MathCaptchaProps) {
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchChallenge = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/captcha/challenge");
      if (!response.ok) throw new Error("Failed to fetch challenge");
      const data = await response.json();
      setChallenge(data);
      setUserAnswer("");
      setIsVerified(false);
      onVerify(false, "", 0);
    } catch (err) {
      setError("Erreur de chargement. Veuillez rafraichir.");
    } finally {
      setIsLoading(false);
    }
  }, [onVerify]);

  useEffect(() => {
    fetchChallenge();
  }, []);

  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => {
      fetchChallenge();
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [challenge, fetchChallenge]);

  const handleVerify = async () => {
    if (!challenge) return;
    
    const parsedAnswer = parseInt(userAnswer, 10);
    
    if (isNaN(parsedAnswer)) {
      setError("Veuillez entrer un nombre valide");
      return;
    }
    
    try {
      const response = await fetch("/api/captcha/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, answer: parsedAnswer }),
      });
      const data = await response.json();
      
      if (data.success) {
        setIsVerified(true);
        setError("");
        onVerify(true, challenge.challengeId, parsedAnswer);
      } else {
        setError("Reponse incorrecte. Essayez a nouveau.");
        fetchChallenge();
      }
    } catch (err) {
      setError("Erreur de verification. Veuillez reessayer.");
      fetchChallenge();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerify();
    }
  };

  if (isVerified && challenge) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md ${className}`}>
        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-green-700 dark:text-green-300">Verification reussie</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 p-3 bg-muted/50 border rounded-md ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Verification de securite</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={fetchChallenge}
          disabled={isLoading}
          className="h-6 w-6"
          data-testid="button-refresh-captcha"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-lg font-mono font-semibold select-none" data-testid="text-captcha-question">
              {challenge?.question || "..."}
            </span>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              className="w-20 text-center font-mono"
              data-testid="input-captcha-answer"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleVerify}
            data-testid="button-verify-captcha"
          >
            Verifier
          </Button>
        </div>
      )}
      
      {error && (
        <p className="text-sm text-destructive" data-testid="text-captcha-error">{error}</p>
      )}
    </div>
  );
}
