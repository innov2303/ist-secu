import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Mail, Lock, User, MapPin, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";
import logoImg from "@assets/generated_images/ist_shield_logo_tech_style.png";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering, user } = useAuth();

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ 
    email: "", 
    password: "", 
    confirmPassword: "",
    firstName: "", 
    lastName: "",
    street: "",
    postalCode: "",
    city: "",
    billingAddressSameAsAddress: true,
    billingStreet: "",
    billingPostalCode: "",
    billingCity: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (user) {
    setLocation("/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(loginData);
      setLocation("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (registerData.password !== registerData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    
    try {
      await register(registerData);
      setLocation("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          <Button variant="outline" size="sm" asChild className="bg-background/20 backdrop-blur border-white/30 text-white hover:bg-background/40" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl flex-1">

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Authentification</CardTitle>
            <CardDescription>
              Connectez-vous ou créez un compte pour accéder aux toolkit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">Connexion</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="votre@email.com"
                        className="pl-10"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                        data-testid="input-login-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        data-testid="input-login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-login-password"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
                  )}
                  <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-forgot-password">
                      Mot de passe oublie ?
                    </Link>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoggingIn} data-testid="button-login-submit">
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      "Se connecter"
                    )}
                  </Button>
                </form>

              </TabsContent>

              <TabsContent value="register" className="space-y-4 mt-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-firstname">Prénom</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-firstname"
                          type="text"
                          placeholder="Jean"
                          className="pl-10"
                          value={registerData.firstName}
                          onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                          required
                          data-testid="input-register-firstname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-lastname">Nom</Label>
                      <Input
                        id="register-lastname"
                        type="text"
                        placeholder="Dupont"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                        data-testid="input-register-lastname"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="votre@email.com"
                        className="pl-10"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                        data-testid="input-register-email"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Mot de passe</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type={showRegisterPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          required
                          minLength={6}
                          data-testid="input-register-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-toggle-register-password"
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Min. 8 car., majuscule, chiffre, special</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm-password">Confirmer</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          value={registerData.confirmPassword}
                          onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                          required
                          minLength={6}
                          data-testid="input-register-confirm-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-medium mb-3">Adresse</h3>
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-3 space-y-2">
                        <Label htmlFor="register-street">Rue</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="register-street"
                            type="text"
                            placeholder="123 rue de la Paix"
                            className="pl-10"
                            value={registerData.street}
                            onChange={(e) => setRegisterData({ ...registerData, street: e.target.value })}
                            required
                            data-testid="input-register-street"
                          />
                        </div>
                      </div>
                      <div className="col-span-1 space-y-2">
                        <Label htmlFor="register-postal-code">Code postal</Label>
                        <Input
                          id="register-postal-code"
                          type="text"
                          placeholder="75001"
                          value={registerData.postalCode}
                          onChange={(e) => setRegisterData({ ...registerData, postalCode: e.target.value })}
                          required
                          data-testid="input-register-postal-code"
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="register-city">Ville</Label>
                        <Input
                          id="register-city"
                          type="text"
                          placeholder="Paris"
                          value={registerData.city}
                          onChange={(e) => setRegisterData({ ...registerData, city: e.target.value })}
                          required
                          data-testid="input-register-city"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Checkbox 
                        id="billing-same"
                        checked={registerData.billingAddressSameAsAddress}
                        onCheckedChange={(checked) => setRegisterData({ 
                          ...registerData, 
                          billingAddressSameAsAddress: checked === true,
                          billingStreet: checked ? "" : registerData.billingStreet,
                          billingPostalCode: checked ? "" : registerData.billingPostalCode,
                          billingCity: checked ? "" : registerData.billingCity
                        })}
                        data-testid="checkbox-billing-same"
                      />
                      <Label htmlFor="billing-same" className="text-sm font-normal cursor-pointer">
                        Adresse de facturation identique a l'adresse actuelle
                      </Label>
                    </div>

                    {!registerData.billingAddressSameAsAddress && (
                      <div className="animate-in fade-in-0 slide-in-from-top-2">
                        <h3 className="text-sm font-medium mb-3">Adresse de facturation</h3>
                        <div className="grid grid-cols-6 gap-3">
                          <div className="col-span-3 space-y-2">
                            <Label htmlFor="register-billing-street">Rue</Label>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="register-billing-street"
                                type="text"
                                placeholder="456 avenue des Champs"
                                className="pl-10"
                                value={registerData.billingStreet}
                                onChange={(e) => setRegisterData({ ...registerData, billingStreet: e.target.value })}
                                required
                                data-testid="input-register-billing-street"
                              />
                            </div>
                          </div>
                          <div className="col-span-1 space-y-2">
                            <Label htmlFor="register-billing-postal-code">Code postal</Label>
                            <Input
                              id="register-billing-postal-code"
                              type="text"
                              placeholder="75008"
                              value={registerData.billingPostalCode}
                              onChange={(e) => setRegisterData({ ...registerData, billingPostalCode: e.target.value })}
                              required
                              data-testid="input-register-billing-postal-code"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label htmlFor="register-billing-city">Ville</Label>
                            <Input
                              id="register-billing-city"
                              type="text"
                              placeholder="Paris"
                              value={registerData.billingCity}
                              onChange={(e) => setRegisterData({ ...registerData, billingCity: e.target.value })}
                              required
                              data-testid="input-register-billing-city"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-destructive" data-testid="text-error">{error}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={isRegistering} data-testid="button-register-submit">
                    {isRegistering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Inscription...
                      </>
                    ) : (
                      "Créer un compte"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
