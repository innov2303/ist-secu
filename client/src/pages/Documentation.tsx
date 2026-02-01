import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, BookOpen, FileCode, Terminal, CheckCircle, Play, Info, Upload, BarChart3, Server } from "lucide-react";
import type { Script } from "@shared/schema";
import { Footer } from "@/components/Footer";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/ist_shield_logo_tech_style.png";

function getExecutionInstructions(script: Script, toolkitOs?: string): { steps: string[]; command: string; prerequisites: string[] } {
  const filename = script.filename;
  const os = toolkitOs || script.os;

  if (os === "VMware") {
    return {
      prerequisites: [
        "Machine Windows avec PowerShell 5.1 ou supérieur",
        "Module VMware PowerCLI installé (cmdlets PowerShell pour VMware)",
        "Accès réseau vers vCenter Server ou hôte ESXi",
        "Compte avec privilèges administrateur sur vCenter/ESXi",
        "ESXi 7.0 ou 8.0"
      ],
      steps: [
        "Ouvrez PowerShell en tant qu'administrateur sur votre machine Windows",
        "Installez le module VMware PowerCLI si ce n'est pas déjà fait",
        "Connectez-vous à votre vCenter Server ou hôte ESXi via PowerCLI",
        "Exécutez le script d'audit qui utilise les commandes PowerCLI"
      ],
      command: `# Installation de PowerCLI (une seule fois)\nInstall-Module -Name VMware.PowerCLI -Scope CurrentUser -Force\n\n# Connexion à vCenter/ESXi\nConnect-VIServer -Server <adresse_vcenter_ou_esxi> -User <utilisateur> -Password <motdepasse>\n\n# Exécution du script d'audit\n.\\${filename}`
    };
  }

  if (os === "NetApp") {
    return {
      prerequisites: [
        "Machine Windows avec PowerShell 5.1 ou supérieur",
        "Module NetApp.ONTAP installé (NetApp PowerShell Toolkit)",
        "Accès réseau vers le cluster NetApp ONTAP",
        "Compte avec privilèges administrateur sur le cluster",
        "ONTAP 9.x"
      ],
      steps: [
        "Ouvrez PowerShell en tant qu'administrateur sur votre machine Windows",
        "Installez le module NetApp.ONTAP si ce n'est pas déjà fait",
        "Exécutez le script avec l'adresse IP du cluster",
        "Le script vous demandera les identifiants de connexion"
      ],
      command: `# Installation du module NetApp (une seule fois)\nInstall-Module -Name NetApp.ONTAP -Scope CurrentUser -Force\n\n# Exécution du script d'audit\n.\\${filename} -ClusterIP <adresse_ip_cluster>`
    };
  }

  if (os === "Containers") {
    return {
      prerequisites: [
        "Docker 20.10+ ou Podman 4.0+",
        "Kubernetes 1.25+ (pour les audits K8s)",
        "Accès aux sockets Docker/Podman",
        "kubectl configuré (pour Kubernetes)"
      ],
      steps: [
        "Assurez-vous que Docker/Podman est en cours d'exécution",
        "Rendez le script exécutable",
        "Exécutez le script avec les permissions appropriées"
      ],
      command: `chmod +x ${filename}\nsudo ./${filename}`
    };
  }

  if (os === "Linux" || filename.endsWith(".sh")) {
    return {
      prerequisites: [
        "Système Linux (Debian/Ubuntu, RHEL/CentOS, Fedora, SUSE)",
        "Accès root ou sudo",
        "Bash 4.0 ou supérieur"
      ],
      steps: [
        "Téléchargez le script sur votre serveur Linux",
        "Rendez le script exécutable avec chmod",
        "Exécutez le script avec les privilèges root"
      ],
      command: `chmod +x ${filename}\nsudo ./${filename}`
    };
  }

  if (os === "Windows" || filename.endsWith(".ps1")) {
    return {
      prerequisites: [
        "Windows Server 2016, 2019, 2022 ou 2025",
        "PowerShell 5.1 ou supérieur",
        "Privilèges administrateur"
      ],
      steps: [
        "Téléchargez le script sur votre serveur Windows",
        "Ouvrez PowerShell en tant qu'administrateur",
        "Autorisez l'exécution de scripts si nécessaire",
        "Exécutez le script"
      ],
      command: `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process\n.\\${filename}`
    };
  }

  return {
    prerequisites: ["Consultez la documentation spécifique"],
    steps: ["Téléchargez et exécutez le script selon votre environnement"],
    command: `./${filename}`
  };
}

