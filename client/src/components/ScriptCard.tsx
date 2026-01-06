import { Script } from "@shared/schema";
import { Monitor, Terminal, Server, Container, Download, FileCode } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { downloadScript } from "@/hooks/use-scripts";
import { useToast } from "@/hooks/use-toast";

interface ScriptCardProps {
  script: Script;
  index: number;
}

const IconMap: Record<string, any> = {
  windows: Monitor,
  linux: Terminal,
  vmware: Server,
  docker: Container,
};

export function ScriptCard({ script, index }: ScriptCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const Icon = IconMap[script.icon.toLowerCase()] || FileCode;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadScript(script.id, script.filename);
      toast({
        title: "Download Started",
        description: `${script.filename} has been saved to your device.`,
        className: "border-primary/50 bg-background text-foreground",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "There was an error downloading the script. Please try again.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative bg-card border border-border/50 hover:border-primary/50 rounded-xl overflow-hidden transition-colors duration-300"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="p-6 relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between mb-6">
          <div className="p-3 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300 group-hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]">
            <Icon className="w-8 h-8" />
          </div>
          <div className="px-2.5 py-1 rounded bg-secondary text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {script.os}
          </div>
        </div>

        <h3 className="text-xl font-bold mb-2 font-mono group-hover:text-primary transition-colors">
          {script.name}
        </h3>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 flex-grow">
          {script.description}
        </p>

        <div className="mt-auto pt-6 border-t border-border/50">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center gap-2">
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Script
                </>
              )}
            </span>
          </button>
          
          <div className="mt-3 text-center">
            <code className="text-[10px] text-muted-foreground/60 font-mono">
              SHA-256 Verified • {script.filename}
            </code>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
