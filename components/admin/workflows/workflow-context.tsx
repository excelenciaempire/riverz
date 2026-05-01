'use client';

import { createContext, useContext } from 'react';
import type { ValidationIssue } from '@/lib/workflows/validate';

interface WorkflowCtx {
  issuesByStep: Map<string, ValidationIssue[]>;
}

const Ctx = createContext<WorkflowCtx>({ issuesByStep: new Map() });

export function WorkflowProvider({
  issuesByStep,
  children,
}: {
  issuesByStep: Map<string, ValidationIssue[]>;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ issuesByStep }}>{children}</Ctx.Provider>;
}

export function useWorkflow() {
  return useContext(Ctx);
}
