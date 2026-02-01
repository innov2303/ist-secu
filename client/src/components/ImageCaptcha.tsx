import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Shield, Lock, Key, Server, Database, Cloud, Wifi, Monitor, Cpu, HardDrive, Globe, Mail, User, Camera, Music, Heart, Star, Zap, Bell } from "lucide-react";

interface ImageCaptchaProps {
  onVerify: (isValid: boolean, challengeId: string, selectedIndices: number[]) => void;
  className?: string;
}

interface ChallengeData {
  challengeId: string;
  targetCategory: string;
  targetLabel: string;
  grid: string[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  lock: Lock,
  key: Key,
  server: Server,
  database: Database,
  cloud: Cloud,
  wifi: Wifi,
  monitor: Monitor,
  cpu: Cpu,
  harddrive: HardDrive,
  globe: Globe,
  mail: Mail,
  user: User,
  camera: Camera,
  music: Music,
  heart: Heart,
  star: Star,
  zap: Zap,
  bell: Bell,
};

const CATEGORY_LABELS: Record<string, string> = {
  shield: "boucliers",
  lock: "cadenas",
  key: "cles",
  server: "serveurs",
  database: "bases de donnees",
  cloud: "nuages",
  globe: "globes",
  star: "etoiles",
};

export function ImageCaptcha({ onVerify, className }: ImageCaptchaProps) {
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchChallenge = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setSelectedIndices(new Set());
    try {
      const response = await fetch("/api/captcha/image-challenge");
      if (!response.ok) throw new Error("Failed to fetch challenge");
      const data = await response.json();
      setChallenge(data);
      setIsVerified(false);
      onVerify(false, "", []);
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

  const toggleSelection = (index: number) => {
    if (isVerified) return;
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const handleVerify = async () => {
    if (!challenge || selectedIndices.size === 0) {
      setError("Veuillez selectionner au moins une image");
      return;
    }

    try {
      const response = await fetch("/api/captcha/image-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          selectedIndices: Array.from(selectedIndices),
        }),
      });
      const data = await response.json();

      if (data.success) {
        setIsVerified(true);
        setError("");
        onVerify(true, challenge.challengeId, Array.from(selectedIndices));
      } else {
        setError("Selection incorrecte. Essayez a nouveau.");
        fetchChallenge();
      }
    } catch (err) {
      setError("Erreur de verification. Veuillez reessayer.");
      fetchChallenge();
    }
  };

  if (isVerified) {
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
    <div className={`space-y-3 p-3 bg-muted/50 border rounded-md ${className}`}>
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
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : challenge ? (
        <>
          <p className="text-sm font-medium text-center" data-testid="text-captcha-instruction">
            Selectionnez tous les <span className="text-primary font-semibold">{challenge.targetLabel}</span>
          </p>
          
          <div className="grid grid-cols-3 gap-2" data-testid="captcha-image-grid">
            {challenge.grid.map((iconName, index) => {
              const IconComponent = ICON_MAP[iconName] || Shield;
              const isSelected = selectedIndices.has(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleSelection(index)}
                  className={`aspect-square flex items-center justify-center rounded-md border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-background hover:border-muted-foreground/50"
                  }`}
                  data-testid={`captcha-image-${index}`}
                >
                  <IconComponent className={`h-8 w-8 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleVerify}
              disabled={selectedIndices.size === 0}
              data-testid="button-verify-captcha"
            >
              Verifier
            </Button>
          </div>
        </>
      ) : null}

      {error && (
        <p className="text-sm text-destructive text-center" data-testid="text-captcha-error">{error}</p>
      )}
    </div>
  );
}
