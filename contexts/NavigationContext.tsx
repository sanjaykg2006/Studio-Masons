"use client";
import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";

type NavigationContextValue = {
  pending: boolean;
  navigate: (href: string) => void;
};

const NavigationContext = createContext<NavigationContextValue>({
  pending: false,
  navigate: () => {},
});

// Wraps navigation in a React transition so we get a `pending` flag for the
// whole duration of a route change (including code/chunk loading). Client-only
// pages don't suspend, so this is what makes a loading state visible at all.
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = (href: string) => {
    startTransition(() => router.push(href));
  };

  return (
    <NavigationContext.Provider value={{ pending, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export const useNavigation = () => useContext(NavigationContext);
