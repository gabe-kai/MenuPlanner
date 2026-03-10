"use client";

import { useState } from "react";
import Link from "next/link";
import { useRecipesStore } from "@/stores/recipesStore";

export default function RecipesPage() {
  const { recipes } = useRecipesStore();
  const [query, setQuery] = useState("");

  const filtered = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Recipe Book</h2>
          <p className="text-sm text-slate-400">
            Phase 2 basic recipe library – demo recipes only for now.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search recipes…"
          className="w-48 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recipes/${encodeURIComponent(recipe.id)}`}
            className="group rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-emerald-500/70 hover:bg-slate-900 transition"
          >
            <h3 className="text-sm font-semibold tracking-tight group-hover:text-emerald-300">
              {recipe.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
              {recipe.description}
            </p>
          </Link>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-slate-500">
            No recipes match “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}