export default function Documentation() {
  const [selectedToolkit, setSelectedToolkit] = useState<string>("");

  const { data: scripts, isLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts/all"],
  });

  const toolkits = useMemo(() => {
    if (!scripts) return [];
    return scripts.filter(s => !s.isHidden && s.bundledScriptIds && s.bundledScriptIds.length > 0 && s.status === "active");
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

  const handleToolkitChange = (value: string) => {
    setSelectedToolkit(value);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with logo */}
      <div className="relative h-32 md:h-40 w-full overflow-hidden">
        <img 
          src={bannerImg} 
          alt="Security Infrastructure" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src={logoImg} alt="IST Logo" className="w-24 h-24 md:w-32 md:h-32 drop-shadow-lg mix-blend-screen cursor-pointer" />
            </Link>
            <h1 className="text-xl md:text-2xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>Infra Shield Tools</h1>
          </div>
          <Button variant="outline" size="sm" asChild className="bg-background/20 backdrop-blur border-white/30 text-white hover:bg-background/40">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Documentation</h2>
            <p className="text-muted-foreground">Consultez la documentation de chaque toolkit</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sélectionner un toolkit
            </CardTitle>
            <CardDescription>
              Choisissez un toolkit pour afficher la documentation des scripts associés
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

                {selectedToolkitData && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3 mb-3">
                      <Info className="h-5 w-5 mt-0.5 text-primary" />
                      <div>
                        <h4 className="font-semibold">{selectedToolkitData.name}</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{selectedToolkitData.description}</p>
                      </div>
                    </div>
                    
                    {selectedToolkitData.features && selectedToolkitData.features.length > 0 && (
                      <div className="pl-8 mt-3">
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {selectedToolkitData.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {selectedToolkitData.compliance && (
                      <div className="pl-8 mt-3">
                        <span className="text-xs font-medium text-primary">{selectedToolkitData.compliance}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedToolkit && bundledScripts.length > 0 && (
                  <div className="space-y-6 pt-4 border-t">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      Scripts inclus ({bundledScripts.length})
                    </h3>
                    <div className="space-y-6">
                      {bundledScripts.map((script) => {
                        const instructions = getExecutionInstructions(script, selectedToolkitData?.os);
                        return (
                          <div 
                            key={script.id} 
                            className="p-5 rounded-lg border bg-card"
                            data-testid={`script-row-${script.id}`}
                          >
                            <div className="flex items-start gap-3 mb-4">
                              <Terminal className="h-5 w-5 mt-1 text-primary" />
                              <div>
                                <h4 className="font-semibold text-lg">{script.name}</h4>
                                <p className="text-sm text-muted-foreground font-mono">{script.filename}</p>
                              </div>
                            </div>
                            
                            <div className="pl-8 space-y-4">
                              <div>
                                <h5 className="text-sm font-medium mb-2">Description</h5>
                                <p className="text-sm text-muted-foreground whitespace-pre-line">{script.description}</p>
                              </div>
                              
                              {script.features && script.features.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Fonctionnalités</h5>
                                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {script.features.map((feature, idx) => (
                                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        {feature}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {script.compliance && (
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Standards de conformité</h5>
                                  <p className="text-sm text-muted-foreground">{script.compliance}</p>
                                </div>
                              )}

                              <div className="mt-4 pt-4 border-t">
                                <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <Play className="h-4 w-4" />
                                  Guide d'exécution
                                </h5>
                                
                                <div className="space-y-3">
                                  <div>
                                    <h6 className="text-xs font-medium text-muted-foreground uppercase mb-2">Prérequis</h6>
                                    <ul className="space-y-1">
                                      {instructions.prerequisites.map((prereq, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                          <span className="text-primary">•</span>
                                          {prereq}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div>
                                    <h6 className="text-xs font-medium text-muted-foreground uppercase mb-2">Étapes</h6>
                                    <ol className="space-y-1">
                                      {instructions.steps.map((step, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                          <span className="text-primary font-medium">{idx + 1}.</span>
                                          {step}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>

                                  <div>
                                    <h6 className="text-xs font-medium text-muted-foreground uppercase mb-2">Commande</h6>
                                    <pre className="bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                                      {instructions.command}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

        {/* Section Suivi du Parc - Upload de rapports JSON */}
        <Card className="mt-8" id="suivi-parc">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Suivi du Parc - Importer un rapport JSON
            </CardTitle>
            <CardDescription>
              Apprenez a importer vos rapports d'audit pour suivre l'evolution de la securite de votre parc informatique
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Introduction */}
            <div className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 mt-0.5 text-primary" />
                <div>
                  <h4 className="font-semibold">Qu'est-ce que le Suivi du Parc ?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le Suivi du Parc vous permet de centraliser tous les rapports d'audit de vos machines. 
                    Vous pouvez suivre l'evolution des scores de conformite, identifier les controles defaillants 
                    et gerer les corrections appliquees sur chaque machine.
                  </p>
                </div>
              </div>
            </div>

            {/* Comment generer un rapport JSON */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Etape 1 : Generer un rapport JSON
              </h3>
              <div className="pl-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Lors de l'execution d'un script d'audit, un fichier JSON est automatiquement genere dans le meme repertoire que le script.
                  Ce fichier contient toutes les informations necessaires au suivi.
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Exemple de sortie</p>
                  <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
{`# Apres execution du script, vous obtiendrez :
audit_base_20260119_005349.html  # Rapport lisible
audit_base_20260119_005349.json  # Fichier a importer`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Structure du fichier JSON */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Structure du fichier JSON
              </h3>
              <div className="pl-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Le fichier JSON contient les informations essentielles pour le suivi :
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "hostname": "serveur-web-01",
  "os": "Ubuntu 22.04 LTS",
  "auditDate": "2026-01-20T14:30:00Z",
  "score": 78,
  "totalControls": 115,
  "passedControls": 90,
  "failedControls": 25,
  "controls": [
    {
      "id": "ANSSI-LIN-001",
      "name": "Verification des permissions /etc/passwd",
      "status": "passed",
      "severity": "high",
      "details": "Permissions correctes: 644"
    },
    {
      "id": "CIS-LIN-042",
      "name": "Desactivation de l'IPv6",
      "status": "failed",
      "severity": "medium",
      "details": "IPv6 est encore actif sur eth0"
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Comment importer le rapport */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Etape 2 : Importer le rapport dans le Suivi du Parc
              </h3>
              <div className="pl-6 space-y-3">
                <ol className="space-y-3">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">1.</span>
                    <span>Connectez-vous a votre compte et accedez a la page <strong>"Suivi de votre parc"</strong> depuis le menu principal</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">2.</span>
                    <span>Dans le menu de gauche, cliquez sur <strong>"Rapports"</strong></span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">3.</span>
                    <span>Cliquez sur le bouton <strong>"Importer un rapport"</strong> en haut de la liste</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">4.</span>
                    <span>Selectionnez votre fichier JSON genere par le script d'audit</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">5.</span>
                    <span>Le systeme detecte automatiquement la machine (via le hostname) ou en cree une nouvelle</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Fonctionnalites du suivi */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Server className="h-4 w-4" />
                Fonctionnalites du Suivi du Parc
              </h3>
              <div className="pl-6">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Tableau de bord avec statistiques globales
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Historique des audits par machine
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Evolution des scores dans le temps
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Detail des controles passes/echoues
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Suivi des corrections appliquees
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Organisation hierarchique (Site, Groupe)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Gestion des permissions d'equipe
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Export et partage des rapports
                  </li>
                </ul>
              </div>
            </div>

            {/* Lien vers le suivi */}
            <div className="pt-4 border-t">
              <Button asChild data-testid="link-suivi-from-doc">
                <Link href="/suivi">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Acceder au Suivi du Parc
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
