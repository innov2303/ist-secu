import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Download, BookOpen } from "lucide-react";
import type { Script } from "@shared/schema";

export default function Documentation() {
  const [selectedToolkit, setSelectedToolkit] = useState<string>("");
  const [selectedScript, setSelectedScript] = useState<string>("");

  const { data: scripts, isLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts"],
  });

  const toolkits = useMemo(() => {
    if (!scripts) return [];
    return scripts.filter(s => !s.isHidden && s.bundledScriptIds && s.bundledScriptIds.length > 0);
  }, [scripts]);

  const selectedToolkitData = useMemo(() => {
    if (!selectedToolkit || !toolkits) return null;
    return toolkits.find(t => t.id.toString() === selectedToolkit);
  }, [selectedToolkit, toolkits]);

  const bundledScripts = useMemo(() => {
    if (!selectedToolkitData || !scripts) return [];
    const bundledIds = selectedToolkitData.bundledScriptIds || [];
    return scripts.filter(s => bundledIds.includes(s.id));
  }, [selectedToolkitData, scripts]);

  const selectedScriptData = useMemo(() => {
    if (!selectedScript || !bundledScripts) return null;
    return bundledScripts.find(s => s.id.toString() === selectedScript);
  }, [selectedScript, bundledScripts]);

  const handleToolkitChange = (value: string) => {
    setSelectedToolkit(value);
    setSelectedScript("");
  };

  const handleDownloadPdf = () => {
    if (!selectedScriptData) return;
    const pdfFilename = selectedScriptData.filename.replace(/\.(sh|ps1|py)$/, ".pdf");
    const link = document.createElement("a");
    link.href = `/docs/${pdfFilename}`;
    link.download = pdfFilename;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-8 w-8" />
              Documentation
            </h1>
            <p className="text-muted-foreground">Téléchargez la documentation PDF de chaque script</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sélectionner un script
            </CardTitle>
            <CardDescription>
              Choisissez un toolkit puis le script dont vous souhaitez télécharger la documentation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Toolkit</label>
                  <Select value={selectedToolkit} onValueChange={handleToolkitChange}>
                    <SelectTrigger data-testid="select-toolkit">
                      <SelectValue placeholder="Sélectionnez un toolkit" />
                    </SelectTrigger>
                    <SelectContent>
                      {toolkits.map((toolkit) => (
                        <SelectItem key={toolkit.id} value={toolkit.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{toolkit.name}</span>
                            <span className="text-xs text-muted-foreground">{toolkit.os}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedToolkit && bundledScripts.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Script</label>
                    <Select value={selectedScript} onValueChange={setSelectedScript}>
                      <SelectTrigger data-testid="select-script">
                        <SelectValue placeholder="Sélectionnez un script" />
                      </SelectTrigger>
                      <SelectContent>
                        {bundledScripts.map((script) => (
                          <SelectItem key={script.id} value={script.id.toString()}>
                            <div className="flex flex-col">
                              <span className="font-medium">{script.name}</span>
                              <span className="text-xs text-muted-foreground">{script.filename}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedScriptData && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{selectedScriptData.name}</h3>
                        <p className="text-sm text-muted-foreground">{selectedScriptData.description}</p>
                      </div>
                      <Button onClick={handleDownloadPdf} data-testid="button-download-pdf">
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger PDF
                      </Button>
                    </div>
                  </div>
                )}

                {selectedToolkit && bundledScripts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Aucun script associé à ce toolkit
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
