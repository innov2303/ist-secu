export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Non autorisé",
      description: "Vous devez vous connecter pour continuer.",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = "/auth";
  }, 500);
}
