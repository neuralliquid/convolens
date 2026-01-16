"use client"

import { createPage } from "@/lib/page-utils"

export default createPage(async () => {
  const mod = await import("@/components/features/groups");
  return mod.Groups;
})
