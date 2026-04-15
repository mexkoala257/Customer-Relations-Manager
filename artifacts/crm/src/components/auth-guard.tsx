import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";

export function AuthGuard({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    } else if (!isLoading && user && adminOnly && user.role !== "admin") {
      toast({ title: "Access Denied", description: "Admin access required.", variant: "destructive" });
      setLocation("/");
    }
  }, [isLoading, error, user, setLocation, adminOnly, toast]);

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Spinner className="w-8 h-8" /></div>;
  }

  if (!user || (adminOnly && user.role !== "admin")) {
    return null;
  }

  return <>{children}</>;
}
