"use client";

import * as React from "react";
import type { RecipeSummary } from "@0xrecipe/shared";

import { recipesUrl } from "@/lib/api";

export function useRecipes(): {
  recipes: RecipeSummary[];
  status: "loading" | "ready" | "error";
} {
  const [recipes, setRecipes] = React.useState<RecipeSummary[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let cancelled = false;
    fetch(recipesUrl())
      .then(async (res) => {
        if (!res.ok) throw new Error(`recipes ${res.status}`);
        return (await res.json()) as { recipes?: RecipeSummary[] };
      })
      .then((data) => {
        if (cancelled) return;
        setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { recipes, status };
}
