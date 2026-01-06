import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import type { RegisterData, LoginData } from "@shared/schema";

async function fetchUser(): Promise<User | null> {
  // Try local auth first
  const meResponse = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (meResponse.ok) {
    return meResponse.json();
  }

  // Fall back to Replit Auth
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logoutUser(): Promise<void> {
  // Try local logout first
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  
  if (response.ok) {
    const data = await response.json();
    // Only redirect to Replit logout if not a local auth user
    if (!data.isLocalAuth) {
      window.location.href = "/api/logout";
    } else {
      // Local user - just refresh the page
      window.location.href = "/";
    }
  } else {
    // Fallback to Replit logout
    window.location.href = "/api/logout";
  }
}

async function loginUser(data: LoginData): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur de connexion");
  }

  return response.json();
}

async function registerUser(data: RegisterData): Promise<User> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur d'inscription");
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
  };
}
