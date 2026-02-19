import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, BookOpen, FileCode, Terminal, CheckCircle, Play, Info, Upload, BarChart3, Server } from "lucide-react";
import type { Script } from "@shared/schema";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/ist_logo_white.png";

function getExecutionInstructions(script: Script, toolkitOs?: string): { steps: string[]; command: string; prerequisites: string[] } {
  const filename = script.filename;
  const os = toolkitOs || script.os;

  if (os === "VMware") {
    return {
      prerequisites: [
        "Windows machine with PowerShell 5.1 or higher",
        "VMware PowerCLI module installed (PowerShell cmdlets for VMware)",
        "Network access to vCenter Server or ESXi host",
        "Account with administrator privileges on vCenter/ESXi",
        "ESXi 7.0 or 8.0"
      ],
      steps: [
        "Open PowerShell as administrator on your Windows machine",
        "Install the VMware PowerCLI module if not already done",
        "Connect to your vCenter Server or ESXi host via PowerCLI",
        "Run the audit script that uses PowerCLI commands"
      ],
      command: `# Install PowerCLI (one time only)\nInstall-Module -Name VMware.PowerCLI -Scope CurrentUser -Force\n\n# Connect to vCenter/ESXi\nConnect-VIServer -Server <vcenter_or_esxi_address> -User <username> -Password <password>\n\n# Run the audit script\n.\\${filename}`
    };
  }

  if (os === "NetApp") {
    return {
      prerequisites: [
        "Windows machine with PowerShell 5.1 or higher",
        "NetApp.ONTAP module installed (NetApp PowerShell Toolkit)",
        "Network access to the NetApp ONTAP cluster",
        "Account with administrator privileges on the cluster",
        "ONTAP 9.x"
      ],
      steps: [
        "Open PowerShell as administrator on your Windows machine",
        "Install the NetApp.ONTAP module if not already done",
        "Run the script with the cluster IP address",
        "The script will prompt for login credentials"
      ],
      command: `# Install NetApp module (one time only)\nInstall-Module -Name NetApp.ONTAP -Scope CurrentUser -Force\n\n# Run the audit script\n.\\${filename} -ClusterIP <cluster_ip_address>`
    };
  }

  if (os === "Containers") {
    return {
      prerequisites: [
        "Docker 20.10+ or Podman 4.0+",
        "Kubernetes 1.25+ (for K8s audits)",
        "Access to Docker/Podman sockets",
        "kubectl configured (for Kubernetes)"
      ],
      steps: [
        "Ensure Docker/Podman is running",
        "Make the script executable",
        "Run the script with appropriate permissions"
      ],
      command: `chmod +x ${filename}\nsudo ./${filename}`
    };
  }

  if (os === "Linux" || filename.endsWith(".sh")) {
    return {
      prerequisites: [
        "Linux system (Debian/Ubuntu, RHEL/CentOS, Fedora, SUSE)",
        "Root or sudo access",
        "Bash 4.0 or higher"
      ],
      steps: [
        "Download the script to your Linux server",
        "Make the script executable with chmod",
        "Run the script with root privileges"
      ],
      command: `chmod +x ${filename}\nsudo ./${filename}`
    };
  }

  if (os === "Windows" || filename.endsWith(".ps1")) {
    return {
      prerequisites: [
        "Windows Server 2016, 2019, 2022 or 2025",
        "PowerShell 5.1 or higher",
        "Administrator privileges"
      ],
      steps: [
        "Download the script to your Windows server",
        "Open PowerShell as administrator",
        "Allow script execution if necessary",
        "Run the script"
      ],
      command: `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process\n.\\${filename}`
    };
  }

  return {
    prerequisites: ["See specific documentation"],
    steps: ["Download and run the script according to your environment"],
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
      <SEO 
        title="Documentation"
        description="Complete guide for using Infra Shield Tools security audit scripts. Installation, configuration, and report interpretation."
        url="/documentation"
      />
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
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Documentation</h2>
            <p className="text-muted-foreground">View the documentation for each toolkit</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select a toolkit
            </CardTitle>
            <CardDescription>
              Choose a toolkit to display the documentation for its associated scripts
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
                      <SelectValue placeholder="Select a toolkit" />
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
                      Included scripts ({bundledScripts.length})
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
                                  <h5 className="text-sm font-medium mb-2">Features</h5>
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
                                  <h5 className="text-sm font-medium mb-2">Compliance standards</h5>
                                  <p className="text-sm text-muted-foreground">{script.compliance}</p>
                                </div>
                              )}

                              <div className="mt-4 pt-4 border-t">
                                <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <Play className="h-4 w-4" />
                                  Execution guide
                                </h5>
                                
                                <div className="space-y-3">
                                  <div>
                                    <h6 className="text-xs font-medium text-muted-foreground uppercase mb-2">Prerequisites</h6>
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
                                    <h6 className="text-xs font-medium text-muted-foreground uppercase mb-2">Steps</h6>
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
                                    <h6 className="text-xs font-medium text-muted-foreground uppercase mb-2">Command</h6>
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
                    No scripts associated with this toolkit
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Fleet Tracking Section - JSON Report Upload */}
        <Card className="mt-8" id="suivi-parc">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Fleet Tracking - Import a JSON Report
            </CardTitle>
            <CardDescription>
              Learn how to import your audit reports to track the security evolution of your IT infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Introduction */}
            <div className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 mt-0.5 text-primary" />
                <div>
                  <h4 className="font-semibold">What is Fleet Tracking?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fleet Tracking allows you to centralize all audit reports from your machines. 
                    You can track the evolution of compliance scores, identify failing controls, 
                    and manage the corrections applied on each machine.
                  </p>
                </div>
              </div>
            </div>

            {/* How to generate a JSON report */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Step 1: Generate a JSON report
              </h3>
              <div className="pl-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  When running an audit script, a JSON file is automatically generated in the same directory as the script.
                  This file contains all the information needed for tracking.
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Output example</p>
                  <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
{`# After running the script, you will get:
audit_base_20260119_005349.html  # Readable report
audit_base_20260119_005349.json  # File to import`}
                  </pre>
                </div>
              </div>
            </div>

            {/* JSON file structure */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                JSON file structure
              </h3>
              <div className="pl-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  The JSON file contains essential information for tracking:
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "hostname": "web-server-01",
  "os": "Ubuntu 22.04 LTS",
  "auditDate": "2026-01-20T14:30:00Z",
  "score": 78,
  "totalControls": 115,
  "passedControls": 90,
  "failedControls": 25,
  "controls": [
    {
      "id": "ANSSI-LIN-001",
      "name": "Verify /etc/passwd permissions",
      "status": "passed",
      "severity": "high",
      "details": "Correct permissions: 644"
    },
    {
      "id": "CIS-LIN-042",
      "name": "Disable IPv6",
      "status": "failed",
      "severity": "medium",
      "details": "IPv6 is still active on eth0"
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* How to import the report */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Step 2: Import the report into Fleet Tracking
              </h3>
              <div className="pl-6 space-y-3">
                <ol className="space-y-3">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">1.</span>
                    <span>Log in to your account and navigate to the <strong>"Track your fleet"</strong> page from the main menu</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">2.</span>
                    <span>In the left menu, click on <strong>"Reports"</strong></span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">3.</span>
                    <span>Click the <strong>"Import a report"</strong> button at the top of the list</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">4.</span>
                    <span>Select your JSON file generated by the audit script</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-medium">5.</span>
                    <span>The system automatically detects the machine (via hostname) or creates a new one</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Fleet tracking features */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Server className="h-4 w-4" />
                Fleet Tracking Features
              </h3>
              <div className="pl-6">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Dashboard with global statistics
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Audit history per machine
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Score evolution over time
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Detail of passed/failed controls
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Track applied corrections
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Hierarchical organization (Site, Group)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Team permission management
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Export and share reports
                  </li>
                </ul>
              </div>
            </div>

            {/* Link to tracking */}
            <div className="pt-4 border-t">
              <Button asChild data-testid="link-suivi-from-doc">
                <Link href="/suivi">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Access Fleet Tracking
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
